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
import {
  normalizeMentorPreloadBaseAirportForAdmin,
  normalizeMentorPreloadPersonalEmailForAdmin,
  normalizeMentorPreloadPositionForAdmin,
  normalizeMentorPreloadWorkEmailForAdmin,
} from "@/lib/mentoring/mentor-preload-admin-field-normalize";
import {
  deriveLegacyMentorTypeForSync,
  isMentorRegistryStatusValue,
  MENTOR_REGISTRY_ADMIN_NOTES_MAX_LEN,
  sortMentorRegistryCategories,
} from "@/lib/mentoring/mentor-registry-admin-options";
import type { UpdateMentorAssignmentHireDateFormState } from "@/lib/super-admin/actions";
import { sendMentorAssignmentEmail } from "@/lib/email/send-mentor-assignment-email";
import { formatUsPhoneStored } from "@/lib/format-us-phone";
import {
  loadFrontierMentoringEmailCenterRowByAssignmentId,
  type FrontierMentoringEmailCenterRow,
} from "@/lib/mentoring/frontier-mentoring-email-center-load";

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
    result.rows.filter((r) => r.success).map((r) => r.rowNumber),
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
  const result = await runFrontierMentoringCsvImport(admin, TENANT, text, PORTAL);

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
  const enrichedResult = buildMentorPreloadHistoryInsertResult(text, result);

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

  return { ...enrichedResult, meta };
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
 * Frontier pilots tenant admin: verify `mentor_assignments` row is in scope for this mentoring admin.
 * Supports live mentees, staged mentees (employee_number on assignment), live mentors, and staged mentors
 * (`mentor_preload`), unlike `assertAssignmentMentorInTenantScope` which requires a linked mentor profile.
 */
async function assertFrontierPilotMentoringAssignmentInAdminScope(
  admin: ReturnType<typeof createAdminClient>,
  assignmentId: string
): Promise<{ error?: string }> {
  const { data: row, error } = await admin
    .from("mentor_assignments")
    .select("mentee_user_id, mentor_user_id, mentor_employee_number, employee_number")
    .eq("id", assignmentId)
    .maybeSingle();

  if (error) {
    return { error: error.message };
  }
  if (!row) {
    return { error: "Assignment not found." };
  }

  const menteeUserId = row.mentee_user_id as string | null | undefined;
  const menteeEmpRaw = row.employee_number as string | null | undefined;
  const menteeEmp = menteeEmpRaw != null ? String(menteeEmpRaw).trim() : "";
  const mentorUserId = row.mentor_user_id as string | null | undefined;
  const mentorEmpRaw = row.mentor_employee_number as string | null | undefined;
  const mentorEmp = mentorEmpRaw != null ? String(mentorEmpRaw).trim() : "";

  if (menteeUserId) {
    const { data: prof, error: pErr } = await admin
      .from("profiles")
      .select("tenant, portal")
      .eq("id", menteeUserId)
      .maybeSingle();
    if (pErr) {
      return { error: pErr.message };
    }
    if (prof?.tenant === TENANT && prof?.portal === PORTAL) {
      return {};
    }
  }

  if (menteeEmp) {
    const { data: prof, error: pErr } = await admin
      .from("profiles")
      .select("id")
      .eq("tenant", TENANT)
      .eq("portal", PORTAL)
      .eq("employee_number", menteeEmp)
      .is("deleted_at", null)
      .maybeSingle();
    if (pErr) {
      return { error: pErr.message };
    }
    if (prof?.id) {
      return {};
    }
  }

  if (mentorUserId) {
    const { data: prof, error: pErr } = await admin
      .from("profiles")
      .select("tenant, portal")
      .eq("id", mentorUserId)
      .maybeSingle();
    if (pErr) {
      return { error: pErr.message };
    }
    if (prof?.tenant === TENANT && prof?.portal === PORTAL) {
      return {};
    }
  }

  if (mentorEmp) {
    const { data: preload, error: preErr } = await admin
      .from("mentor_preload")
      .select("id")
      .eq("tenant", TENANT)
      .eq("employee_number", mentorEmp)
      .maybeSingle();
    if (preErr) {
      return { error: preErr.message };
    }
    if (preload?.id) {
      return {};
    }
  }

  const menteeUidAbsent = menteeUserId == null || String(menteeUserId).trim() === "";
  const mentorUidAbsent = mentorUserId == null || String(mentorUserId).trim() === "";
  /**
   * Staged/unlinked mentee assignment (mentoring import): valid rows can exist with mentee `employee_number` set,
   * `mentee_user_id` null (mentee not signed up yet), and no mentor (`mentor_user_id` / `mentor_employee_number` null).
   * Caller must already pass `ensureFrontierPilotsTenantAdmin`; this is only used from the Frontier pilots mentoring
   * admin path on existing `mentor_assignments`. Without this fallback, those imported unassigned rows cannot be
   * reassigned even though the product already supports pre-signup mentees via import.
   */
  if (menteeUidAbsent && menteeEmp.length > 0 && mentorUidAbsent && mentorEmp.length === 0) {
    return {};
  }

  return { error: "Unauthorized" };
}

