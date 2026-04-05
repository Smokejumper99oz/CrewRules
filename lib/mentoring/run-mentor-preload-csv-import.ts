import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MENTOR_PRELOAD_CSV_PERSONAL_EMAIL_HEADER,
  MENTOR_PRELOAD_CSV_REQUIRED_HEADERS,
  MENTOR_PRELOAD_CSV_WORK_EMAIL_HEADER,
  parseMentorPreloadCsv,
  type MentorPreloadCsvHeaderPresence,
  type MentorPreloadCsvRowValues,
} from "@/lib/mentoring/mentor-preload-csv-import";
import {
  normalizeMentorPreloadBaseAirportForAdmin,
  normalizeMentorPreloadPersonalEmailForAdmin,
  normalizeMentorPreloadPositionForAdmin,
  normalizeMentorPreloadWorkEmailForAdmin,
} from "@/lib/mentoring/mentor-preload-admin-field-normalize";
import {
  deriveLegacyMentorTypeForSync,
  sortMentorRegistryCategories,
  type MentorRegistryStatusValue,
  type MentorRegistryTypeValue,
} from "@/lib/mentoring/mentor-registry-admin-options";
import {
  MENTORING_IMPORT_ROW_CREATED_MESSAGE,
  MENTORING_IMPORT_ROW_NO_CHANGES_MESSAGE,
  MENTORING_IMPORT_ROW_UPDATED_MESSAGE,
} from "@/lib/mentoring/mentoring-import-summary";

export type MentorPreloadCsvImportRowResult = {
  rowNumber: number;
  success: boolean;
  message: string;
};

export type MentorPreloadCsvImportResult = {
  total: number;
  success: number;
  failed: number;
  rows: MentorPreloadCsvImportRowResult[];
  fatalError?: string;
};

/** PostgREST `or` filter: wrap values so `.` in emails are not parsed as operators. */
function mentorPreloadOrFilterString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function eqMentorPreloadField(
  existing: string | null | undefined,
  next: string | null | undefined
): boolean {
  const a = existing == null || String(existing).trim() === "" ? null : String(existing).trim();
  const b = next == null || String(next).trim() === "" ? null : String(next).trim();
  return a === b;
}

type MentorPreloadRowForCompare = {
  full_name: string | null;
  phone: string | null;
  active: boolean | null;
  notes: string | null;
  work_email: string | null;
  personal_email: string | null;
  position: string | null;
  base_airport: string | null;
  employee_number: string | null;
};

/** Same idea as mentee assignment upsert: detect material diff before reporting Updated vs Unchanged. */
function mentorPreloadUpdateDataChanged(
  before: MentorPreloadRowForCompare,
  updatePayload: Record<string, unknown>,
  options?: { nextEmployeeNumber?: string }
): boolean {
  if (options?.nextEmployeeNumber !== undefined) {
    if (!eqMentorPreloadField(before.employee_number, options.nextEmployeeNumber)) return true;
  }
  if (!eqMentorPreloadField(before.full_name, updatePayload.full_name as string | null | undefined)) return true;
  if (!eqMentorPreloadField(before.phone, updatePayload.phone as string | null | undefined)) return true;
  if ((before.active ?? null) !== true) return true;
  if (!eqMentorPreloadField(before.notes, updatePayload.notes as string | null | undefined)) return true;
  if ("work_email" in updatePayload && !eqMentorPreloadField(before.work_email, updatePayload.work_email as string | null | undefined)) {
    return true;
  }
  if (
    "personal_email" in updatePayload &&
    !eqMentorPreloadField(before.personal_email, updatePayload.personal_email as string | null | undefined)
  ) {
    return true;
  }
  if ("position" in updatePayload && !eqMentorPreloadField(before.position, updatePayload.position as string | null | undefined)) {
    return true;
  }
  if ("base_airport" in updatePayload && !eqMentorPreloadField(before.base_airport, updatePayload.base_airport as string | null | undefined)) {
    return true;
  }
  return false;
}

