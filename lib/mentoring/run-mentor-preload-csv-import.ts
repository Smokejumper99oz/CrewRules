import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MENTOR_PRELOAD_CSV_HEADERS,
  parseMentorPreloadCsv,
} from "@/lib/mentoring/mentor-preload-csv-import";

/** CSV / XLSX header (must match MENTOR_PRELOAD_CSV_HEADERS entry). */
const MENTOR_PRELOAD_WORK_EMAIL_HEADER = "mentor_email_@flyfrontier.com" as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type MentorPreloadCsvImportRowResult = {
  rowNumber: number;
  status: "success" | "error";
  message: string;
};

export type MentorPreloadCsvImportResult = {
  total: number;
  success: number;
  failed: number;
  rows: MentorPreloadCsvImportRowResult[];
  fatalError?: string;
};

function normalizeMentorWorkEmail(raw: string): { ok: true; email: string | null } | { ok: false; error: string } {
  const s = raw.trim();
  if (!s) return { ok: true, email: null };
  const lower = s.toLowerCase();
  if (!EMAIL_RE.test(lower)) {
    return { ok: false, error: `Invalid ${MENTOR_PRELOAD_WORK_EMAIL_HEADER}` };
  }
  return { ok: true, email: lower };
}

/**
 * Upserts public.mentor_preload by (tenant, employee_number).
 * Never writes matched_profile_id; existing non-null links are preserved.
 */
export async function runMentorPreloadCsvImport(
  admin: SupabaseClient,
  tenant: string,
  text: string
): Promise<MentorPreloadCsvImportResult> {
  const tenantTrim = tenant?.trim();
  if (!tenantTrim) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      rows: [],
      fatalError: "tenant is required",
    };
  }

  const parsed = parseMentorPreloadCsv(text);
  if (!parsed.ok) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      rows: [],
      fatalError: parsed.error,
    };
  }

  const dataRows = parsed.data.rows;
  const rowResults: MentorPreloadCsvImportRowResult[] = [];
  const seenEmp = new Set<string>();
  let success = 0;
  let failed = 0;

  for (const { rowNumber, values } of dataRows) {
    const allEmpty = MENTOR_PRELOAD_CSV_HEADERS.every((k) => values[k] === "");
    if (allEmpty) {
      rowResults.push({
        rowNumber,
        status: "error",
        message: "mentor_employee_number is required.",
      });
      failed += 1;
      continue;
    }

    const emp = values.mentor_employee_number.trim();
    if (!emp) {
      rowResults.push({
        rowNumber,
        status: "error",
        message: "mentor_employee_number is required.",
      });
      failed += 1;
      continue;
    }

    if (seenEmp.has(emp)) {
      rowResults.push({
        rowNumber,
        status: "error",
        message: `Duplicate mentor_employee_number in file: ${emp}`,
      });
      failed += 1;
      continue;
    }
    seenEmp.add(emp);

    const workEmailRaw = values[MENTOR_PRELOAD_WORK_EMAIL_HEADER];
    const workResult = normalizeMentorWorkEmail(workEmailRaw);
    if (!workResult.ok) {
      rowResults.push({ rowNumber, status: "error", message: workResult.error });
      failed += 1;
      continue;
    }

    const fullName = values.mentor_full_name.trim() || null;
    const phone = values.mentor_phone_number.trim() || null;
    const notes = values.notes.trim() || null;
    const nowIso = new Date().toISOString();

    const insertPayload = {
      full_name: fullName,
      work_email: workResult.email,
      personal_email: null as string | null,
      phone,
      active: true,
      notes,
      updated_at: nowIso,
    };

    /** Omits personal_email so existing DB values are not cleared on update. */
    const updatePayload = {
      full_name: fullName,
      work_email: workResult.email,
      phone,
      active: true,
      notes,
      updated_at: nowIso,
    };

    const { data: existing, error: findErr } = await admin
      .from("mentor_preload")
      .select("id")
      .eq("tenant", tenantTrim)
      .eq("employee_number", emp)
      .maybeSingle();

    if (findErr) {
      rowResults.push({
        rowNumber,
        status: "error",
        message: findErr.message,
      });
      failed += 1;
      continue;
    }

    if (existing?.id) {
      const { error: updErr } = await admin.from("mentor_preload").update(updatePayload).eq("id", existing.id);
      if (updErr) {
        rowResults.push({ rowNumber, status: "error", message: updErr.message });
        failed += 1;
      } else {
        rowResults.push({
          rowNumber,
          status: "success",
          message: "Updated mentor preload row",
        });
        success += 1;
      }
    } else {
      const { error: insErr } = await admin.from("mentor_preload").insert({
        tenant: tenantTrim,
        employee_number: emp,
        ...insertPayload,
      });
      if (insErr) {
        rowResults.push({ rowNumber, status: "error", message: insErr.message });
        failed += 1;
      } else {
        rowResults.push({
          rowNumber,
          status: "success",
          message: "Inserted mentor preload row",
        });
        success += 1;
      }
    }
  }

  return {
    total: dataRows.length,
    success,
    failed,
    rows: rowResults,
  };
}
