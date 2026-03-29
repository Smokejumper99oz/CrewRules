import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MENTOR_PRELOAD_CSV_HEADERS,
  parseMentorPreloadCsv,
} from "@/lib/mentoring/mentor-preload-csv-import";
import { normalizeOptionalPersonalEmail } from "@/lib/mentoring/mentoring-csv-import";

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

function parseActiveField(raw: string): { ok: true; value: boolean } | { ok: false; error: string } {
  const t = raw.trim().toLowerCase();
  if (!t) return { ok: true, value: true };
  if (["true", "1", "yes"].includes(t)) return { ok: true, value: true };
  if (["false", "0", "no"].includes(t)) return { ok: true, value: false };
  return {
    ok: false,
    error: "active must be true/false, 1/0, yes/no, or blank (default true)",
  };
}

function normalizeWorkEmail(raw: string): { ok: true; email: string | null } | { ok: false; error: string } {
  const s = raw.trim();
  if (!s) return { ok: true, email: null };
  const lower = s.toLowerCase();
  if (!EMAIL_RE.test(lower)) return { ok: false, error: "Invalid work_email" };
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
        message: "employee_number is required.",
      });
      failed += 1;
      continue;
    }

    const emp = values.employee_number.trim();
    if (!emp) {
      rowResults.push({
        rowNumber,
        status: "error",
        message: "employee_number is required.",
      });
      failed += 1;
      continue;
    }

    if (seenEmp.has(emp)) {
      rowResults.push({
        rowNumber,
        status: "error",
        message: `Duplicate employee_number in file: ${emp}`,
      });
      failed += 1;
      continue;
    }
    seenEmp.add(emp);

    const personalResult = normalizeOptionalPersonalEmail(values.personal_email);
    if (!personalResult.ok) {
      rowResults.push({
        rowNumber,
        status: "error",
        message: personalResult.error === "Invalid mentee_email@private" ? "Invalid personal_email" : personalResult.error,
      });
      failed += 1;
      continue;
    }

    const workResult = normalizeWorkEmail(values.work_email);
    if (!workResult.ok) {
      rowResults.push({ rowNumber, status: "error", message: workResult.error });
      failed += 1;
      continue;
    }

    const activeResult = parseActiveField(values.active);
    if (!activeResult.ok) {
      rowResults.push({ rowNumber, status: "error", message: activeResult.error });
      failed += 1;
      continue;
    }

    const fullName = values.full_name.trim() || null;
    const phone = values.phone.trim() || null;
    const notes = values.notes.trim() || null;
    const nowIso = new Date().toISOString();

    const payload = {
      full_name: fullName,
      work_email: workResult.email,
      personal_email: personalResult.email,
      phone,
      active: activeResult.value,
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
      const { error: updErr } = await admin.from("mentor_preload").update(payload).eq("id", existing.id);
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
        ...payload,
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