const MENTOR_PRELOAD_COMPARE_SELECT =
  "full_name, phone, active, notes, work_email, personal_email, position, base_airport, employee_number" as const;

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
    const { optionalPresent } = parsed.data;

    const coreEmpty = MENTOR_PRELOAD_CSV_REQUIRED_HEADERS.every((k) => values[k] === "");
    const workVal = values[MENTOR_PRELOAD_CSV_WORK_EMAIL_HEADER].trim();
    const personalVal = values[MENTOR_PRELOAD_CSV_PERSONAL_EMAIL_HEADER].trim();
    const allEmpty = coreEmpty && !workVal && !personalVal;

    if (allEmpty) {
      rowResults.push({
        rowNumber,
        success: false,
        message: "mentor_employee_number is required.",
      });
      failed += 1;
      continue;
    }

    const empRaw = values.mentor_employee_number.trim();
    const emp = empRaw;

    // Frontier rule: must be 6 digits starting with 4
    const isValidEmp = /^4\d{5}$/.test(emp);

    if (!isValidEmp) {
      rowResults.push({
        rowNumber,
        success: false,
        message: `Invalid employee number: ${empRaw}`,
      });
      failed += 1;
      continue;
    }

    if (!emp) {
      rowResults.push({
        rowNumber,
        success: false,
        message: "mentor_employee_number is required.",
      });
      failed += 1;
      continue;
    }

    if (seenEmp.has(emp)) {
      rowResults.push({
        rowNumber,
        success: false,
        message: `Duplicate mentor_employee_number in file: ${emp}`,
      });
      failed += 1;
      continue;
    }
    seenEmp.add(emp);

    let workEmail: string | null = null;
    if (optionalPresent.workEmail) {
      const workResult = normalizeMentorPreloadWorkEmailForAdmin(
        values[MENTOR_PRELOAD_CSV_WORK_EMAIL_HEADER],
      );
      if (!workResult.ok) {
        rowResults.push({
          rowNumber,
          success: false,
          message: `${MENTOR_PRELOAD_CSV_WORK_EMAIL_HEADER}: ${workResult.error}`,
        });
        failed += 1;
        continue;
      }
      workEmail = workResult.email;
    }

    let personalEmail: string | null = null;
    if (optionalPresent.personalEmail) {
      const personalResult = normalizeMentorPreloadPersonalEmailForAdmin(
        values[MENTOR_PRELOAD_CSV_PERSONAL_EMAIL_HEADER],
      );
      if (!personalResult.ok) {
        rowResults.push({
          rowNumber,
          success: false,
          message: `${MENTOR_PRELOAD_CSV_PERSONAL_EMAIL_HEADER}: ${personalResult.error}`,
        });
        failed += 1;
        continue;
      }
      personalEmail = personalResult.email;
    }

    const hasPositionColumns =
      optionalPresent.seat || optionalPresent.role || optionalPresent.mentorPosition;
    let positionRaw = "";
    if (optionalPresent.seat && values.seat.trim()) {
      positionRaw = values.seat;
    } else if (optionalPresent.role && values.role.trim()) {
      positionRaw = values.role;
    } else if (optionalPresent.mentorPosition && values.mentor_position.trim()) {
      positionRaw = values.mentor_position;
    }
    const positionForDb = hasPositionColumns
      ? normalizeMentorPreloadPositionForAdmin(positionRaw)
      : undefined;

    let baseRaw = "";
    if (optionalPresent.crewBase) {
      baseRaw = values.crew_base;
    } else if (optionalPresent.mentorBaseAirport) {
      baseRaw = values.mentor_base_airport;
    }
    const baseForDb =
      optionalPresent.crewBase || optionalPresent.mentorBaseAirport
        ? normalizeMentorPreloadBaseAirportForAdmin(baseRaw)
        : undefined;

    const fullName = values.mentor_full_name.trim() || null;
    const phone = values.mentor_phone_number.trim() || null;
    const notes = values.notes.trim() || null;
    const nowIso = new Date().toISOString();

    const insertPayload: Record<string, unknown> = {
      full_name: fullName,
      phone,
      active: true,
      notes,
      updated_at: nowIso,
    };
    if (optionalPresent.workEmail) {
      insertPayload.work_email = workEmail;
    } else {
      insertPayload.work_email = null;
    }
    if (optionalPresent.personalEmail) {
      insertPayload.personal_email = personalEmail;
    } else {
      insertPayload.personal_email = null;
    }
    if (positionForDb !== undefined) {
      insertPayload.position = positionForDb;
    }
    if (baseForDb !== undefined) {
      insertPayload.base_airport = baseForDb;
    }

    const updatePayload: Record<string, unknown> = {
      full_name: fullName,
      phone,
      active: true,
      notes,
      updated_at: nowIso,
    };
    if (optionalPresent.workEmail) {
      updatePayload.work_email = workEmail;
    }
    if (optionalPresent.personalEmail) {
      updatePayload.personal_email = personalEmail;
    }
    if (positionForDb !== undefined) {
      updatePayload.position = positionForDb;
    }
    if (baseForDb !== undefined) {
      updatePayload.base_airport = baseForDb;
    }

    const { data: existing, error: findErr } = await admin
      .from("mentor_preload")
      .select("id, matched_profile_id")
      .eq("tenant", tenantTrim)
      .eq("employee_number", emp)
      .maybeSingle();

    if (findErr) {
      rowResults.push({
        rowNumber,
        success: false,
        message: findErr.message,
      });
      failed += 1;
      continue;
    }

    let fallbackMatch: {
      id: string;
      employee_number: string | null;
      matched_profile_id: string | null;
    } | null = null;

    if (!existing) {
      const normalizedWorkEmail = workEmail;
      const normalizedPersonalEmail = personalEmail;
      const orParts: string[] = [];
      if (normalizedWorkEmail) {
        orParts.push(`work_email.eq.${mentorPreloadOrFilterString(normalizedWorkEmail)}`);
      }
      if (normalizedPersonalEmail) {
        orParts.push(`personal_email.eq.${mentorPreloadOrFilterString(normalizedPersonalEmail)}`);
      }

      if (orParts.length > 0) {
        const { data: fallback, error: fallbackErr } = await admin
          .from("mentor_preload")
          .select("id, employee_number, matched_profile_id")
          .eq("tenant", tenantTrim)
          .is("matched_profile_id", null)
          .or(orParts.join(","))
          .maybeSingle();

        if (fallbackErr) {
          rowResults.push({
            rowNumber,
            success: false,
            message: fallbackErr.message,
          });
          failed += 1;
          continue;
        }

        if (fallback) {
          fallbackMatch = fallback;
        }
      }
    }

    let preloadId: string | null = null;
    let matchedProfileId: string | null = null;
    let preloadMessage = "";

    if (existing?.id) {
      matchedProfileId = (existing.matched_profile_id as string | null) ?? null;
      const { data: beforeRow, error: beforeErr } = await admin
        .from("mentor_preload")
        .select(MENTOR_PRELOAD_COMPARE_SELECT)
        .eq("id", existing.id)
        .maybeSingle();

      if (beforeErr || !beforeRow) {
        rowResults.push({
          rowNumber,
          success: false,
          message: beforeErr?.message ?? "Could not load mentor preload row before update.",
        });
        failed += 1;
        continue;
      }

      const dataChanged = mentorPreloadUpdateDataChanged(
        beforeRow as MentorPreloadRowForCompare,
        updatePayload
      );

      const { error: updErr } = await admin.from("mentor_preload").update(updatePayload).eq("id", existing.id);
      if (updErr) {
        rowResults.push({ rowNumber, success: false, message: updErr.message });
        failed += 1;
        continue;
      }
      preloadId = existing.id;
      preloadMessage = dataChanged
        ? MENTORING_IMPORT_ROW_UPDATED_MESSAGE
        : MENTORING_IMPORT_ROW_NO_CHANGES_MESSAGE;
    } else if (fallbackMatch) {
      matchedProfileId = (fallbackMatch.matched_profile_id as string | null) ?? null;
      const { data: beforeRow, error: beforeErr } = await admin
        .from("mentor_preload")
        .select(MENTOR_PRELOAD_COMPARE_SELECT)
        .eq("id", fallbackMatch.id)
        .maybeSingle();

      if (beforeErr || !beforeRow) {
        rowResults.push({
          rowNumber,
          success: false,
          message: beforeErr?.message ?? "Could not load mentor preload row before update.",
        });
        failed += 1;
        continue;
      }

      const dataChanged = mentorPreloadUpdateDataChanged(
        beforeRow as MentorPreloadRowForCompare,
        updatePayload,
        { nextEmployeeNumber: emp }
      );

      const fallbackPatch = { ...updatePayload, employee_number: emp };
      const { error: updErr } = await admin
        .from("mentor_preload")
        .update(fallbackPatch)
        .eq("id", fallbackMatch.id);
      if (updErr) {
        rowResults.push({ rowNumber, success: false, message: updErr.message });
        failed += 1;
        continue;
      }
      preloadId = fallbackMatch.id;
      preloadMessage = dataChanged
        ? MENTORING_IMPORT_ROW_UPDATED_MESSAGE
        : MENTORING_IMPORT_ROW_NO_CHANGES_MESSAGE;
    } else {
      const { data: inserted, error: insErr } = await admin
        .from("mentor_preload")
        .insert({
          tenant: tenantTrim,
          employee_number: emp,
          ...insertPayload,
        })
        .select("id, matched_profile_id")
        .maybeSingle();
      if (insErr) {
        rowResults.push({ rowNumber, success: false, message: insErr.message });
        failed += 1;
        continue;
      }
      if (!inserted?.id) {
        rowResults.push({
          rowNumber,
          success: false,
          message: "Insert did not return mentor preload id.",
        });
        failed += 1;
        continue;
      }
      preloadId = inserted.id as string;
      matchedProfileId = (inserted.matched_profile_id as string | null) ?? null;
      preloadMessage = MENTORING_IMPORT_ROW_CREATED_MESSAGE;
    }

    if (preloadId == null) {
      rowResults.push({
        rowNumber,
        success: false,
        message: "Internal: mentor preload id missing after upsert.",
      });
      failed += 1;
      continue;
    }

    const regErr = await syncMentorRegistryForPreloadRow(admin, {
      preloadId,
      matchedProfileId,
      optionalPresent,
      values,
      nowIso,
    });
    if (regErr) {
      rowResults.push({
        rowNumber,
        success: false,
        message: `${preloadMessage}; mentor_registry: ${regErr}`,
      });
      failed += 1;
      continue;
    }

    rowResults.push({
      rowNumber,
      success: true,
      message: preloadMessage,
    });
    success += 1;
  }

  return {
    total: dataRows.length,
    success,
    failed,
    rows: rowResults,
  };
}

