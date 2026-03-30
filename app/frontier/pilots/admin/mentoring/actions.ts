"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncMentorshipMilestoneDueDatesFromHireForAssignment } from "@/lib/mentoring/create-milestones-for-assignment";
import { isValidHireDateYyyyMmDd } from "@/lib/mentoring/mentoring-csv-import";
import {
  frontierMentoringAssignXlsxToCsvText,
  mentorPreloadXlsxToCsvText,
} from "@/lib/mentoring/mentoring-workbook-first-sheet-to-csv-text";
import { insertMentoringImportHistory } from "@/lib/mentoring/mentoring-import-history";
import {
  insertMentorPreloadImportHistory,
  type MentorPreloadImportHistoryInsertResult,
} from "@/lib/mentoring/mentor-preload-import-history";
import {
  runFrontierMentoringCsvImport,
  type MentoringCsvImportResult,
} from "@/lib/mentoring/run-frontier-mentoring-csv-import";
import { summarizeMentoringCsvImportRows } from "@/lib/mentoring/mentoring-import-summary";
import { linkMentorToPreload } from "@/lib/mentoring/link-mentor-to-preload";
import { parseMentorPreloadCsv } from "@/lib/mentoring/mentor-preload-csv-import";
import {
  runMentorPreloadCsvImport,
  type MentorPreloadCsvImportResult,
} from "@/lib/mentoring/run-mentor-preload-csv-import";
import { getProfile, isAdmin } from "@/lib/profile";
import type { UpdateMentorAssignmentHireDateFormState } from "@/lib/super-admin/actions";

export type {
  MentoringCsvImportMeta,
  MentoringCsvImportRowDisplay,
  MentoringCsvImportResult,
} from "@/lib/mentoring/run-frontier-mentoring-csv-import";
export type { MentorPreloadCsvImportResult } from "@/lib/mentoring/run-mentor-preload-csv-import";

/** Display-only fields for mentor preload upload UI (server action only). */
export type MentorPreloadCsvImportMeta = {
  fileName: string;
  fileType: "csv" | "xlsx";
  uploadedAtIso: string;
  totalRows: number;
  successCount: number;
  failedCount: number;
};

export type MentorPreloadCsvImportActionResult = MentorPreloadCsvImportResult & {
  meta?: MentorPreloadCsvImportMeta;
};

const TENANT = "frontier";
const PORTAL = "pilots";

async function ensureFrontierPilotsTenantAdmin(): Promise<{ error?: string }> {
  const profile = await getProfile();
  if (!profile) {
    return { error: "Not signed in" };
  }
  if (!(await isAdmin(TENANT, PORTAL))) {
    return { error: "Unauthorized" };
  }
  return {};
}

const MAX_CSV_BYTES = 2 * 1024 * 1024;

const PROFILE_LINK_IN_CHUNK = 100;

async function linkExistingProfilesAfterMentorPreloadImport(
  admin: ReturnType<typeof createAdminClient>,
  text: string,
  result: MentorPreloadCsvImportResult,
): Promise<void> {
  const successRowNumbers = new Set(
    result.rows.filter((r) => r.status === "success").map((r) => r.rowNumber),
  );
  if (successRowNumbers.size === 0) return;

  const parsed = parseMentorPreloadCsv(text);
  if (!parsed.ok) {
    console.error("[importFrontierPilotAdminMentorCsv] link step parse:", parsed.error);
    return;
  }

  const employeeNumbers = new Set<string>();
  for (const row of parsed.data.rows) {
    if (!successRowNumbers.has(row.rowNumber)) continue;
    const emp = row.values.mentor_employee_number.trim();
    if (emp) employeeNumbers.add(emp);
  }
  if (employeeNumbers.size === 0) return;

  const empList = [...employeeNumbers];
  for (let i = 0; i < empList.length; i += PROFILE_LINK_IN_CHUNK) {
    const chunk = empList.slice(i, i + PROFILE_LINK_IN_CHUNK);
    const { data: profs, error: profErr } = await admin
      .from("profiles")
      .select("id, employee_number, tenant")
      .eq("tenant", TENANT)
      .eq("portal", PORTAL)
      .in("employee_number", chunk)
      .not("employee_number", "is", null);

    if (profErr) {
      console.error("[importFrontierPilotAdminMentorCsv] profile lookup for link:", profErr.message);
      continue;
    }

    for (const p of profs ?? []) {
      const pid = p.id as string;
      const emp = (p.employee_number as string | null)?.trim() ?? "";
      const ten = (p.tenant as string | null)?.trim() ?? "";
      if (!emp || !ten) continue;
      try {
        await linkMentorToPreload(pid, emp, ten);
      } catch (e) {
        console.error("[importFrontierPilotAdminMentorCsv] linkMentorToPreload failed", pid, e);
      }
    }
  }
}

