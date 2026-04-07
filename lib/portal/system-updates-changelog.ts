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
    date: "2026-04-07",
    title: "Mentoring auto-match now works reliably",
    type: "fix",
    bullets: [
      "When an admin uploads a mentor–mentee roster, mentors who already have a CrewRules account now immediately see their new mentees — no waiting, no manual step.",
      "When a new mentor or mentee creates a CrewRules account, they are automatically linked to any pre-uploaded assignments the moment they sign in.",
      "Fixed a matching failure caused by whitespace and leading zeros in employee numbers (e.g. 01234 now correctly matches 1234).",
    ],
  },
  {
    date: "2026-04-07",
    title: "Automatic schedule updates from ELP notifications",
    type: "new_feature",
    bullets: [
      "When crew scheduling modifies a trip via FLICA's ELP system, the notification email now automatically updates your schedule in CrewRules — no manual re-import needed.",
      "Added legs, removed legs, and report time changes are all applied in real time as soon as the ELP email is received.",
      "Deadhead legs (including carrier-coded flights like Southwest) are correctly identified and flagged during the update.",
      "Works through your existing email alias — forward your ELP notifications once and all future schedule changes arrive automatically.",
    ],
  },
  {
    date: "2026-04-07",
    title: "Family View — Day Trip detection",
    type: "new_feature",
    bullets: [
      "When a commuter pilot picks up a trip that both departs from and returns to their home airport, Family View now recognizes it as a Day Trip.",
      "Day Trip cards show the actual flight route and scheduled departure and arrival times (e.g. Departs 7:25 AM · Arrives 3:18 PM) instead of a vague time-of-day estimate.",
      "The 'won't make it home' warning no longer triggers for Day Trips or any trip that ends at the pilot's home airport — because they're already there.",
    ],
  },
  {
    date: "2026-04-07",
    title: "Family View — cleaner, more honest schedule sharing",
    type: "improvement",
    bullets: [
      "Removed the duplicate Trip Details card — everything it showed is now in the Current Trip Overview with better context.",
      "Renamed 'This Week' to 'Week Ahead' and removed days already covered by the Current Trip Overview, eliminating repeated rows.",
      "Status labels are now plain-English throughout: 'Overnight' instead of 'Away Overnight', 'Duty Starts' instead of 'Working', with a Day X of Y progress badge on every trip day including the first and last.",
      "Commuter pilots no longer see a misleading 'Coming Home' on their last trip day — it now shows 'Commuting Home' with an honest note that timing depends on available flights and seat options.",
      "U.S. city names now use two-letter state abbreviations (Tampa, FL · Charlotte, NC) to save space; international destinations keep their full name (San Juan, Puerto Rico · Cancún, Mexico).",
    ],
  },
  {
    date: "2026-04-06",
    title: "Improved iPhone month schedule UI",
    type: "improvement",
    bullets: [
      "Improved iPhone month schedule UI (tile density, report-night styling, +N indicator clarity, removed horizontal scroll experiment)",
    ],
  },
  {
    date: "2026-04-05",
    title: "Onboarding clarity, public feedback, and signup UX",
    type: "improvement",
    bullets: [
      "Improved onboarding clarity (Login / Create Account / Waitlist)",
      "Added public feedback system",
      "Refined signup eligibility messaging",
      "Improved modal UX and card consistency",
    ],
  },
  {
    date: "2026-04-04",
    title: "In-App Feedback & Bug Reporting",
    type: "new_feature",
    bullets: [
      "Submit bug reports, feature requests, and feedback directly inside CrewRules™",
      "Helps us fix issues faster and improve the platform based on real pilot input",
      "Optional screenshot uploads with a clean, reliable file picker experience",
    ],
  },
  {
    date: "2026-04-04",
    title: "Post-Duty Release + Reserve Commute Enhancements",
    type: "improvement",
    bullets: [
      "Added a new Trip Complete state with a clear post-duty summary showing duty end time and the actual final airport of release.",
      "Commute Assist now correctly switches to flights home after trip completion instead of continuing to show commute-to-duty results.",
      "On the last day of reserve, Commute Assist now begins showing possible flights home within 4 hours of scheduled release for pilots who may be released early by Crew Scheduling.",
    ],
  },
  {
    date: "2026-04-03",
    title: "Weather Brief clarity and trust",
    type: "improvement",
    bullets: [
      "Pilot summary and clearer METAR vs TAF-at-your-time labeling on airport cards.",
      "Safer TS detection (selected TAF period only) and enroute advisories scoped to station text matches.",
      "Risk headline copy tied to real drivers; note when VFR badges differ from the summary.",
    ],
  },
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
      "More resilient handling of repeated schedule imports.",
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