type ImportProgramParse =
  | { action: "omit" }
  | { action: "preserve" }
  | { action: "set"; categories: MentorRegistryTypeValue[] };

type ImportStatusParse =
  | { action: "omit" }
  | { action: "preserve" }
  | { action: "set"; status: MentorRegistryStatusValue };

/** Maps template `program` cell to categories; omit = column not in file; preserve = blank or unrecognized. */
function mentorPreloadImportParseProgram(columnPresent: boolean, raw: string): ImportProgramParse {
  if (!columnPresent) return { action: "omit" };
  const trimmed = raw.trim();
  if (!trimmed) return { action: "preserve" };
  const key = trimmed.toUpperCase().replace(/\s+/g, "_");
  switch (key) {
    case "NH":
      return { action: "set", categories: sortMentorRegistryCategories(["nh_mentor"]) };
    case "CA":
      return { action: "set", categories: sortMentorRegistryCategories(["captain_mentor"]) };
    case "BOTH":
      return {
        action: "set",
        categories: sortMentorRegistryCategories(["nh_mentor", "captain_mentor"]),
      };
    case "COMPANY":
      return { action: "set", categories: sortMentorRegistryCategories(["company_mentor"]) };
    case "POTENTIAL":
      return { action: "set", categories: sortMentorRegistryCategories(["potential_mentor"]) };
    default:
      return { action: "preserve" };
  }
}

