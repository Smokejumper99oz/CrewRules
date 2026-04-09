/**
 * Read-only audit: classify all Frontier pilot mentee roster rows with status "unassigned".
 * Does not change application logic.
 *
 * Usage: npx tsx scripts/audit-frontier-unassigned-mentees.ts
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { createAdminClient } from "@/lib/supabase/admin";
import { loadFrontierPilotMenteeRosterPageData } from "@/lib/mentoring/frontier-mentee-roster-load";

type Bucket = "synthetic_no_assignment" | "assignment_no_mentor" | "INVALID_partial_data";

type RowOut = {
  name: string;
  employee_number: string;
  DOH: string | null;
  assignment_id: string;
  mentor_user_id: string | null;
  mentor_employee_number: string | null;
  mentee_user_id: string | null;
  bucket: Bucket;
};

function isEmptyMentorField(v: string | null | undefined): boolean {
  return (v ?? "").trim().length === 0;
}

async function main() {
  const { roster } = await loadFrontierPilotMenteeRosterPageData({
    collectDohAudit: false,
    emitDohAuditToConsole: false,
  });

  const unassigned = roster.filter((r) => r.status === "unassigned");
  const assignmentIds = [
    ...new Set(
      unassigned.map((r) => r.assignment_id).filter((id): id is string => id != null && id.length > 0)
    ),
  ];

  const admin = createAdminClient();
  const assignmentById = new Map<
    string,
    { mentor_user_id: string | null; mentor_employee_number: string | null; mentee_user_id: string | null }
  >();

  if (assignmentIds.length > 0) {
    const { data, error } = await admin
      .from("mentor_assignments")
      .select("id, mentor_user_id, mentor_employee_number, mentee_user_id")
      .in("id", assignmentIds);

    if (error) {
      console.error("audit: mentor_assignments query failed:", error.message);
      process.exit(1);
    }
    for (const raw of data ?? []) {
      const row = raw as {
        id: string;
        mentor_user_id: string | null;
        mentor_employee_number: string | null;
        mentee_user_id: string | null;
      };
      assignmentById.set(row.id, {
        mentor_user_id: row.mentor_user_id,
        mentor_employee_number: row.mentor_employee_number,
        mentee_user_id: row.mentee_user_id,
      });
    }
  }

  const rows: RowOut[] = [];
  let assignment_no_mentor = 0;
  let synthetic_no_assignment = 0;
  let invalid_partial_data = 0;

  for (const r of unassigned) {
    if (r.assignment_id == null) {
      synthetic_no_assignment += 1;
      rows.push({
        name: r.name,
        employee_number: r.employee_number,
        DOH: r.hire_date,
        assignment_id: "synthetic",
        mentor_user_id: null,
        mentor_employee_number: null,
        mentee_user_id: null,
        bucket: "synthetic_no_assignment",
      });
      continue;
    }

    const am = assignmentById.get(r.assignment_id);
    if (!am) {
      invalid_partial_data += 1;
      rows.push({
        name: r.name,
        employee_number: r.employee_number,
        DOH: r.hire_date,
        assignment_id: r.assignment_id,
        mentor_user_id: null,
        mentor_employee_number: null,
        mentee_user_id: null,
        bucket: "INVALID_partial_data",
      });
      continue;
    }

    const mentorUserEmpty = isEmptyMentorField(am.mentor_user_id);
    const mentorEmpEmpty = isEmptyMentorField(am.mentor_employee_number);

    if (mentorUserEmpty && mentorEmpEmpty) {
      assignment_no_mentor += 1;
      rows.push({
        name: r.name,
        employee_number: r.employee_number,
        DOH: r.hire_date,
        assignment_id: r.assignment_id,
        mentor_user_id: am.mentor_user_id,
        mentor_employee_number: am.mentor_employee_number,
        mentee_user_id: am.mentee_user_id,
        bucket: "assignment_no_mentor",
      });
    } else {
      invalid_partial_data += 1;
      rows.push({
        name: r.name,
        employee_number: r.employee_number,
        DOH: r.hire_date,
        assignment_id: r.assignment_id,
        mentor_user_id: am.mentor_user_id,
        mentor_employee_number: am.mentor_employee_number,
        mentee_user_id: am.mentee_user_id,
        bucket: "INVALID_partial_data",
      });
    }
  }

  console.log("\n=== Frontier pilot unassigned mentees audit ===\n");
  console.table(rows);

  console.log("\n--- Totals ---");
  console.log(`total_unassigned:        ${unassigned.length}`);
  console.log(`assignment_no_mentor:    ${assignment_no_mentor}`);
  console.log(`synthetic_no_assignment: ${synthetic_no_assignment}`);
  console.log(`invalid_partial_data:    ${invalid_partial_data}`);
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