export type ReassignFrontierPilotAdminMentorAssignmentInput = {
  assignmentId: string;
  /** Live mentor: `profiles.id` in this tenant/portal. */
  newMentorUserId?: string | null;
  /**
   * Mentor employee number: used alone for staged (`mentor_preload`) mentors, or with `newMentorUserId`
   * to verify the profile matches. Resolution order matches `runFrontierMentoringCsvImport` (profile first).
   */
  newMentorEmployeeNumber?: string | null;
};

/**
 * Frontier pilots tenant admin: reassign mentor on an existing `mentor_assignments` row (update by id only;
 * no insert, no CSV). Mirrors tenant gating and id-based update pattern of hire-date edits.
 */
export async function reassignFrontierPilotAdminMentorAssignment(
  params: ReassignFrontierPilotAdminMentorAssignmentInput
): Promise<{ error?: string }> {
  const gate = await ensureFrontierPilotsTenantAdmin();
  if (gate.error) {
    return { error: gate.error };
  }

  const id = params.assignmentId.trim();
  if (!id) {
    return { error: "Invalid assignment." };
  }

  const uidRaw = params.newMentorUserId != null ? String(params.newMentorUserId).trim() : "";
  const empParamRaw =
    params.newMentorEmployeeNumber != null ? String(params.newMentorEmployeeNumber).trim() : "";

  const admin = createAdminClient();
  const scope = await assertFrontierPilotMentoringAssignmentInAdminScope(admin, id);
  if (scope.error) {
    return { error: scope.error };
  }

  const { data: assignmentRow, error: asgErr } = await admin
    .from("mentor_assignments")
    .select("employee_number, mentee_user_id")
    .eq("id", id)
    .maybeSingle();

  if (asgErr) {
    return { error: asgErr.message };
  }
  if (!assignmentRow) {
    return { error: "Assignment not found." };
  }

  const menteeEmpOnAssignment =
    assignmentRow.employee_number != null ? String(assignmentRow.employee_number).trim() : "";
  const menteeUserId = assignmentRow.mentee_user_id as string | null | undefined;

  let nextMentorUserId: string | null = null;
  let nextMentorEmployeeNumber: string | null = null;

  if (!uidRaw && !empParamRaw) {
    nextMentorUserId = null;
    nextMentorEmployeeNumber = null;
  } else if (uidRaw) {
    const { data: mentorProfile, error: mentorErr } = await admin
      .from("profiles")
      .select("id, employee_number")
      .eq("id", uidRaw)
      .eq("tenant", TENANT)
      .eq("portal", PORTAL)
      .is("deleted_at", null)
      .maybeSingle();

    if (mentorErr) {
      return { error: mentorErr.message };
    }
    if (!mentorProfile?.id) {
      return { error: "Mentor profile not found in this tenant." };
    }

    const empFromProfile =
      mentorProfile.employee_number != null ? String(mentorProfile.employee_number).trim() : "";
    if (empParamRaw && empParamRaw !== empFromProfile) {
      return { error: "Mentor employee number does not match selected profile." };
    }

    nextMentorUserId = mentorProfile.id;
    nextMentorEmployeeNumber = empFromProfile.length > 0 ? empFromProfile : null;
  } else {
    const { data: mentorProfile, error: mentorErr } = await admin
      .from("profiles")
      .select("id, employee_number")
      .eq("tenant", TENANT)
      .eq("portal", PORTAL)
      .eq("employee_number", empParamRaw)
      .is("deleted_at", null)
      .maybeSingle();

    if (mentorErr) {
      return { error: mentorErr.message };
    }

    if (mentorProfile?.id) {
      nextMentorUserId = mentorProfile.id;
      const emp = mentorProfile.employee_number != null ? String(mentorProfile.employee_number).trim() : "";
      nextMentorEmployeeNumber = emp.length > 0 ? emp : null;
    } else {
      const { data: preloadRow, error: preloadErr } = await admin
        .from("mentor_preload")
        .select("id, employee_number")
        .eq("tenant", TENANT)
        .eq("employee_number", empParamRaw)
        .maybeSingle();

      if (preloadErr) {
        return { error: preloadErr.message };
      }
      if (!preloadRow?.id) {
        return {
          error: `No mentor with employee_number "${empParamRaw}" in this tenant (no live profile or mentor roster row).`,
        };
      }

      const preEmp =
        preloadRow.employee_number != null ? String(preloadRow.employee_number).trim() : empParamRaw;
      nextMentorUserId = null;
      nextMentorEmployeeNumber = preEmp.length > 0 ? preEmp : null;
    }
  }

  const mentorEmpForSameCheck =
    nextMentorEmployeeNumber != null && nextMentorEmployeeNumber.trim() !== ""
      ? nextMentorEmployeeNumber.trim()
      : null;
  if (mentorEmpForSameCheck && menteeEmpOnAssignment && mentorEmpForSameCheck === menteeEmpOnAssignment) {
    return { error: "Mentor and mentee cannot be the same employee number." };
  }

  if (nextMentorUserId && menteeUserId && nextMentorUserId === menteeUserId) {
    return { error: "Mentor and mentee cannot be the same user." };
  }

  const { error: updErr } = await admin
    .from("mentor_assignments")
    .update({
      mentor_user_id: nextMentorUserId,
      mentor_employee_number: nextMentorEmployeeNumber,
    })
    .eq("id", id);

  if (updErr) {
    return { error: updErr.message };
  }

  revalidatePath("/frontier/pilots/admin/mentoring");
  revalidatePath("/super-admin/mentoring");

  return {};
}

