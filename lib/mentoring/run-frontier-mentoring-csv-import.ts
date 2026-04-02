import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeHireDate,
  normalizeMenteeCompanyEmail,
  normalizeOptionalPersonalEmail,
  parseFrontierMentoringCsv,
} from "@/lib/mentoring/mentoring-csv-import";
import { upsertMentorAssignmentFromSuperAdmin } from "@/lib/mentoring/super-admin-sync-assignment";
import { createMilestonesForAssignment } from "@/lib/mentoring/create-milestones-for-assignment";
import {
  isProfileEmployeeNumberTaken,
  PROFILE_EMPLOYEE_NUMBER_TAKEN_ERROR,
} from "@/lib/profiles/employee-number-taken";

export type MentoringCsvImportRowDisplay = {
  menteeName: string;
  menteeEmployeeNumber: string;
  mentorEmployeeNumber: string;
};

export type MentoringCsvImportRowResult = {
  rowNumber: number;
  success: boolean;
  message: string;
  /** Present for all rows from this runner; optional for older `row_results` JSON in history. */
  display?: MentoringCsvImportRowDisplay;
};

function rowDisplay(
  mentorEmployeeNumber: string,
  menteeEmployeeNumber: string,
  menteeFullName: string,
): MentoringCsvImportRowDisplay {
  return {
    menteeName: menteeFullName,
    menteeEmployeeNumber,
    mentorEmployeeNumber,
  };
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
 */
export async function runFrontierMentoringCsvImport(
  admin: SupabaseClient,
  tenant: string,
  csvText: string
): Promise<MentoringCsvImportResult> {
  const parsed = parseFrontierMentoringCsv(csvText);
  if (!parsed.ok) {
    return { rows: [], fatalError: parsed.error };
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
    const companyRaw = values["mentee_email@flyfrontier.com"];
    const privateRaw = values["mentee_email@private"];

    const allRequiredBlank = !mentorEmp && !hireRaw && !menteeName && !menteeEmp;
    if (allRequiredBlank) {
      continue;
    }

    if (!mentorEmp) {
      results.push({
        rowNumber,
        success: false,
        message: "mentor_employee_number is required.",
        display: rowDisplay(mentorEmp, menteeEmp, menteeName),
      });
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
    const companyNorm = normalizeMenteeCompanyEmail(companyRaw);

    const { data: mentorProfile, error: mentorErr } = await admin
      .from("profiles")
      .select("id")
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

    let mentorUserId: string | null = mentorProfile?.id ?? null;
    if (!mentorUserId) {
      const { data: preloadRow, error: preloadErr } = await admin
        .from("mentor_preload")
        .select("id")
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
    }

    const { data: existingMentee, error: menteeLookupErr } = await admin
      .from("profiles")
      .select("id")
      .eq("tenant", tenant)
      .eq("employee_number", menteeEmp)
      .is("deleted_at", null)
      .maybeSingle();

    if (menteeLookupErr) {
      results.push({
        rowNumber,
        success: false,
        message: menteeLookupErr.message,
        display: rowDisplay(mentorEmp, menteeEmp, menteeName),
      });
      continue;
    }

    let menteeId: string;

    if (existingMentee?.id) {
      menteeId = existingMentee.id;

      const profilePatch: Record<string, unknown> = {};
      if (menteeName) profilePatch.full_name = menteeName;
      if (phoneRaw) profilePatch.phone = phoneRaw;
      if (privateNorm) profilePatch.personal_email = privateNorm;

      if (Object.keys(profilePatch).length > 0) {
        const { error: updProfErr } = await admin.from("profiles").update(profilePatch).eq("id", menteeId);
        if (updProfErr) {
          results.push({
            rowNumber,
            success: false,
            message: updProfErr.message,
            display: rowDisplay(mentorEmp, menteeEmp, menteeName),
          });
          continue;
        }
      }
    } else {
      const authEmail = companyNorm;
      if (!authEmail || !authEmail.toLowerCase().endsWith("@flyfrontier.com")) {
        results.push({
          rowNumber,
          success: false,
          message: "Mentee must have a valid @flyfrontier.com email to create an account.",
          display: rowDisplay(mentorEmp, menteeEmp, menteeName),
        });
        continue;
      }

      const takenRes = await isProfileEmployeeNumberTaken(admin, {
        tenant,
        portal: "pilots",
        employeeNumberTrimmed: menteeEmp,
        excludeProfileId: null,
      });
      if (takenRes.error) {
        results.push({
          rowNumber,
          success: false,
          message: takenRes.error,
          display: rowDisplay(mentorEmp, menteeEmp, menteeName),
        });
        continue;
      }
      if (takenRes.taken) {
        results.push({
          rowNumber,
          success: false,
          message: PROFILE_EMPLOYEE_NUMBER_TAKEN_ERROR,
          display: rowDisplay(mentorEmp, menteeEmp, menteeName),
        });
        continue;
      }

      const tempPassword = randomBytes(24).toString("base64url");
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: authEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: menteeName,
          employee_number: menteeEmp,
          tenant,
          portal: "pilots",
          role: "pilot",
        },
      });

      if (createErr || !created.user?.id) {
        results.push({
          rowNumber,
          success: false,
          message: createErr?.message ?? "Failed to create user for mentee.",
          display: rowDisplay(mentorEmp, menteeEmp, menteeName),
        });
        continue;
      }

      menteeId = created.user.id;

      const profilePatch: Record<string, unknown> = {
        full_name: menteeName,
        employee_number: menteeEmp,
      };
      if (phoneRaw) profilePatch.phone = phoneRaw;
      if (privateNorm) profilePatch.personal_email = privateNorm;

      const { error: updProfErr } = await admin.from("profiles").update(profilePatch).eq("id", menteeId);
      if (updProfErr) {
        results.push({
          rowNumber,
          success: false,
          message: updProfErr.message,
          display: rowDisplay(mentorEmp, menteeEmp, menteeName),
        });
        continue;
      }
    }

    if (mentorUserId && menteeId === mentorUserId) {
      results.push({
        rowNumber,
        success: false,
        message: "Mentor and mentee cannot be the same user.",
        display: rowDisplay(mentorEmp, menteeEmp, menteeName),
      });
      continue;
    }
    if (!mentorUserId && mentorEmp === menteeEmp) {
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
      mentorEmployeeNumber: mentorEmp,
      menteeEmployeeNumber: menteeEmp,
      tenant,
      hireDate: hireDateNorm,
      notes: notesRaw,
      menteeDisplayName: menteeName,
      menteePersonalEmail: privateNorm,
      menteePhone: (phoneRaw ?? "").trim() || null,
    });

    if ("error" in sync) {
      results.push({
        rowNumber,
        success: false,
        message: sync.error,
        display: rowDisplay(mentorEmp, menteeEmp, menteeName),
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
      : await admin
          .from("mentor_assignments")
          .select("id")
          .is("mentor_user_id", null)
          .eq("mentor_employee_number", mentorEmp)
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
        display: rowDisplay(mentorEmp, menteeEmp, menteeName),
      });
      continue;
    }

    const milestoneResult = await createMilestonesForAssignment(assignmentRow.id, hireDateNorm);
    if (milestoneResult.error) {
      results.push({
        rowNumber,
        success: false,
        message: milestoneResult.error,
        display: rowDisplay(mentorEmp, menteeEmp, menteeName),
      });
      continue;
    }

    results.push({
      rowNumber,
      success: true,
      message: rowMessage,
      display: rowDisplay(mentorEmp, menteeEmp, menteeName),
    });
  }

  return { rows: results };
}
