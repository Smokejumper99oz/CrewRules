import type { SupabaseClient } from "@supabase/supabase-js";
import { getMilestoneScheduleForHireDate } from "@/lib/mentoring/create-milestones-for-assignment";

/** PostgREST returns at most 1000 rows per request unless paged. */
const INTEGRITY_SCAN_PAGE = 1000;

export type MentoringMilestoneIntegrityScan = {
  /** assignment_id values with type_rating row but no oe_complete row */
  typeRatingWithoutOeCompleteAssignmentIds: string[];
  /** assignment_id with a valid hire_date on the assignment but missing ≥1 standard program milestone type */
  hireDateMissingAnyStandardMilestoneAssignmentIds: string[];
  /** subset of type_rating without oe where assignment has no usable hire_date (cannot schedule-seed) */
  typeRatingWithoutOeMissingHireDateAssignmentIds: string[];
  /**
   * Row counts from the paged fetches. Must equal full table size so every assignment’s milestone types
   * are present in `milestoneByAssignment` (avoids the default ~1000-row cap false positives).
   */
  mentorAssignmentsRowsFetched: number;
  milestoneRowsFetched: number;
  /**
   * Assignments with valid hire + ok schedule and no milestone rows in DB for that `assignment_id`
   * (genuine “no rows” gaps, counted for diagnostics only).
   */
  hireDateAssignmentsWithNoMilestoneRows: number;
};

/** `buildMentoringMilestoneIntegrityScan` result before row counts are attached in `fetch`. */
export type MentoringMilestoneIntegrityScanCore = Omit<
  MentoringMilestoneIntegrityScan,
  "mentorAssignmentsRowsFetched" | "milestoneRowsFetched"
>;

function milestoneByAssignment(
  rows: Array<{ assignment_id: string; milestone_type: string }>,
): Map<string, Set<string>> {
  const byAid = new Map<string, Set<string>>();
  for (const r of rows) {
    const aid = String(r.assignment_id);
    const mt = String(r.milestone_type);
    if (!byAid.has(aid)) byAid.set(aid, new Set());
    byAid.get(aid)!.add(mt);
  }
  return byAid;
}

/**
 * Inputs: full `mentor_assignments` and `mentorship_milestones` lists (no PostgREST row cap).
 * Same integrity rules as super-admin backfill follow-up diagnostics (hire + standard schedule).
 */
export function buildMentoringMilestoneIntegrityScan(params: {
  assignments: Array<{ id: string; hire_date: string | null }>;
  milestoneRows: Array<{ assignment_id: string; milestone_type: string }>;
}): MentoringMilestoneIntegrityScanCore {
  const byAid = milestoneByAssignment(params.milestoneRows);
  const hireById = new Map(
    params.assignments.map((a) => [String(a.id), (a.hire_date as string | null) ?? ""]),
  );

  const typeRatingWithoutOeCompleteAssignmentIds: string[] = [];
  const hireDateMissingAnyStandardMilestoneAssignmentIds: string[] = [];
  const typeRatingWithoutOeMissingHireDateAssignmentIds: string[] = [];

  for (const [aid, types] of byAid) {
    const hasTr = types.has("type_rating");
    const hasOe = types.has("oe_complete");
    if (hasTr && !hasOe) {
      typeRatingWithoutOeCompleteAssignmentIds.push(aid);
      const hireRaw = (hireById.get(aid) ?? "").trim();
      const hireYmd = hireRaw.slice(0, 10);
      const scheduleOk =
        /^\d{4}-\d{2}-\d{2}$/.test(hireYmd) && getMilestoneScheduleForHireDate(hireYmd).ok;
      if (!scheduleOk) {
        typeRatingWithoutOeMissingHireDateAssignmentIds.push(aid);
      }
    }
  }

  let hireDateAssignmentsWithNoMilestoneRows = 0;
  for (const row of params.assignments) {
    const aid = String(row.id);
    const hireRaw = (row.hire_date as string | null) ?? "";
    const hireYmd = hireRaw.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(hireYmd)) continue;
    const schedule = getMilestoneScheduleForHireDate(hireYmd);
    if (!schedule.ok) continue;
    if (!byAid.has(aid)) {
      hireDateAssignmentsWithNoMilestoneRows += 1;
    }
    const types = byAid.get(aid) ?? new Set<string>();
    const missing = schedule.entries.some((e) => !types.has(e.milestone_type));
    if (missing) {
      hireDateMissingAnyStandardMilestoneAssignmentIds.push(aid);
    }
  }

  return {
    typeRatingWithoutOeCompleteAssignmentIds,
    hireDateMissingAnyStandardMilestoneAssignmentIds,
    typeRatingWithoutOeMissingHireDateAssignmentIds,
    hireDateAssignmentsWithNoMilestoneRows,
  };
}

export async function fetchMentoringMilestoneIntegrityScan(
  admin: SupabaseClient,
): Promise<MentoringMilestoneIntegrityScan | { error: string }> {
  const assignments: Array<{ id: string; hire_date: string | null }> = [];
  let aFrom = 0;
  for (;;) {
    const { data, error: aErr } = await admin
      .from("mentor_assignments")
      .select("id, hire_date")
      .range(aFrom, aFrom + INTEGRITY_SCAN_PAGE - 1);
    if (aErr) return { error: aErr.message };
    const batch = (data ?? []) as Array<{ id: string; hire_date: string | null }>;
    assignments.push(...batch);
    if (batch.length < INTEGRITY_SCAN_PAGE) break;
    aFrom += INTEGRITY_SCAN_PAGE;
  }

  const milestoneRows: Array<{ assignment_id: string; milestone_type: string }> = [];
  let mFrom = 0;
  for (;;) {
    const { data, error: mErr } = await admin
      .from("mentorship_milestones")
      .select("assignment_id, milestone_type")
      .range(mFrom, mFrom + INTEGRITY_SCAN_PAGE - 1);
    if (mErr) return { error: mErr.message };
    const mbatch = (data ?? []) as Array<{ assignment_id: string; milestone_type: string }>;
    milestoneRows.push(...mbatch);
    if (mbatch.length < INTEGRITY_SCAN_PAGE) break;
    mFrom += INTEGRITY_SCAN_PAGE;
  }

  const built = buildMentoringMilestoneIntegrityScan({
    assignments,
    milestoneRows,
  });
  return {
    ...built,
    mentorAssignmentsRowsFetched: assignments.length,
    milestoneRowsFetched: milestoneRows.length,
  };
}