export type ReassignFrontierPilotAdminMentorAssignmentFormState = {
  error: string | null;
  success?: boolean;
};

/**
 * Frontier pilots tenant admin: FormData adapter for `reassignFrontierPilotAdminMentorAssignment`
 * (same useActionState pattern as hire-date edits). `mentorSelection`: `__UNASSIGN__`, `profile:<profiles.id>`,
 * or `preload:<mentor_preload.id>` matching `MenteeRosterMentorOption.optionKey`.
 */
export async function reassignFrontierPilotAdminMentorAssignmentFormState(
  _prev: ReassignFrontierPilotAdminMentorAssignmentFormState,
  formData: FormData
): Promise<ReassignFrontierPilotAdminMentorAssignmentFormState> {
  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  const mentorSelection = String(formData.get("mentorSelection") ?? "").trim();

  if (!assignmentId) {
    return { error: "Invalid assignment." };
  }
  if (!mentorSelection) {
    return { error: "Select a mentor or unassign." };
  }

  let params: ReassignFrontierPilotAdminMentorAssignmentInput;

  if (mentorSelection === "__UNASSIGN__") {
    params = {
      assignmentId,
      newMentorUserId: null,
      newMentorEmployeeNumber: null,
    };
  } else if (mentorSelection.startsWith("profile:")) {
    const uid = mentorSelection.slice("profile:".length).trim();
    if (!uid) {
      return { error: "Invalid selection." };
    }
    const adminProfile = createAdminClient();
    const { data: prof, error: profErr } = await adminProfile
      .from("profiles")
      .select("employee_number")
      .eq("id", uid)
      .eq("tenant", TENANT)
      .eq("portal", PORTAL)
      .is("deleted_at", null)
      .maybeSingle();
    if (profErr) {
      return { error: profErr.message };
    }
    const empNorm =
      prof?.employee_number != null ? String(prof.employee_number).trim() : "";
    params = {
      assignmentId,
      newMentorUserId: uid,
      newMentorEmployeeNumber: empNorm.length > 0 ? empNorm : null,
    };
  } else if (mentorSelection.startsWith("preload:")) {
    const preloadId = mentorSelection.slice("preload:".length).trim();
    if (!preloadId) {
      return { error: "Invalid selection." };
    }
    const admin = createAdminClient();
    const { data: pre, error: preErr } = await admin
      .from("mentor_preload")
      .select("employee_number")
      .eq("id", preloadId)
      .eq("tenant", TENANT)
      .maybeSingle();
    if (preErr) {
      return { error: preErr.message };
    }
    const emp = pre?.employee_number != null ? String(pre.employee_number).trim() : "";
    if (!emp) {
      return { error: "Invalid staged mentor." };
    }
    params = { assignmentId, newMentorUserId: null, newMentorEmployeeNumber: emp };
  } else {
    return { error: "Invalid selection." };
  }

  const result = await reassignFrontierPilotAdminMentorAssignment(params);
  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/frontier/pilots/admin/mentoring/mentee-roster");
  return { error: null, success: true };
}

