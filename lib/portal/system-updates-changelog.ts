export type SystemUpdateType = "new_feature" | "new_feature_beta" | "improvement" | "fix" | "birthday";

export type SystemUpdateEntry = {
  date: string;
  title: string;
  type: SystemUpdateType;
  bullets: readonly string[];
  /** Rare: IPO card only — hardcoded Crew + green Rules headline. */
  titleWordmark?: boolean;
  /** Rare: single-row opt-in — `CrewRules™` in `title` renders with green Rules only when true. */
  titleCrewRulesBrand?: boolean;
};

/**
 * Flat changelog rows; UI applies explicit newest-first sorting by `date` (then `title`).
 * Swap this export for a Supabase-backed fetcher returning the same shape.
 *
 * Pilot-facing product updates only — do not add Admin or Super Admin–only changes here.
 */
export const SYSTEM_UPDATES_CHANGELOG: readonly SystemUpdateEntry[] = [
  {
    date: "2026-04-30",
    title: "Dashboard — Next Duty Leg Lines Show Airline Logo and Flight Number",
    type: "improvement",
    bullets: ["On the pilot dashboard, the Next Duty card now shows your airline's logo next to the flight number on each leg (for example: logo and 4092 before TPA → BWI)."],
  },
  {
    date: "2026-04-30",
    title: "Weather Brief — Operational NOTAMs, Now Live, Built for Pilots (PRO)",
    type: "new_feature",
    bullets: [
      "NOTAMs are now sorted by operational importance, so you see what actually matters first.",
      "Clean CrewRules™ summaries replace raw NOTAM clutter — no more digging through unreadable text.",
      "Filter by category (Runway, ILS, Navaid, etc.) to quickly focus on what affects your flight.",
      "Full official NOTAM text is still available when you need it.",
      "Validity is clearly shown (Effective, Expires, or PERM), so you know exactly what's active.",
    ],
  },
  {
    date: "2026-04-30",
    title: "Weather Brief — CrewRules™ Enroute Intelligence Now Live (PRO)",
    type: "new_feature",
    titleCrewRulesBrand: true,
    bullets: [
      "New Enroute Intelligence analyzes your route using real operational weather sources, including AIRMETs, SIGMETs, and PIREPs.",
      "Identifies enroute weather risks before departure and highlights areas that may impact your flight.",
      "Automatically builds from your filed route and live weather data to support better preflight decision-making.",
      "When route data is not yet available, the system clearly indicates that analysis will populate once your route is received.",
    ],
  },
  {
    date: "2026-04-30",
    title: "Weather Brief — CrewRules™ Enroute Performance™ Now Live (PRO)",
    type: "new_feature_beta",
    titleCrewRulesBrand: true,
    bullets: [
      "New CrewRules™ Enroute Performance™ provides insight into winds, altitude selection, and fuel impact before departure.",
      "Compares altitude options to help identify more efficient cruise levels based on forecast winds.",
      "Highlights potential fuel savings and performance differences across altitudes.",
      "Currently optimized for Airbus A320/A321 aircraft using generalized performance assumptions.",
      "This is an early beta version — results are intended for planning insight only and will continue to improve with more precise aircraft data.",
      "When route data is not yet available, the system clearly indicates that performance analysis will populate once your route is received.",
    ],
  },
  {
    date: "2026-04-28",
    title: "Next Duty — Report Time Logic Corrected",
    type: "fix",
    bullets: [
      "Report time on the Next Duty card now correctly reflects real-world operations.",
      "First leg of a trip shows 1:00 prior to departure.",
      "Subsequent legs during a trip show 0:45 prior to departure.",
      "This replaces the previous behavior where all legs could display a 45-minute report regardless of trip start.",
      "The update ensures pilots see accurate report times at a glance, especially for trip pickups and day-one departures.",
    ],
  },
  {
    date: "2026-04-28",
    title: "Next Duty — Gate Information (PRO)",
    type: "improvement",
    bullets: [
      "Gate information is now shown in the Next Duty card for PRO users when available.",
      "Departure and arrival gates display alongside each leg for quick reference.",
      "This gives PRO users a faster, all-in-one view of their next trip without needing external apps.",
    ],
  },
  {
    date: "2026-04-28",
    title: "NAVBLUE — Bid Reminders Added To Dashboard",
    type: "new_feature",
    bullets: [
      "Important NAVBLUE bid events now appear directly on your dashboard.",
      "You’ll see reminders ahead of key bidding windows so you don’t miss important deadlines.",
      "Includes quick actions: Remind me later (snooze) and Dismiss for this month.",
      "Designed to give pilots better awareness of upcoming bid activity without needing to check multiple systems.",
    ],
  },
  {
    date: "2026-04-24",
    title: "Commute Assist™ — clearer “previous day” when same-day looks bad",
    type: "improvement",
    bullets: [
      "When you’re commuting to base and every same-day option misses your arrival buffer, the warning now says you have no safe same-day options, with “Consider previous day” on the right. One tap still searches the day before, same as before.",
      "If every same-day option is still within your buffer but all marked tight (risky), you get a different message: same-day commute looks tight, with the same “Consider previous day” action.",
    ],
  },
  {
    date: "2026-04-24",
    title: "Commute Assist™ — completed flights are easier to read",
    type: "improvement",
    bullets: [
      "Legs that have already landed or arrived can show as “Completed” with the same emerald styling as on-time, so your commute list is easier to scan at a glance.",
    ],
  },
  {
    date: "2026-04-24",
    title: "Commute Assist™ — recurrent training deviation to base, fixed",
    type: "fix",
    bullets: [
      "When you use commute deviation for recurrent training (home to the training city), to-base search now uses the training city, time zone, and arrive-by context instead of defaulting to crew base or the wrong day window.",
      "Search day, scoring, and labels line up with the training block, so you are less likely to see a false “day prior” or a commute window that does not match your actual trip.",
    ],
  },
  {
    date: "2026-04-24",
    title: "Current Trip — more accurate first-leg deadhead carrier",
    type: "fix",
    bullets: [
      "Deadhead legs resolve against schedule and API data with tighter matching, without assuming Frontier when the data says a different market carrier.",
      "When the carrier is still unknown, the UI can show a clear deadhead state instead of a misleading guess.",
    ],
  },
  {
    date: "2026-04-24",
    title: "Family View™ — training now shown as primary when active",
    type: "fix",
    bullets: [
      "When recurrent training and line trips overlap, training is now correctly shown as the main focus.",
      "Prevents the dashboard from highlighting a later trip instead of current training.",
    ],
  },
  {
    date: "2026-04-24",
    title: "Pro trial — “View Pro trial” on menu links to subscription",
    type: "improvement",
    bullets: [
      "Header and navigation call-to-action copy now says “View Pro trial” where it used to say “Start free trial,” and it leads into the same subscription and trial experience. The main subscription page button is unchanged.",
    ],
  },
  {
    date: "2026-04-12",
    title: "FLICA import now removes stale traded trips later in the month",
    type: "fix",
    bullets: [
      "Fixed a FLICA import issue where an old trip could remain on the schedule after it was traded earlier and removed from a newer monthly export.",
      "CrewRules™ now uses the imported schedule's covered month window more accurately when clearing stale flica_import trips, so removed later-month trips no longer linger after upload.",
    ],
  },
  {
    date: "2026-04-12",
    title: "Geo-aware Dashboard weather",
    type: "improvement",
    bullets: [
      "The dashboard weather chip now uses your actual device location first when permitted, showing METAR-based conditions from the nearest suitable reporting station (U.S. NWS coverage).",
      "If location is denied, unavailable, or times out, the widget automatically falls back to the existing logic: active trip first-leg origin, then crew base from profile.",
      "When you are not on an active trip, the chip can use your home airport from profile before your crew base, so the snapshot is more like where you actually are on days off.",
    ],
  },
  {
    date: "2026-04-08",
    title: "Recurrent Training — Commute deviation preference",
    type: "new_feature",
    bullets: [
      "For recurrent training on your schedule, you can now record whether you plan to commute on your own from your home airport to the training city instead of using company-provided travel from crew base.",
      "Your choice is saved with the training event and stays with the trip as your schedule updates.",
      "When deviation is on, Commute Assist™ and Family View™ use home ↔ training-city routing for that block so suggested flights and shared wording match how you actually travel.",
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
      "When an admin uploads a mentor–mentee roster, mentors who already have a CrewRules™ account now immediately see their new mentees — no waiting, no manual step.",
      "When a new mentor or mentee creates a CrewRules™ account, they are automatically linked to any pre-uploaded assignments the moment they sign in.",
      "Fixed a matching failure caused by whitespace and leading zeros in employee numbers (e.g. 01234 now correctly matches 1234).",
    ],
  },
  {
    date: "2026-04-07",
    title: "Automatic schedule updates from ELP notifications",
    type: "new_feature",
    bullets: [
      "When crew scheduling modifies a trip via FLICA's ELP system, the notification email now automatically updates your schedule in CrewRules™ — no manual re-import needed.",
      "Added legs, removed legs, and report time changes are all applied in real time as soon as the ELP email is received.",
      "Deadhead legs (including carrier-coded flights like Southwest) are correctly identified and flagged during the update.",
      "Works through your existing email alias — forward your ELP notifications once and all future schedule changes arrive automatically.",
    ],
  },
  {
    date: "2026-04-07",
    title: "Family View™ — Day Trip detection",
    type: "new_feature",
    bullets: [
      "When a commuter pilot picks up a trip that both departs from and returns to their home airport, Family View™ now recognizes it as a Day Trip.",
      "Day Trip cards show the actual flight route and scheduled departure and arrival times (e.g. Departs 7:25 AM · Arrives 3:18 PM) instead of a vague time-of-day estimate.",
      "The 'won't make it home' warning no longer triggers for Day Trips or any trip that ends at the pilot's home airport — because they're already there.",
    ],
  },
  {
    date: "2026-04-07",
    title: "Family View™ — cleaner, more honest schedule sharing",
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
      "Commute Assist™ now correctly switches to flights home after trip completion instead of continuing to show commute-to-duty results.",
      "On the last day of reserve, Commute Assist™ now begins showing possible flights home within 4 hours of scheduled release for pilots who may be released early by Crew Scheduling.",
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
      "Cards use the same dark portal styling as the rest of CrewRules™.",
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
      "Inbound email to your CrewRules™ import address can parse FLICA-style HTML calendar content as well as ICS attachments.",
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
      "CrewRules™ goes live with a public landing page, Request Access backed by Supabase, CrewRules™ branding, access levels (the former pricing section), logos, and Open Graph previews for social apps and iMessage.",
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
    title: "Commute Assist™ list consistency",
    type: "improvement",
    bullets: [
      "Sort order matches the times shown on duty cards.",
      "Reduced jitter when refreshing next-duty commute data.",
    ],
  },
];
