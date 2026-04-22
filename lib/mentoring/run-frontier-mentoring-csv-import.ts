import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedMentoringCsvOk } from "@/lib/mentoring/mentoring-csv-import";
import {
  normalizeHireDate,
  normalizeOptionalPersonalEmail,
  parseFrontierMentoringCsv,
} from "@/lib/mentoring/mentoring-csv-import";
import { upsertMentorAssignmentFromSuperAdmin } from "@/lib/mentoring/super-admin-sync-assignment";
import { createMilestonesForAssignment } from "@/lib/mentoring/create-milestones-for-assignment";

export type MentoringCsvImportRowDisplay = {
  menteeName: string;
  menteeEmployeeNumber: string;
  mentorEmployeeNumber: string;
  /** From `profiles.full_name` (live mentor) or `mentor_preload.full_name` when resolved during import. */
  mentorFullName?: string | null;
};

export type MentoringCsvImportRowResult = {
  rowNumber: number;
  success: boolean;
  message: string;
  /** Present for all rows from this runner; optional for older `row_results` JSON in history. */
  display?: MentoringCsvImportRowDisplay;
};

/** Tenant for single shared hire_date preflight (Frontier class uploads only). */
const FRONTIER_SINGLE_CLASS_HIRE_DATE_TENANT = "frontier";

/**
 * Rows that look like real class data: same gates as the import loop before per-row DB work
 * (blank rows skipped; hire + mentee name + mentee emp required; normalized hire_date required).
 */
function distinctNormalizedHireDatesForPreflight(rows: ParsedMentoringCsvOk["rows"]): Set<string> {
  const distinct = new Set<string>();
  for (const { values } of rows) {
    const mentorEmp = values.mentor_employee_number.trim();
    const hireRaw = values.hire_date.trim();
    const menteeName = values.mentee_full_name.trim();
    const menteeEmp = values.mentee_employee_number.trim();
    const allRequiredBlank = !mentorEmp && !hireRaw && !menteeName && !menteeEmp;
    if (allRequiredBlank) continue;
    if (!hireRaw || !menteeName || !menteeEmp) continue;
    const hireDateNorm = normalizeHireDate(hireRaw);
    if (!hireDateNorm) continue;
    distinct.add(hireDateNorm);
  }
  return distinct;
}

function rowDisplay(
  mentorEmployeeNumber: string,
  menteeEmployeeNumber: string,
  menteeFullName: string,
  mentorFullName?: string | null,
): MentoringCsvImportRowDisplay {
  const out: MentoringCsvImportRowDisplay = {
    menteeName: menteeFullName,
    menteeEmployeeNumber,
    mentorEmployeeNumber,
  };
  const m = mentorFullName?.trim();
  if (m) out.mentorFullName = m;
  return out;
}

/** Optional UI/meta: populated by server actions after file upload; runners return rows only. */
export type MentoringCsvImportMeta = {
  fileName: string;
  fileType: "csv" | "xlsx";
  uploadedAtIso: string;
  totalRows: number;
  successCount: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
};

export type MentoringCsvImportResult = {
  rows: MentoringCsvImportRowResult[];
  fatalError?: string;
  meta?: MentoringCsvImportMeta;
};

/**
 * Shared CSV import body: parses Frontier mentoring template, resolves mentors/mentees
 * by employee number within `tenant`, upserts assignments and milestones.
 * Mentees may exist without a CrewRules profile or airline email; linking uses `employee_number` on signup.
 * Blank `mentor_employee_number` imports as unassigned (no mentor on the assignment row).
 */