/** Same derivation as Email Center `statusFromRow` (serialized `status` is usually enough). */
function rosterStatusForEmailCenterMentorSend(
  r: FrontierMentoringEmailCenterRow
): "live" | "not_live" | "unassigned" {
  if (r.status === "live" || r.status === "not_live" || r.status === "unassigned") {
    return r.status;
  }
  const hasMentor =
    (r.mentor_name != null && r.mentor_name.trim() !== "") ||
    r.mentor_account === "active" ||
    r.mentor_account === "not_joined";
  if (!hasMentor) return "unassigned";
  if (r.mentee_account === "active" && r.mentor_account === "active") return "live";
  return "not_live";
}

export type SendFrontierPilotAdminMentorAssignmentEmailFormState = {
  error: string | null;
  success?: boolean;
};

/** Same DOH display as Email Center / mentee roster table cells (YYYY/MM/DD when stored YYYY-MM-DD). */
function formatMenteeDohForAssignmentEmail(value: string | null | undefined): string {
  if (value == null || !String(value).trim()) return "—";
  const s = String(value).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, "/");
  return s;
}

/**
 * Email Center: send one mentor assignment notification per submit (`assignmentId` in FormData).
 * Uses Email Center loader enrichment for `resolved_mentor_email` (no duplicate resolution rules).
 */
export async function sendFrontierPilotAdminMentorAssignmentEmailFormState(
  _prev: SendFrontierPilotAdminMentorAssignmentEmailFormState,
  formData: FormData
): Promise<SendFrontierPilotAdminMentorAssignmentEmailFormState> {
  const gate = await ensureFrontierPilotsTenantAdmin();
  if (gate.error) {
    return { error: gate.error };
  }

  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  if (!assignmentId) {
    return { error: "Invalid assignment." };
  }

  const row = await loadFrontierMentoringEmailCenterRowByAssignmentId(assignmentId);
  if (!row) {
    return { error: "Assignment not found or not in this roster." };
  }

  if (!row.assignment_id || row.assignment_id !== assignmentId) {
    return { error: "Not an assignment-backed row." };
  }

  if (rosterStatusForEmailCenterMentorSend(row) === "unassigned") {
    return { error: "No mentor assigned for this row." };
  }

  const toEmail = row.resolved_mentor_email?.trim() ?? "";
  if (!toEmail) {
    return { error: "No resolved mentor email for this row." };
  }

  const mentorName = (row.mentor_name?.trim() || "there").trim();
  const menteeName = (row.name?.trim() && row.name.trim() !== "—" ? row.name.trim() : "Mentee").trim();
  const menteeEmployeeNumber = (row.employee_number?.trim() && row.employee_number.trim() !== "—"
    ? row.employee_number.trim()
    : "—"
  ).trim();

  const menteeDohDisplay = formatMenteeDohForAssignmentEmail(row.hire_date);
  const menteePrivateEmail = (row.mentee_email?.trim() && row.mentee_email.trim().length > 0
    ? row.mentee_email.trim()
    : "—"
  ).trim();
  const menteePhoneFmt = formatUsPhoneStored(row.mentee_phone);
  const menteePrivatePhone = menteePhoneFmt ?? "—";

  const sent = await sendMentorAssignmentEmail({
    assignmentId: assignmentId,
    toEmail,
    mentorName,
    menteeName,
    menteeEmployeeNumber,
    menteeDohDisplay,
    menteePrivateEmail,
    menteePrivatePhone,
  });

  if (!sent.ok) {
    return { error: sent.error };
  }

  revalidatePath("/frontier/pilots/admin/mentoring/email-center");
  return { error: null, success: true };
}