function buildMentorPreloadHistoryInsertResult(
  text: string,
  result: MentorPreloadCsvImportResult,
): MentorPreloadImportHistoryInsertResult {
  const parsed = parseMentorPreloadCsv(text);
  const lookup = new Map<number, { fullName: string | null; employeeNumber: string | null }>();
  if (parsed.ok) {
    for (const row of parsed.data.rows) {
      const emp = row.values.mentor_employee_number.trim();
      const nameRaw = row.values.mentor_full_name.trim();
      lookup.set(row.rowNumber, {
        fullName: nameRaw || null,
        employeeNumber: emp || null,
      });
    }
  }
  const enrichedRows = result.rows.map((r) => {
    const id = lookup.get(r.rowNumber);
    return {
      ...r,
      employeeNumber: id?.employeeNumber ?? null,
      fullName: id?.fullName ?? null,
    };
  });
  return { ...result, rows: enrichedRows };
}

/**
 * Frontier pilots tenant admin: same CSV semantics as Platform Owner upload, but tenant is
 * always `frontier` (never taken from the session). Gated with `isAdmin("frontier","pilots")`.
 */
export async function importFrontierPilotAdminMentoringCsv(
  _prev: MentoringCsvImportResult | null,
  formData: FormData
): Promise<MentoringCsvImportResult> {
  const gate = await ensureFrontierPilotsTenantAdmin();
  if (gate.error) {
    return { rows: [], fatalError: gate.error };
  }

  const isTestImport = formData.has("is_test_import");

  const file = formData.get("csv");
  if (!(file instanceof File)) {
    return { rows: [], fatalError: "No file uploaded." };
  }
  const lower = file.name.toLowerCase();
  const isCsv = lower.endsWith(".csv");
  const isXlsx = lower.endsWith(".xlsx");
  if (!isCsv && !isXlsx) {
    return { rows: [], fatalError: "Please upload a .csv or .xlsx file." };
  }
  if (file.size > MAX_CSV_BYTES) {
    return { rows: [], fatalError: "File is too large (max 2 MB)." };
  }

  let text: string;
  try {
    if (isCsv) {
      text = await file.text();
    } else {
      const buffer = await file.arrayBuffer();
      const conv = frontierMentoringAssignXlsxToCsvText(buffer);
      if (!conv.ok) {
        return { rows: [], fatalError: conv.error };
      }
      text = conv.csvText;
    }
  } catch {
    return { rows: [], fatalError: "Could not read file." };
  }

  const admin = createAdminClient();
  const result = await runFrontierMentoringCsvImport(admin, TENANT, text);

  const profile = await getProfile();
  const counts = summarizeMentoringCsvImportRows(result.rows);
  const meta = {
    fileName: file.name,
    fileType: (isCsv ? "csv" : "xlsx") as "csv" | "xlsx",
    uploadedAtIso: new Date().toISOString(),
    totalRows: counts.totalRows,
    successCount: counts.successCount,
    createdCount: counts.createdCount,
    updatedCount: counts.updatedCount,
    failedCount: counts.failedCount,
  };
  const enriched: MentoringCsvImportResult = { ...result, meta };
  if (profile?.id) {
    await insertMentoringImportHistory(admin, {
      tenant: TENANT,
      uploadedByUserId: profile.id,
      fileName: file.name,
      fileType: isCsv ? "csv" : "xlsx",
      result: enriched,
      isTestImport,
    });
  }

  revalidatePath("/frontier/pilots/admin/mentoring");
  revalidatePath("/frontier/pilots/admin/mentoring/mentee-import");
  revalidatePath("/super-admin/mentoring");
  revalidatePath("/super-admin/mentoring/upload");

  return enriched;
}

