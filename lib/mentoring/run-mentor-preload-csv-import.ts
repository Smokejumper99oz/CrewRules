import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MENTOR_PRELOAD_CSV_REQUIRED_HEADERS,
  parseMentorPreloadCsv,
} from "@/lib/mentoring/mentor-preload-csv-import";

/** CSV / XLSX header (must match required headers entry). */
const MENTOR_PRELOAD_WORK_EMAIL_HEADER = "mentor_email_@flyfrontier.com" as const;

const ALLOWED_POSITIONS = new Set(["captain", "first_officer", "flight_attendant"]);

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

/** Aligns with profiles.position check; invalid or blank → null (DB rejects bad enum otherwise). */
function normalizeStagingPosition(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (!s) return null;
  if (ALLOWED_POSITIONS.has(s)) return s;
  return null;
}

/** 3-letter IATA-style staging base; invalid or blank → null. */
function normalizeStagingBaseAirport(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  if (!s) return null;
  if (!/^[A-Z]{3}$/.test(s)) return null;
  return s;
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
  const { optionalPresent } = parsed.data;
  const rowResults: MentorPreloadCsvImportRowResult[] = [];
  const seenEmp = new Set<string>();
  let success = 0;
  let failed = 0;

  for (const { rowNumber, values } of dataRows) {
    const allEmpty = MENTOR_PRELOAD_CSV_REQUIRED_HEADERS.every((k) => values[k] === "");
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

    const staging: { position?: string | null; base_airport?: string | null } = {};
    if (optionalPresent.mentor_position) {
      staging.position = normalizeStagingPosition(values.mentor_position);
    }
    if (optionalPresent.mentor_base_airport) {
      staging.base_airport = normalizeStagingBaseAirport(values.mentor_base_airport);
    }

    const insertPayload = {
      full_name: fullName,
      work_email: workResult.email,
      personal_email: null as string | null,
      phone,
      active: true,
      notes,
      updated_at: nowIso,
      ...staging,
    };

    /** Omits personal_email so existing DB values are not cleared on update. */
    const updatePayload: Record<string, unknown> = {
      full_name: fullName,
      work_email: workResult.email,
      phone,
      active: true,
      notes,
      updated_at: nowIso,
    };
    if (optionalPresent.mentor_position) {
      updatePayload.position = staging.position ?? null;
    }
    if (optionalPresent.mentor_base_airport) {
      updatePayload.base_airport = staging.base_airport ?? null;
    }

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