export type SendFrontierPilotAdminMentorAssignmentEmailsBulkResult = {
  successCount: number;
  skippedNoAssignment: number;
  skippedNoMentor: number;
  skippedNoEmail: number;
  errors: string[];
};

/**
 * Email Center: send mentor assignment notifications for many assignment IDs in one call.
 * Same load/gate/send rules as {@link sendFrontierPilotAdminMentorAssignmentEmailFormState} per id.
 */
export async function sendFrontierPilotAdminMentorAssignmentEmailsBulk(
  assignmentIds: string[]
): Promise<SendFrontierPilotAdminMentorAssignmentEmailsBulkResult> {
  const gate = await ensureFrontierPilotsTenantAdmin();
  if (gate.error) {
    return {
      successCount: 0,
      skippedNoAssignment: 0,
      skippedNoMentor: 0,
      skippedNoEmail: 0,
      errors: [gate.error],
    };
  }

  let successCount = 0;
  let skippedNoAssignment = 0;
  let skippedNoMentor = 0;
  let skippedNoEmail = 0;
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const raw of assignmentIds) {
    const assignmentId = String(raw ?? "").trim();
    if (!assignmentId) {
      skippedNoAssignment++;
      continue;
    }
    if (seen.has(assignmentId)) {
      continue;
    }
    seen.add(assignmentId);

    const row = await loadFrontierMentoringEmailCenterRowByAssignmentId(assignmentId);
    if (!row) {
      skippedNoAssignment++;
      continue;
    }
    if (!row.assignment_id || row.assignment_id !== assignmentId) {
      skippedNoAssignment++;
      continue;
    }

    if (rosterStatusForEmailCenterMentorSend(row) === "unassigned") {
      skippedNoMentor++;
      continue;
    }

    const toEmail = row.resolved_mentor_email?.trim() ?? "";
    if (!toEmail) {
      skippedNoEmail++;
      continue;
    }

    const mentorName = (row.mentor_name?.trim() || "there").trim();
    const menteeName = (row.name?.trim() && row.name.trim() !== "—" ? row.name.trim() : "Mentee").trim();
    const menteeEmployeeNumber = (row.employee_number?.trim() && row.employee_number.trim() !== "—"
      ? row.employee_number.trim()
      : "—"
    ).trim();

    const menteeDohDisplay = formatMenteeDohForAssignmentEmail(row.hire_date);
    const menteePrivateEmail = (row.mentee_email?.trim() && row.mentee_email.trim().length > 0
      ? row.mentee_email.trim()
      : "—"
    ).trim();
    const menteePhoneFmt = formatUsPhoneStored(row.mentee_phone);
    const menteePrivatePhone = menteePhoneFmt ?? "—";

    const sent = await sendMentorAssignmentEmail({
      assignmentId: assignmentId,
      toEmail,
      mentorName,
      menteeName,
      menteeEmployeeNumber,
      menteeDohDisplay,
      menteePrivateEmail,
      menteePrivatePhone,
    });

    if (!sent.ok) {
      errors.push(sent.error);
      continue;
    }

    successCount++;
  }

  revalidatePath("/frontier/pilots/admin/mentoring/email-center");
  return {
    successCount,
    skippedNoAssignment,
    skippedNoMentor,
    skippedNoEmail,
    errors,
  };
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

/** Frontier pilots tenant admin: upsert a mentoring_contacts card (title, subtitle, icon_key, sort_order, entries). */
export async function upsertMentoringContactCard(formData: FormData): Promise<{ error?: string }> {
  const gate = await ensureFrontierPilotsTenantAdmin();
  if (gate.error) return { error: gate.error };

  const id = String(formData.get("id") ?? "").trim() || null;
  const title = String(formData.get("title") ?? "").trim();
  const subtitle = String(formData.get("subtitle") ?? "").trim();
  const icon_key = String(formData.get("icon_key") ?? "users").trim() || "users";
  const sort_order = parseInt(String(formData.get("sort_order") ?? "0"), 10) || 0;
  const entriesRaw = String(formData.get("entries") ?? "[]");

  if (!title) return { error: "Title is required." };

  let entries: unknown;
  try {
    entries = JSON.parse(entriesRaw);
    if (!Array.isArray(entries)) throw new Error("not array");
  } catch {
    return { error: "Invalid entries data." };
  }

  const admin = createAdminClient();

  if (id) {
    const { error } = await admin
      .from("mentoring_contacts")
      .update({ title, subtitle, icon_key, sort_order, entries })
      .eq("id", id)
      .eq("tenant", TENANT)
      .eq("portal", PORTAL);
    if (error) return { error: error.message };
  } else {
    const { error } = await admin
      .from("mentoring_contacts")
      .insert({ tenant: TENANT, portal: PORTAL, title, subtitle, icon_key, sort_order, entries });
    if (error) return { error: error.message };
  }

  revalidatePath("/frontier/pilots/admin/mentoring");
  revalidatePath("/frontier/pilots/portal/mentoring/contacts");
  return {};
}

