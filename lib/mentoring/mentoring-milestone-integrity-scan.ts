import type { SupabaseClient } from "@supabase/supabase-js";
import { getMilestoneScheduleForHireDate } from "@/lib/mentoring/create-milestones-for-assignment";

export type MentoringMilestoneIntegrityScan = {
  /** assignment_id values with type_rating row but no oe_complete row */
  typeRatingWithoutOeCompleteAssignmentIds: string[];
  /** assignment_id with a valid hire_date on the assignment but missing ≥1 standard program milestone type */
  hireDateMissingAnyStandardMilestoneAssignmentIds: string[];
  /** subset of type_rating without oe where assignment has no usable hire_date (cannot schedule-seed) */
  typeRatingWithoutOeMissingHireDateAssignmentIds: string[];
};

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
 * Single-query inputs: `mentor_assignments` and `mentorship_milestones` lists.
 * Same integrity rules as super-admin backfill follow-up diagnostics (hire + standard schedule).
 */
export function buildMentoringMilestoneIntegrityScan(params: {
  assignments: Array<{ id: string; hire_date: string | null }>;
  milestoneRows: Array<{ assignment_id: string; milestone_type: string }>;
}): MentoringMilestoneIntegrityScan {
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

  for (const row of params.assignments) {
    const aid = String(row.id);
    const hireRaw = (row.hire_date as string | null) ?? "";
    const hireYmd = hireRaw.trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(hireYmd)) continue;
    const schedule = getMilestoneScheduleForHireDate(hireYmd);
    if (!schedule.ok) continue;
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
  };
}

export async function fetchMentoringMilestoneIntegrityScan(
  admin: SupabaseClient,
): Promise<MentoringMilestoneIntegrityScan | { error: string }> {
  const { data: assignments, error: aErr } = await admin.from("mentor_assignments").select("id, hire_date");
  if (aErr) return { error: aErr.message };
  const { data: milestoneRows, error: mErr } = await admin
    .from("mentorship_milestones")
    .select("assignment_id, milestone_type");
  if (mErr) return { error: mErr.message };

  return buildMentoringMilestoneIntegrityScan({
    assignments: (assignments ?? []) as Array<{ id: string; hire_date: string | null }>,
    milestoneRows: (milestoneRows ?? []) as Array<{ assignment_id: string; milestone_type: string }>,
  });
}
