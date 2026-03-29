/**
 * Canonical Frontier mentorship milestone sequence (completion / display order).
 *
 * Product rule: keep this order fixed. Do not sort milestone *lists* by `due_date`
 * (stored due dates can be cascaded or edited). Type Rating always precedes IOE Complete in UI.
 */
export const MILESTONE_PROGRAM_ORDER = [
  "initial_assignment",
  "type_rating",
  "oe_complete",
  "three_months",
  "six_months",
  "nine_months",
  "probation_checkride",
] as const;

export function milestoneProgramRank(milestoneType: string): number {
  const i = MILESTONE_PROGRAM_ORDER.indexOf(
    milestoneType as (typeof MILESTONE_PROGRAM_ORDER)[number]
  );
  return i === -1 ? MILESTONE_PROGRAM_ORDER.length : i;
}

/** Sort milestone rows for timeline / lists: program order only. */
export function sortMilestonesByProgramOrder<T extends { milestone_type: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => milestoneProgramRank(a.milestone_type) - milestoneProgramRank(b.milestone_type)
  );
}

/**
 * Among pending (incomplete) milestones only: first in program order; tie-break earlier `due_date`.
 */
export function pickNextMilestoneAmongPending<
  T extends { milestone_type: string; due_date: string },
>(pending: T[]): T | null {
  if (pending.length === 0) return null;
  return pending.reduce((best, cur) => {
    const rb = milestoneProgramRank(best.milestone_type);
    const rc = milestoneProgramRank(cur.milestone_type);
    if (rc < rb) return cur;
    if (rc > rb) return best;
    const db = String(best.due_date ?? "").slice(0, 10);
    const dc = String(cur.due_date ?? "").slice(0, 10);
    return dc < db ? cur : best;
  });
}