/** Maps template `status` cell; omit / preserve same semantics as program. */
function mentorPreloadImportParseStatus(columnPresent: boolean, raw: string): ImportStatusParse {
  if (!columnPresent) return { action: "omit" };
  const trimmed = raw.trim();
  if (!trimmed) return { action: "preserve" };
  const key = trimmed.toUpperCase().replace(/\s+/g, "_");
  if (key === "ACTIVE") return { action: "set", status: "active" };
  if (key === "NON_ACTIVE") return { action: "set", status: "non_active" };
  if (key === "FORMER") return { action: "set", status: "former" };
  if (key === "ARCHIVED") return { action: "set", status: "archived" };
  return { action: "preserve" };
}

/**
 * When preload row is still unmatched, create/update mentor_registry by preload_id.
 * Does nothing if program and status columns are both absent, or neither yields a recognized non-blank value.
 */
async function syncMentorRegistryForPreloadRow(
  admin: SupabaseClient,
  args: {
    preloadId: string;
    matchedProfileId: string | null;
    optionalPresent: MentorPreloadCsvHeaderPresence;
    values: MentorPreloadCsvRowValues;
    nowIso: string;
  },
): Promise<string | undefined> {
  const { preloadId, matchedProfileId, optionalPresent, values, nowIso } = args;

  if (matchedProfileId) return undefined;

  if (!optionalPresent.program && !optionalPresent.status) return undefined;

  const programR = mentorPreloadImportParseProgram(optionalPresent.program, values.program);
  const statusR = mentorPreloadImportParseStatus(optionalPresent.status, values.status);

  const setProgram = programR.action === "set";
  const setStatus = statusR.action === "set";

  if (!setProgram && !setStatus) return undefined;

  const { data: reg, error: regSelErr } = await admin
    .from("mentor_registry")
    .select("id")
    .eq("preload_id", preloadId)
    .maybeSingle();

  if (regSelErr) return regSelErr.message;

  if (reg?.id) {
    const patch: Record<string, unknown> = { updated_at: nowIso };
    if (setProgram) {
      patch.mentor_categories = programR.categories;
      patch.mentor_type = deriveLegacyMentorTypeForSync(programR.categories);
    }
    if (setStatus) {
      patch.mentor_status = statusR.status;
    }
    const { error: uErr } = await admin.from("mentor_registry").update(patch).eq("id", reg.id);
    if (uErr) return uErr.message;
    return undefined;
  }

  const insert: Record<string, unknown> = {
    profile_id: null,
    preload_id: preloadId,
    updated_at: nowIso,
  };
  if (setProgram) {
    insert.mentor_categories = programR.categories;
    insert.mentor_type = deriveLegacyMentorTypeForSync(programR.categories);
  } else {
    insert.mentor_categories = [];
    insert.mentor_type = null;
  }
  if (setStatus) {
    insert.mentor_status = statusR.status;
  } else {
    insert.mentor_status = null;
  }

  const { error: iErr } = await admin.from("mentor_registry").insert(insert);
  if (iErr) return iErr.message;
  return undefined;
}
