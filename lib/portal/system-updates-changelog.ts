export type SystemUpdateType = "new_feature" | "improvement" | "fix" | "birthday";

export type SystemUpdateEntry = {
  date: string;
  title: string;
  type: SystemUpdateType;
  bullets: readonly string[];
  /** When true, System Updates renders title with Crew + logo-green Rules + rest, all bold. */
  titleWordmark?: boolean;
};

/**
 * Flat changelog rows; UI applies explicit newest-first sorting by `date` (then `title`).
 * Swap this export for a Supabase-backed fetcher returning the same shape.
 *
 * Pilot-facing product updates only — do not add Admin or Super Admin–only changes here.
 */
export const SYSTEM_UPDATES_CHANGELOG: readonly SystemUpdateEntry[] = [
  {
    date: "2026-04-08",
    title: "Recurrent Training — Commute deviation preference",
    type: "new_feature",
    bullets: [
      "For recurrent training on your schedule, you can now record whether you plan to commute on your own from your home airport to the training city instead of using company-provided travel from crew base.",
      "Your choice is saved with the training event and stays with the trip as your schedule updates.",
      "When deviation is on, Commute Assist and Family View™ use home ↔ training-city routing for that block so suggested flights and shared wording match how you actually travel.",
      "The dashboard Next Duty card can remind you to set or confirm this preference when training is coming up.",
    ],
  },
  {
    date: "2026-04-08",
    title: "Family View™ — Day-trip cards and Week Ahead",
    type: "improvement",
    bullets: [
      "In Family View™, single-calendar-day trips for commuters who finish at crew base (but not at home) now show as a Day Trip with route and day count, instead of using “Commuting Home” as the main headline.",
      "On the shared Family View™ page, the line under the route uses duty end in base time to say when you’re likely heading home (e.g. in the afternoon), plus the usual note that it still depends on available flights and seats — in English, Spanish, and German.",
      "In Family View™, Week Ahead no longer lists today; it starts tomorrow and still covers seven forward days. Upcoming begins right after that window so you don’t see the same date twice or skip a day.",
      "The Today card and Work Trip overview in Family View™ follow the same day-trip and commute wording where it applies.",
    ],
  },
  {
    date: "2026-04-07",
    title: "Dashboard weather widget",
    type: "new_feature",
    bullets: [
      "Your dashboard now shows a live weather snapshot for wherever you are right now — layover city, home base, or en-route origin — pulled directly from official FAA Aviation Weather Center data.",
      "Displays current temperature in both °F and °C, conditions, wind speed and direction, and 'feels like' temperature when wind chill applies.",
      "Tapping the widget takes you straight to the full Aviation Weather Brief for your next flight.",
      "Updates automatically every 5 minutes using the same free FAA data source as the Weather Brief — no extra cost.",
    ],
  },
  {
    date: "2026-04-07",
    title: "ALPA Mentorship — Important Contacts & Program History",
    type: "new_feature",
    bullets: [
      "Mentees now have an Important Contacts tab showing ALPA program manager, Military Affairs Committee chairman, and payroll support — with tappable phone and email links.",
      "A new Program History tab (formerly Archived) shows completed mentorship assignments including mentor details, milestones, and the reason the assignment ended.",
      "Contact cards are managed per-airline by your local admin — no developer involvement needed when contact info changes.",
      "Frontier MEC ALPA branding added to the contacts page with the official Frontier Master Executive Council logo.",
    ],
  },
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
    date: "2026-03-14",
    title: "FAR 117 banner, live flight status, and schedule pay tools",
    type: "improvement",
    bullets: [
      "FAR 117 FDP banner is tied to Current Trip, with delay-adjusted duty end where it applies.",
      "FlightAware live delay and status on Current Trip (first leg) and on the Weather Brief top flight card.",
      "Pay & Credit popover and PAY-day tile styling on the schedule.",
      "AviationStack throttling, deduplication, and 429 handling for more reliable commute flight lookups.",
    ],
  },
  {
    date: "2026-03-10",
    title: "Schedule email parsing, Month Overview, Weather Brief, and Family View™",
    type: "improvement",
    bullets: [
      "Inbound email to your CrewRules import address can parse FLICA-style HTML calendar content as well as ICS attachments.",
      "Duplicate-import prevention when the same schedule update email arrives more than once.",
      "Month Overview: filtering, award-change display, and muting for selected schedule imports.",
      "Weather Brief: TAF handling fixes, better iPad support, and header layout cleanup.",
      "Family View™ wording and layout polish on the shared schedule page.",
    ],
  },
  {
    date: "2026-02-28",
    title: "Frontier Pilot Portal — schedule, profile, and dashboard",
    type: "new_feature",
    bullets: [
      "Schedule in the pilot portal: trip cards, first-leg route on trips, PAY and credit context, multi-day events, and clearer On Duty and reserve-related display.",
      "Complete Profile flow plus login and session fixes so pilots can finish onboarding without getting stuck.",
      "Dashboard polish: greeting, trip counts, On Call labeling, Upcoming list behavior, and a cleaner first-run experience.",
    ],
  },
  {
    date: "2026-02-24",
    title: "Frontier Pilot Portal preview",
    type: "new_feature",
    bullets: [
      "First CrewRules™ pilot portal experience for Frontier: sign-in path, portal shell, and continued improvements to Request Access.",
      "Sets the stage for schedule, dashboard, and the rest of the pilot experience shipped over the following days.",
    ],
  },
  {
    date: "2026-02-23",
    title: "CrewRules™ Initial Public Launch",
    type: "birthday",
    titleWordmark: true,
    bullets: [
      "CrewRules™ goes live with a public landing page, Request Access backed by Supabase, CrewRules branding, access levels (the former pricing section), logos, and Open Graph previews for social apps and iMessage.",
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