/**
 * Frontier pilots tenant admin: bulk upsert into public.mentor_preload for `TENANT` only.
 * Gated with `isAdmin("frontier","pilots")`.
 */
export async function importFrontierPilotAdminMentorCsv(
  _prev: MentorPreloadCsvImportActionResult | null,
  formData: FormData
): Promise<MentorPreloadCsvImportActionResult> {
  const gate = await ensureFrontierPilotsTenantAdmin();
  if (gate.error) {
    return { total: 0, success: 0, failed: 0, rows: [], fatalError: gate.error };
  }

  const file = formData.get("csv");
  if (!(file instanceof File)) {
    return { total: 0, success: 0, failed: 0, rows: [], fatalError: "No file uploaded." };
  }
  const lower = file.name.toLowerCase();
  const isCsv = lower.endsWith(".csv");
  const isXlsx = lower.endsWith(".xlsx");
  if (!isCsv && !isXlsx) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      rows: [],
      fatalError: "Please upload a .csv or .xlsx file.",
    };
  }
  if (file.size > MAX_CSV_BYTES) {
    return { total: 0, success: 0, failed: 0, rows: [], fatalError: "File is too large (max 2 MB)." };
  }

  let text: string;
  try {
    if (isCsv) {
      text = await file.text();
    } else {
      const buffer = await file.arrayBuffer();
      const conv = mentorPreloadXlsxToCsvText(buffer);
      if (!conv.ok) {
        return { total: 0, success: 0, failed: 0, rows: [], fatalError: conv.error };
      }
      text = conv.csvText;
    }
  } catch {
    return { total: 0, success: 0, failed: 0, rows: [], fatalError: "Could not read file." };
  }

  const admin = createAdminClient();
  const result = await runMentorPreloadCsvImport(admin, TENANT, text);

  await linkExistingProfilesAfterMentorPreloadImport(admin, text, result);

  const profile = await getProfile();
  if (profile?.id) {
    const historyResult = buildMentorPreloadHistoryInsertResult(text, result);
    await insertMentorPreloadImportHistory(admin, {
      tenant: TENANT,
      uploadedByUserId: profile.id,
      fileName: file.name,
      fileType: isCsv ? "csv" : "xlsx",
      result: historyResult,
    });
  }

  const meta: MentorPreloadCsvImportMeta = {
    fileName: file.name,
    fileType: isCsv ? "csv" : "xlsx",
    uploadedAtIso: new Date().toISOString(),
    totalRows: result.total,
    successCount: result.success,
    failedCount: result.failed,
  };

  revalidatePath("/frontier/pilots/admin/mentoring");
  revalidatePath("/frontier/pilots/admin/mentoring/mentor-import");
  revalidatePath("/frontier/pilots/admin/mentoring/mentor-roster");

  return { ...result, meta };
}

