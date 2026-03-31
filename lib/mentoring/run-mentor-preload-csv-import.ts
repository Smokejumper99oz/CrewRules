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

    let workEmail: string | null = null;
    if (optionalPresent.workEmail) {
      const workResult = normalizeMentorPreloadWorkEmailForAdmin(
        values[MENTOR_PRELOAD_CSV_WORK_EMAIL_HEADER],
      );
      if (!workResult.ok) {
        rowResults.push({
          rowNumber,
          status: "error",
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
          status: "error",
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
        status: "error",
        message: findErr.message,
      });
      failed += 1;
      continue;
    }

    let preloadId: string | null = null;
    let matchedProfileId: string | null = null;
    let preloadMessage = "";

    if (existing?.id) {
      matchedProfileId = (existing.matched_profile_id as string | null) ?? null;
      const { error: updErr } = await admin.from("mentor_preload").update(updatePayload).eq("id", existing.id);
      if (updErr) {
        rowResults.push({ rowNumber, status: "error", message: updErr.message });
        failed += 1;
        continue;
      }
      preloadId = existing.id;
      preloadMessage = "Updated mentor preload row";
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
        rowResults.push({ rowNumber, status: "error", message: insErr.message });
        failed += 1;
        continue;
      }
      if (!inserted?.id) {
        rowResults.push({
          rowNumber,
          status: "error",
          message: "Insert did not return mentor preload id.",
        });
        failed += 1;
        continue;
      }
      preloadId = inserted.id as string;
      matchedProfileId = (inserted.matched_profile_id as string | null) ?? null;
      preloadMessage = "Inserted mentor preload row";
    }

    if (preloadId == null) {
      rowResults.push({
        rowNumber,
        status: "error",
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
        status: "error",
        message: `${preloadMessage}; mentor_registry: ${regErr}`,
      });
      failed += 1;
      continue;
    }

    rowResults.push({
      rowNumber,
      status: "success",
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
