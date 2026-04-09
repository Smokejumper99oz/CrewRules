/**
 * One-off: roster rows where mentor_name contains "Folmer" + class key vs Jan 26, 2026.
 * Uses the same loader as the Mentee Roster page (Frontier pilots).
 *
 * Usage: npx tsx scripts/audit-mentee-roster-folmer-class.ts
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import type { MenteeRosterRow } from "@/app/frontier/pilots/admin/mentoring/mentee-roster-table";
import {
  loadFrontierPilotMenteeRosterPageData,
  rosterAuditNormalizedDohKey,
  type DohAuditEntry,
} from "@/lib/mentoring/frontier-mentee-roster-load";

const NEEDLE = "folmer";
const CLASS_FILTER = "2026-01-26";

/** Mirrors mentee-roster-table Class filter: cohort key or null (table returns null for no/unparseable DOH). */
function hireDateToYyyyMmDdLikeTable(value: string | null | undefined): string | null {
  const k = rosterAuditNormalizedDohKey(value);
  if (k === "(no DOH)" || k.startsWith("(unparsed:")) return null;
  return k;
}

function findAuditForRosterRow(r: MenteeRosterRow, audit: DohAuditEntry[]): DohAuditEntry | undefined {
  if (r.assignment_id == null) {
    return audit.find((a) => a.rowKind === "synthetic" && a.employee_number.trim() === r.employee_number.trim());
  }
  return audit.find((a) => a.assignment_id === r.assignment_id);
}

async function main() {
  const { roster, dohAudit } = await loadFrontierPilotMenteeRosterPageData({
    collectDohAudit: true,
    emitDohAuditToConsole: false,
  });

  const folmerRows = roster.filter((r) => (r.mentor_name ?? "").toLowerCase().includes(NEEDLE));

  const details = folmerRows.map((r) => {
    const a = findAuditForRosterRow(r, dohAudit);
    const classKey = hireDateToYyyyMmDdLikeTable(r.hire_date);
    const matchesJan26 = classKey === CLASS_FILTER;
    return {
      roster_key: r.key,
      mentee_name: r.name,
      employee_number: r.employee_number,
      mentor_name: r.mentor_name,
      row_kind: a?.rowKind ?? "(no audit match)",
      profiles_date_of_hire: a?.profiles_date_of_hire ?? null,
      mentor_assignments_hire_date: a?.mentor_assignments_hire_date ?? null,
      final_roster_hire_date: r.hire_date,
      normalized_class_key: classKey,
      matches_class_filter_2026_01_26: matchesJan26,
      source_won: a?.source_won ?? null,
    };
  });

  const jan26Count = details.filter((d) => d.matches_class_filter_2026_01_26).length;

  console.log(
    JSON.stringify(
      {
        class_filter_tested: CLASS_FILTER,
        folmer_row_count: folmerRows.length,
        folmer_rows_matching_jan_26_class: jan26Count,
        rows: details,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
