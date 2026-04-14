/**
 * Frontier admin dashboard: aggregate milestone completion across active assignment rows
 * from the same mentee roster load (denominator = assignment count).
 */

export type FrontierProgramProgressItem = {
  milestoneType: string;
  label: string;
  /** 0–100 inclusive */
  pct: number;
};

type MilestoneLite = { milestone_type: string; completed_date: string | null };

type AssignmentMilestonesLite = {
  milestones: MilestoneLite[] | null;
};

const TRACKED: readonly { type: string; label: string }[] = [
  { type: "type_rating", label: "Type Rating Completed" },
  { type: "oe_complete", label: "IOE Finished" },
  { type: "three_months", label: "3 Month On Line" },
  { type: "six_months", label: "6 Month On Line" },
  { type: "nine_months", label: "9 Month On Line" },
];

function isMilestoneCompleted(m: MilestoneLite | undefined): boolean {
  if (m == null) return false;
  const d = m.completed_date;
  return d != null && String(d).trim() !== "";
}

/**
 * @param assignments Active mentoring assignment rows (same set as mentee roster build), each with embedded milestones.
 */
export function buildFrontierProgramProgressFromAssignments(
  assignments: AssignmentMilestonesLite[]
): FrontierProgramProgressItem[] {
  const n = assignments.length;
  return TRACKED.map(({ type, label }) => {
    let done = 0;
    for (const a of assignments) {
      const row = (a.milestones ?? []).find((m) => m.milestone_type === type);
      if (isMilestoneCompleted(row)) done += 1;
    }
    const pct = n === 0 ? 0 : Math.round((done / n) * 100);
    return { milestoneType: type, label, pct };
  });
}