/** Frontier pilots tenant admin: delete a mentoring_contacts card by id. */
export async function deleteMentoringContactCard(formData: FormData): Promise<{ error?: string }> {
  const gate = await ensureFrontierPilotsTenantAdmin();
  if (gate.error) return { error: gate.error };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Invalid card." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("mentoring_contacts")
    .delete()
    .eq("id", id)
    .eq("tenant", TENANT)
    .eq("portal", PORTAL);

  if (error) return { error: error.message };

  revalidatePath("/frontier/pilots/admin/mentoring");
  revalidatePath("/frontier/pilots/portal/mentoring/contacts");
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

/**
 * Frontier pilots tenant admin: create or update mentor_registry for one Mentor Roster row.
 */
export async function upsertFrontierPilotAdminMentorRegistry(
  formData: FormData
): Promise<{ error?: string }> {
  const gate = await ensureFrontierPilotsTenantAdmin();
  if (gate.error) {
    return { error: gate.error };
  }

  const rowKind = String(formData.get("rowKind") ?? "").trim();
  const rowId = String(formData.get("rowId") ?? "").trim();
  const mentorCategories = sortMentorRegistryCategories(formData.getAll("mentor_category").map(String));
  const mentorStatus = String(formData.get("mentor_status") ?? "").trim();
  const adminNotesRaw = String(formData.get("admin_notes") ?? "");
  const adminNotesTrimmed = adminNotesRaw.trim();

  if (rowKind !== "profile" && rowKind !== "preload") {
    return { error: "Invalid row." };
  }
  if (!rowId) {
    return { error: "Invalid row." };
  }
  if (mentorCategories.length === 0) {
    return { error: "Select at least one mentor category." };
  }
  const mentorTypeSync = deriveLegacyMentorTypeForSync(mentorCategories);
  if (!isMentorRegistryStatusValue(mentorStatus)) {
    return { error: "Invalid mentor status." };
  }
  if (adminNotesTrimmed.length > MENTOR_REGISTRY_ADMIN_NOTES_MAX_LEN) {
    return { error: "Admin notes are too long." };
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const notesPayload = adminNotesTrimmed.length > 0 ? adminNotesTrimmed : null;

  if (rowKind === "profile") {
    const { data: prof, error: pErr } = await admin
      .from("profiles")
      .select("id, tenant, portal, is_mentor, deleted_at")
      .eq("id", rowId)
      .maybeSingle();

    if (pErr) {
      return { error: pErr.message };
    }
    if (
      !prof ||
      prof.tenant !== TENANT ||
      prof.portal !== PORTAL ||
      prof.is_mentor !== true ||
      prof.deleted_at != null
    ) {
      return { error: "Not allowed to edit program data for this mentor." };
    }

    const { data: existing, error: exErr } = await admin
      .from("mentor_registry")
      .select("id")
      .eq("profile_id", rowId)
      .maybeSingle();

    if (exErr) {
      return { error: exErr.message };
    }

    if (existing?.id) {
      const { error: uErr } = await admin
        .from("mentor_registry")
        .update({
          mentor_categories: mentorCategories,
          mentor_type: mentorTypeSync,
          mentor_status: mentorStatus,
          admin_notes: notesPayload,
          updated_at: nowIso,
        })
        .eq("id", existing.id);
      if (uErr) {
        return { error: uErr.message };
      }
    } else {
      const { error: iErr } = await admin.from("mentor_registry").insert({
        profile_id: rowId,
        preload_id: null,
        mentor_categories: mentorCategories,
        mentor_type: mentorTypeSync,
        mentor_status: mentorStatus,
        admin_notes: notesPayload,
        updated_at: nowIso,
      });
      if (iErr) {
        return { error: iErr.message };
      }
    }
  } else {
    const { data: pre, error: preErr } = await admin
      .from("mentor_preload")
      .select("id, tenant, matched_profile_id")
      .eq("id", rowId)
      .maybeSingle();

    if (preErr) {
      return { error: preErr.message };
    }
    if (!pre || pre.tenant !== TENANT || pre.matched_profile_id != null) {
      return { error: "Not allowed to edit program data for this preload row." };
    }

    const { data: existing, error: exErr } = await admin
      .from("mentor_registry")
      .select("id")
      .eq("preload_id", rowId)
      .maybeSingle();

    if (exErr) {
      return { error: exErr.message };
    }

    if (existing?.id) {
      const { error: uErr } = await admin
        .from("mentor_registry")
        .update({
          mentor_categories: mentorCategories,
          mentor_type: mentorTypeSync,
          mentor_status: mentorStatus,
          admin_notes: notesPayload,
          updated_at: nowIso,
        })
        .eq("id", existing.id);
      if (uErr) {
        return { error: uErr.message };
      }
    } else {
      const { error: iErr } = await admin.from("mentor_registry").insert({
        profile_id: null,
        preload_id: rowId,
        mentor_categories: mentorCategories,
        mentor_type: mentorTypeSync,
        mentor_status: mentorStatus,
        admin_notes: notesPayload,
        updated_at: nowIso,
      });
      if (iErr) {
        return { error: iErr.message };
      }
    }
  }

  revalidatePath("/frontier/pilots/admin/mentoring/mentor-roster");
  return {};
}

const MENTOR_PRELOAD_ROSTER_NOTES_MAX = 8000;

/**
 * Frontier pilots tenant admin: update mentor_preload staging fields for an unmatched row only.
 */
export async function updateFrontierPilotAdminMentorPreloadFromRoster(
  formData: FormData
): Promise<{ error?: string }> {
  const gate = await ensureFrontierPilotsTenantAdmin();
  if (gate.error) {
    return { error: gate.error };
  }

  const preloadId = String(formData.get("preloadId") ?? "").trim();
  if (!preloadId) {
    return { error: "Invalid preload." };
  }

  const admin = createAdminClient();
  const { data: row, error: fetchErr } = await admin
    .from("mentor_preload")
    .select("id, tenant, matched_profile_id, employee_number")
    .eq("id", preloadId)
    .maybeSingle();

  if (fetchErr) {
    return { error: fetchErr.message };
  }
  if (!row || (row.tenant as string) !== TENANT || row.matched_profile_id != null) {
    return { error: "This preload row cannot be edited (wrong tenant or already linked)." };
  }

  const fullNameRaw = String(formData.get("full_name") ?? "").trim();
  const full_name = fullNameRaw.length > 0 ? fullNameRaw : null;

  const employee_number = String(formData.get("employee_number") ?? "").trim();
  if (!employee_number) {
    return { error: "Employee number is required." };
  }
  if (employee_number.length > 64) {
    return { error: "Employee number is too long." };
  }

  const oldEmp = String((row.employee_number as string | null) ?? "").trim();
  if (employee_number !== oldEmp) {
    const { data: clash, error: clashErr } = await admin
      .from("mentor_preload")
      .select("id")
      .eq("tenant", TENANT)
      .eq("employee_number", employee_number)
      .neq("id", preloadId)
      .maybeSingle();

    if (clashErr) {
      return { error: clashErr.message };
    }
    if (clash?.id) {
      return {
        error: `Another mentor preload already uses employee number ${employee_number}.`,
      };
    }
  }

  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const phone = phoneRaw.length > 0 ? phoneRaw : null;
  if (phone && phone.length > 64) {
    return { error: "Phone is too long." };
  }

  const workResult = normalizeMentorPreloadWorkEmailForAdmin(String(formData.get("work_email") ?? ""));
  if (!workResult.ok) {
    return { error: workResult.error };
  }

  const personalResult = normalizeMentorPreloadPersonalEmailForAdmin(
    String(formData.get("personal_email") ?? "")
  );
  if (!personalResult.ok) {
    return { error: personalResult.error };
  }

  const position = normalizeMentorPreloadPositionForAdmin(String(formData.get("position") ?? ""));
  const base_airport = normalizeMentorPreloadBaseAirportForAdmin(String(formData.get("base_airport") ?? ""));

  const notesRaw = String(formData.get("preload_notes") ?? "").trim();
  const notes =
    notesRaw.length === 0
      ? null
      : notesRaw.length > MENTOR_PRELOAD_ROSTER_NOTES_MAX
        ? notesRaw.slice(0, MENTOR_PRELOAD_ROSTER_NOTES_MAX)
        : notesRaw;

  const activeRaw = String(formData.get("preload_active") ?? "").trim();
  const active = activeRaw === "true";

  const nowIso = new Date().toISOString();

  const { error: uErr } = await admin
    .from("mentor_preload")
    .update({
      full_name,
      employee_number,
      phone,
      work_email: workResult.email,
      personal_email: personalResult.email,
      position,
      base_airport,
      notes,
      active,
      updated_at: nowIso,
    })
    .eq("id", preloadId)
    .eq("tenant", TENANT)
    .is("matched_profile_id", null);

  if (uErr) {
    const msg = uErr.message ?? "";
    if (
      msg.toLowerCase().includes("duplicate") ||
      msg.toLowerCase().includes("unique") ||
      (uErr as { code?: string }).code === "23505"
    ) {
      return {
        error: "That employee number is already used by another mentor preload in this tenant.",
      };
    }
    return { error: uErr.message };
  }

  revalidatePath("/frontier/pilots/admin/mentoring/mentor-roster");
  return {};
}

/** Tenant admin: mark an open failed-milestone review as resolved (review row only). */
export async function resolveFailedMilestoneReview(input: {
  attemptId: string;
  note?: string | null;
}): Promise<{ ok?: true; error?: string }> {
  const gate = await ensureFrontierPilotsTenantAdmin();
  if (gate.error) return { error: gate.error };

  const attemptId = input.attemptId.trim();
  if (!attemptId) return { error: "Invalid attempt." };

  const noteTrim = (input.note ?? "").trim();
  const resolvedNote = noteTrim.length > 0 ? noteTrim : null;

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: review, error: fetchErr } = await admin
    .from("mentorship_milestone_attempt_reviews")
    .select("attempt_id, status")
    .eq("attempt_id", attemptId)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!review) return { error: "Review not found." };
  if (String((review as { status: string }).status) !== "open") {
    return { error: "Review is not open." };
  }

  const { error: updErr } = await admin
    .from("mentorship_milestone_attempt_reviews")
    .update({
      status: "resolved",
      resolved_at: nowIso,
      resolved_note: resolvedNote,
    })
    .eq("attempt_id", attemptId)
    .eq("status", "open");

  if (updErr) return { error: updErr.message };

  revalidatePath("/frontier/pilots/admin");
  revalidatePath("/frontier/pilots/admin/mentoring");
  return { ok: true };
}

