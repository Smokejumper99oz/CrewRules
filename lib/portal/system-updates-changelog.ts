export type SystemUpdateType = "new_feature" | "improvement" | "fix";

export type SystemUpdateEntry = {
  date: string;
  title: string;
  type: SystemUpdateType;
  bullets: readonly string[];
};

/**
 * Flat changelog rows; UI applies explicit newest-first sorting by `date` (then `title`).
 * Swap this export for a Supabase-backed fetcher returning the same shape.
 */
export const SYSTEM_UPDATES_CHANGELOG: readonly SystemUpdateEntry[] = [
  {
    date: "2026-03-30",
    title: "Mentoring dashboard snapshot cards",
    type: "new_feature",
    bullets: [
      "At-a-glance counts for active mentees and upcoming milestones.",
      "Quick links into mentee detail from the dashboard.",
      "Cards use the same dark portal styling as the rest of CrewRules.",
    ],
  },
  {
    date: "2026-03-28",
    title: "Mentoring library and guide refresh",
    type: "improvement",
    bullets: [
      "Clearer guidance for mentors managing mentee progress.",
      "Library copy updated for current beta workflows.",
      "Section layout aligned with other System and Community pages.",
    ],
  },
  {
    date: "2026-03-22",
    title: "Milestone timeline accuracy",
    type: "fix",
    bullets: [
      "Timeline dates stay in sync when hire dates are corrected on an assignment.",
      "Resolved edge cases where pending milestones could appear out of order.",
    ],
  },
  {
    date: "2026-03-15",
    title: "Founding Pilot profile polish",
    type: "improvement",
    bullets: [
      "Founding Pilot badge and plan messaging tuned for clarity.",
      "Profile header spacing refined on small screens.",
    ],
  },
  {
    date: "2026-02-20",
    title: "Schedule import reliability",
    type: "fix",
    bullets: [
      "More resilient handling of repeated ICS imports.",
      "Fewer duplicate trip rows when re-syncing from email.",
    ],
  },
  {
    date: "2026-02-10",
    title: "Commute Assist list consistency",
    type: "improvement",
    bullets: [
      "Sort order matches the times shown on duty cards.",
      "Reduced jitter when refreshing next-duty commute data.",
    ],
  },
];
