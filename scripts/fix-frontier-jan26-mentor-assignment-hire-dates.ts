/**
 * One-off: set mentor_assignments.hire_date to 2026-01-26 for Frontier Jan 26 class band
 * where assignment.employee_number is in [445182, 445193] and hire_date is not already that date.
 *
 * Scope: assignment rows only (mentee_user_id may be null — profiles filter does not apply).
 *
 * Usage: npx tsx scripts/fix-frontier-jan26-mentor-assignment-hire-dates.ts
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { createAdminClient } from "../lib/supabase/admin";
import {
  loadFrontierPilotMenteeRosterPageData,
  rosterAuditNormalizedDohKey,
} from "../lib/mentoring/frontier-mentee-roster-load";

const EMP_MIN = 445182;
const EMP_MAX = 445193;
const TARGET_EMPS = Array.from({ length: EMP_MAX - EMP_MIN + 1 }, (_, i) => String(EMP_MIN + i));

const EXPECTED = "2026-01-26";

function normEmp(e: string | null | undefined) {
  return (e ?? "").trim();
}

function hireKey(d: string | null | undefined) {
  if (d == null || !String(d).trim()) return null;
  return String(d).trim().slice(0, 10);
}

async function main() {
  const admin = createAdminClient();

  const { data: assignments, error: aErr } = await admin
    .from("mentor_assignments")
    .select("id, employee_number, hire_date, mentee_user_id")
    .in("employee_number", TARGET_EMPS);

  if (aErr) throw aErr;

  const scoped = assignments ?? [];

  const alreadyOk = scoped.filter((a) => hireKey(a.hire_date) === EXPECTED);
  const toFix = scoped.filter((a) => hireKey(a.hire_date) !== EXPECTED);

  console.log(
    JSON.stringify(
      {
        step: "before",
        assignments_in_band: scoped.length,
        already_2026_01_26: alreadyOk.map((r) => ({
          id: r.id,
          employee_number: normEmp(r.employee_number),
          hire_date: r.hire_date,
        })),
        will_update: toFix.map((r) => ({
          id: r.id,
          employee_number: normEmp(r.employee_number),
          hire_date_before: r.hire_date,
        })),
      },
      null,
      2,
    ),
  );

  if (toFix.length === 0) {
    console.log("Nothing to update (all assignments in band already 2026-01-26).");
  } else {
    const ids = toFix.map((r) => r.id);
    const { error: uErr } = await admin.from("mentor_assignments").update({ hire_date: EXPECTED }).in("id", ids);

    if (uErr) throw uErr;
    console.log(JSON.stringify({ step: "update", rows_updated: ids.length }, null, 2));
  }

  const { data: afterRows } = await admin
    .from("mentor_assignments")
    .select("id, employee_number, hire_date")
    .in("employee_number", TARGET_EMPS);

  console.log(
    JSON.stringify(
      {
        step: "after_assignments",
        rows: (afterRows ?? []).map((r) => ({
          id: r.id,
          employee_number: normEmp(r.employee_number),
          hire_date: r.hire_date,
        })),
      },
      null,
      2,
    ),
  );

  const { dohAudit } = await loadFrontierPilotMenteeRosterPageData({
    collectDohAudit: true,
    emitDohAuditToConsole: false,
  });

  const targetSet = new Set(TARGET_EMPS);
  const classAudit = dohAudit.filter((r) => targetSet.has(normEmp(r.employee_number)));

  const bad = classAudit.filter((r) => rosterAuditNormalizedDohKey(r.final_hire_date_used) !== EXPECTED);

  console.log(
    JSON.stringify(
      {
        step: "audit_class_band",
        rows: classAudit.length,
        all_final_2026_01_26: bad.length === 0,
        detail: classAudit.map((r) => ({
          name: r.name,
          employee_number: r.employee_number,
          final_hire_date_used: r.final_hire_date_used,
          profiles_date_of_hire: r.profiles_date_of_hire,
          mentor_assignments_hire_date: r.mentor_assignments_hire_date,
          source_won: r.source_won,
        })),
        bad_if_any: bad,
      },
      null,
      2,
    ),
  );

  if (bad.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