/** Tenant admin: archive an open failed-milestone review (review row only). */
export async function archiveFailedMilestoneReview(input: {
  attemptId: string;
  reason?: string | null;
}): Promise<{ ok?: true; error?: string }> {
  const gate = await ensureFrontierPilotsTenantAdmin();
  if (gate.error) return { error: gate.error };

  const attemptId = input.attemptId.trim();
  if (!attemptId) return { error: "Invalid attempt." };

  const reasonTrim = (input.reason ?? "").trim();
  const archivedReason = reasonTrim.length > 0 ? reasonTrim : null;

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: review, error: fetchErr } = await admin
    .from("mentorship_milestone_attempt_reviews")
    .select("attempt_id, status")
    .eq("attempt_id", attemptId)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!review) return { error: "Review not found." };
  if (String((review as { status: string }).status) !== "open") {
    return { error: "Review is not open." };
  }

  const { error: updErr } = await admin
    .from("mentorship_milestone_attempt_reviews")
    .update({
      status: "archived",
      archived_at: nowIso,
      archived_reason: archivedReason,
    })
    .eq("attempt_id", attemptId)
    .eq("status", "open");

  if (updErr) return { error: updErr.message };

  revalidatePath("/frontier/pilots/admin");
  revalidatePath("/frontier/pilots/admin/mentoring");
  return { ok: true };
}
