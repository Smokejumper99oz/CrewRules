/**
 * Runs the same DOH audit collection as Frontier Mentee Roster (Supabase admin, no browser).
 * Usage: npx tsx scripts/run-mentee-roster-doh-audit.ts
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import {
  loadFrontierPilotMenteeRosterPageData,
  rosterAuditNormalizedDohKey,
  type DohAuditEntry,
} from "../lib/mentoring/frontier-mentee-roster-load";

const EXPECTED_CLASS_KEY = "2026-01-26";

/** Same as Class filter: any row whose cohort key is not 2026-01-26 is "bad" for single-class roster. */
function isBadRow(r: DohAuditEntry): boolean {
  return rosterAuditNormalizedDohKey(r.final_hire_date_used) !== EXPECTED_CLASS_KEY;
}

async function main() {
  const { dohAudit } = await loadFrontierPilotMenteeRosterPageData({
    collectDohAudit: true,
    emitDohAuditToConsole: false,
  });

  const bad = dohAudit.filter(isBadRow);
  const byDate = new Map<string, DohAuditEntry[]>();
  for (const r of bad) {
    const k = rosterAuditNormalizedDohKey(r.final_hire_date_used);
    const list = byDate.get(k) ?? [];
    list.push(r);
    byDate.set(k, list);
  }
  const dates = [...byDate.keys()].sort();

  console.log(JSON.stringify({ total_audit_rows: dohAudit.length, bad_rows: bad.length, bad_dates: dates }, null, 2));
  for (const d of dates) {
    console.log("\n===", d, "===");
    for (const r of byDate.get(d)!) {
      console.log(
        JSON.stringify({
          name: r.name,
          employee_number: r.employee_number,
          row_kind: r.rowKind,
          assignment_id: r.assignment_id,
          profiles_date_of_hire: r.profiles_date_of_hire,
          mentor_assignments_hire_date: r.mentor_assignments_hire_date,
          final_hire_date_used: r.final_hire_date_used,
          source_won: r.source_won,
        }),
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