/** Mentor on the assignment must be a Frontier pilots profile (tenant admin scope). */
async function assertAssignmentMentorInTenantScope(
  admin: ReturnType<typeof createAdminClient>,
  assignmentId: string
): Promise<{ error?: string }> {
  const { data: row, error } = await admin
    .from("mentor_assignments")
    .select("mentor_user_id")
    .eq("id", assignmentId)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!row?.mentor_user_id) {
    return { error: "Assignment not found." };
  }

  const { data: prof, error: pErr } = await admin
    .from("profiles")
    .select("tenant, portal")
    .eq("id", row.mentor_user_id)
    .maybeSingle();

  if (pErr) {
    return { error: pErr.message };
  }
  if (!prof || prof.tenant !== TENANT || prof.portal !== PORTAL) {
    return { error: "Unauthorized" };
  }
  return {};
}

/**
 * Frontier pilots tenant admin: set `mentor_assignments.hire_date` when assignment mentor is in this tenant,
 * then recalculate milestone `due_date` values for that assignment (same rules as seed; no inserts/deletes,
 * does not change `completed_date`).
 */
export async function updateFrontierPilotAdminMentorAssignmentHireDate(
  assignmentId: string,
  hireDateYyyyMmDd: string
): Promise<{ error?: string }> {
  const gate = await ensureFrontierPilotsTenantAdmin();
  if (gate.error) {
    return { error: gate.error };
  }

  const id = assignmentId.trim();
  const raw = hireDateYyyyMmDd.trim();
  if (!id) {
    return { error: "Invalid assignment." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !isValidHireDateYyyyMmDd(raw)) {
    return { error: "Date must be a valid YYYY-MM-DD." };
  }

  const admin = createAdminClient();
  const scope = await assertAssignmentMentorInTenantScope(admin, id);
  if (scope.error) {
    return { error: scope.error };
  }

  const { error } = await admin.from("mentor_assignments").update({ hire_date: raw }).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/frontier/pilots/admin/mentoring");
  revalidatePath("/super-admin/mentoring");

  const recalc = await recalculateFrontierPilotAdminMentorshipMilestoneDueDates(id);
  if (recalc.error) {
    return { error: recalc.error };
  }

  return {};
}

export async function updateFrontierPilotAdminMentorAssignmentHireDateFormState(
  _prev: UpdateMentorAssignmentHireDateFormState,
  formData: FormData
): Promise<UpdateMentorAssignmentHireDateFormState> {
  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  const hireDate = String(formData.get("hireDate") ?? "").trim();
  const result = await updateFrontierPilotAdminMentorAssignmentHireDate(assignmentId, hireDate);
  if (result.error) {
    return { error: result.error };
  }
  return { error: null };
}

/**
 * Frontier pilots tenant admin: recalc milestone due dates from assignment hire_date (same rules as seed).
 */
export async function recalculateFrontierPilotAdminMentorshipMilestoneDueDates(
  assignmentId: string
): Promise<{ error?: string }> {
  const gate = await ensureFrontierPilotsTenantAdmin();
  if (gate.error) {
    return { error: gate.error };
  }

  const id = assignmentId.trim();
  if (!id) {
    return { error: "Invalid assignment." };
  }

  const admin = createAdminClient();
  const scope = await assertAssignmentMentorInTenantScope(admin, id);
  if (scope.error) {
    return { error: scope.error };
  }

  const result = await syncMentorshipMilestoneDueDatesFromHireForAssignment(admin, id);
  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/frontier/pilots/admin/mentoring");
  revalidatePath("/super-admin/mentoring");
  return {};
}

/** Frontier pilots tenant admin: mark one open `mentorship_program_requests` row resolved for this tenant. */
export async function resolveFrontierPilotAdminMentorshipProgramRequest(formData: FormData): Promise<void> {
  const gate = await ensureFrontierPilotsTenantAdmin();
  if (gate.error) {
    return;
  }

  const id = String(formData.get("requestId") ?? "").trim();
  if (!id) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("mentorship_program_requests")
    .update({ status: "resolved", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "open")
    .eq("tenant", TENANT)
    .eq("portal", PORTAL);

  if (error) {
    return;
  }

  revalidatePath("/frontier/pilots/admin/mentoring");
}