export async function runFrontierMentoringCsvImport(
  admin: SupabaseClient,
  tenant: string,
  csvText: string,
  /** When set, mentee profile resolution is scoped to this CrewRules portal (matches `profiles.portal`). */
  mentoringPortal?: string | null
): Promise<MentoringCsvImportResult> {
  const portalForMenteeLookup =
    mentoringPortal != null && String(mentoringPortal).trim() !== ""
      ? String(mentoringPortal).trim()
      : null;
  const parsed = parseFrontierMentoringCsv(csvText);
  if (!parsed.ok) {
    return { rows: [], fatalError: parsed.error };
  }

  if (tenant === FRONTIER_SINGLE_CLASS_HIRE_DATE_TENANT) {
    const distinctHire = distinctNormalizedHireDatesForPreflight(parsed.data.rows);
    if (distinctHire.size > 1) {
      const sorted = [...distinctHire].sort();
      return {
        rows: [],
        fatalError: `Frontier class imports must use one shared Hire Date for every row in the file. This upload has ${distinctHire.size} different dates: ${sorted.join(", ")}. Fix the spreadsheet so all rows use the same date, then try again.`,
      };
    }
  }

  const results: MentoringCsvImportRowResult[] = [];
  const seenMenteeEmp = new Set<string>();

  for (const { rowNumber, values } of parsed.data.rows) {
    const mentorEmp = values.mentor_employee_number.trim();
    const hireRaw = values.hire_date.trim();
    const menteeName = values.mentee_full_name.trim();
    const menteeEmp = values.mentee_employee_number.trim();
    const phoneRaw = values.mentee_phone.trim();
    const notesRaw = values.notes.trim();
    const privateRaw = values["mentee_email@private"];

    const allRequiredBlank = !mentorEmp && !hireRaw && !menteeName && !menteeEmp;
    if (allRequiredBlank) {
      continue;
    }

    if (!hireRaw) {
      results.push({
        rowNumber,
        success: false,
        message: "hire_date is required.",
        display: rowDisplay(mentorEmp, menteeEmp, menteeName),
      });
      continue;
    }
    const hireDateNorm = normalizeHireDate(hireRaw);
    if (!hireDateNorm) {
      results.push({
        rowNumber,
        success: false,
        message: "hire_date must be YYYY-MM-DD or M/D/YYYY (e.g. 3/15/2024).",
        display: rowDisplay(mentorEmp, menteeEmp, menteeName),
      });
      continue;
    }
    if (!menteeName) {
      results.push({
        rowNumber,
        success: false,
        message: "mentee_full_name is required.",
        display: rowDisplay(mentorEmp, menteeEmp, menteeName),
      });
      continue;
    }
    if (!menteeEmp) {
      results.push({
        rowNumber,
        success: false,
        message: "mentee_employee_number is required.",
        display: rowDisplay(mentorEmp, menteeEmp, menteeName),
      });
      continue;
    }

    if (seenMenteeEmp.has(menteeEmp)) {
      results.push({
        rowNumber,
        success: false,
        message: `Duplicate mentee_employee_number in file: ${menteeEmp}`,
        display: rowDisplay(mentorEmp, menteeEmp, menteeName),
      });
      continue;
    }
    seenMenteeEmp.add(menteeEmp);

    const privateNormResult = normalizeOptionalPersonalEmail(privateRaw);
    if (!privateNormResult.ok) {
      results.push({
        rowNumber,
        success: false,
        message: privateNormResult.error,
        display: rowDisplay(mentorEmp, menteeEmp, menteeName),
      });
      continue;
    }
    const privateNorm = privateNormResult.email;

    let mentorUserId: string | null = null;
    let mentorFullNameForDisplay: string | null = null;
    if (mentorEmp) {
      const { data: mentorProfile, error: mentorErr } = await admin
        .from("profiles")
        .select("id, full_name")
        .eq("tenant", tenant)
        .eq("employee_number", mentorEmp)
        .is("deleted_at", null)
        .maybeSingle();

      if (mentorErr) {
        results.push({
          rowNumber,
          success: false,
          message: mentorErr.message,
          display: rowDisplay(mentorEmp, menteeEmp, menteeName),
        });
        continue;
      }

      mentorUserId = mentorProfile?.id ?? null;
      if (mentorUserId) {
        mentorFullNameForDisplay = (mentorProfile?.full_name ?? "").trim() || null;
      } else {
        const { data: preloadRow, error: preloadErr } = await admin
          .from("mentor_preload")
          .select("id, full_name")
          .eq("tenant", tenant)
          .eq("employee_number", mentorEmp)
          .maybeSingle();

        if (preloadErr) {
          results.push({
            rowNumber,
            success: false,
            message: preloadErr.message,
            display: rowDisplay(mentorEmp, menteeEmp, menteeName),
          });
          continue;
        }
        if (!preloadRow?.id) {
          results.push({
            rowNumber,
            success: false,
            message: `No mentor with employee_number "${mentorEmp}" in this tenant (no live profile or mentor roster row).`,
            display: rowDisplay(mentorEmp, menteeEmp, menteeName),
          });
          continue;
        }
        mentorFullNameForDisplay = (preloadRow.full_name ?? "").trim() || null;
      }
    }

    let existingMenteeQuery = admin
      .from("profiles")
      .select("id")
      .eq("tenant", tenant)
      .eq("employee_number", menteeEmp)
      .is("deleted_at", null);
    if (portalForMenteeLookup) {
      existingMenteeQuery = existingMenteeQuery.eq("portal", portalForMenteeLookup);
    }
    const { data: existingMentee, error: menteeLookupErr } = await existingMenteeQuery.maybeSingle();

    if (menteeLookupErr) {
      results.push({
        rowNumber,
        success: false,
        message: menteeLookupErr.message,
        display: rowDisplay(mentorEmp, menteeEmp, menteeName),
      });
      continue;
    }

    let menteeId: string | null = existingMentee?.id ?? null;

    if (existingMentee?.id) {
      const profilePatch: Record<string, unknown> = {};
      if (menteeName) profilePatch.full_name = menteeName;
      if (phoneRaw) profilePatch.phone = phoneRaw;
      if (privateNorm) profilePatch.personal_email = privateNorm;

      if (Object.keys(profilePatch).length > 0) {
        const { error: updProfErr } = await admin
          .from("profiles")
          .update(profilePatch)
          .eq("id", existingMentee.id);
        if (updProfErr) {
          results.push({
            rowNumber,
            success: false,
            message: updProfErr.message,
            display: rowDisplay(mentorEmp, menteeEmp, menteeName, mentorFullNameForDisplay),
          });
          continue;
        }
      }
    }

    if (mentorUserId && menteeId && menteeId === mentorUserId) {
      results.push({
        rowNumber,
        success: false,
        message: "Mentor and mentee cannot be the same user.",
        display: rowDisplay(mentorEmp, menteeEmp, menteeName),
      });
      continue;
    }
    if (!mentorUserId && mentorEmp && mentorEmp === menteeEmp) {
      results.push({
        rowNumber,
        success: false,
        message: "Mentor and mentee cannot be the same employee number.",
        display: rowDisplay(mentorEmp, menteeEmp, menteeName),
      });
      continue;
    }

    const sync = await upsertMentorAssignmentFromSuperAdmin(admin, {
      mentorUserId,
      mentorEmployeeNumber: mentorEmp || null,
      menteeEmployeeNumber: menteeEmp,
      tenant,
      ...(portalForMenteeLookup ? { portal: portalForMenteeLookup } : {}),
      hireDate: hireDateNorm,
      notes: notesRaw,
      menteeDisplayName: menteeName,
      menteePersonalEmail: privateNorm,
      menteePhone: (phoneRaw ?? "").trim() || null,
      allowMenteeWithoutProfile: true,
    });

    if ("error" in sync) {
      results.push({
        rowNumber,
        success: false,
        message: sync.error,
        display: rowDisplay(mentorEmp, menteeEmp, menteeName, mentorFullNameForDisplay),
      });
      continue;
    }

    const rowMessage = sync.created
      ? "Created (new assignment)"
      : sync.updated
        ? "Updated (filled missing data)"
        : "No changes (already up to date)";

    const assignmentLookup = mentorUserId
      ? await admin
          .from("mentor_assignments")
          .select("id")
          .eq("mentor_user_id", mentorUserId)
          .eq("employee_number", menteeEmp)
          .maybeSingle()
      : mentorEmp
        ? await admin
            .from("mentor_assignments")
            .select("id")
            .is("mentor_user_id", null)
            .eq("mentor_employee_number", mentorEmp)
            .eq("employee_number", menteeEmp)
            .maybeSingle()
        : await admin
            .from("mentor_assignments")
            .select("id")
            .is("mentor_user_id", null)
            .is("mentor_employee_number", null)
            .eq("employee_number", menteeEmp)
            .maybeSingle();

    const { data: assignmentRow, error: assignmentLookupErr } = assignmentLookup;

    if (assignmentLookupErr || !assignmentRow?.id) {
      results.push({
        rowNumber,
        success: false,
        message:
          assignmentLookupErr?.message ??
          "Assignment saved but could not resolve assignment id for milestones.",
        display: rowDisplay(mentorEmp, menteeEmp, menteeName, mentorFullNameForDisplay),
      });
      continue;
    }

    const milestoneResult = await createMilestonesForAssignment(assignmentRow.id, hireDateNorm);
    if (milestoneResult.error) {
      results.push({
        rowNumber,
        success: false,
        message: milestoneResult.error,
        display: rowDisplay(mentorEmp, menteeEmp, menteeName, mentorFullNameForDisplay),
      });
      continue;
    }

    results.push({
      rowNumber,
      success: true,
      message: rowMessage,
      display: rowDisplay(mentorEmp, menteeEmp, menteeName, mentorFullNameForDisplay),
    });
  }

  return { rows: results };
}
