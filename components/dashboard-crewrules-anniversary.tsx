import { getCrewRulesAnniversaryYearsIfToday } from "@/lib/portal/crewrules-anniversary";

/**
 * Shown on the pilot dashboard each Feb 23 (US Eastern) after launch — anniversary + thank-you.
 */
export function DashboardCrewRulesAnniversary() {
  const years = getCrewRulesAnniversaryYearsIfToday();
  if (years == null) return null;

  const yearLabel = years === 1 ? "1-year" : `${years}-year`;

  return (
    <aside
      className="rounded-2xl border border-fuchsia-200/90 bg-gradient-to-r from-fuchsia-50 via-violet-50 to-fuchsia-50 px-4 py-3.5 shadow-sm dark:border-fuchsia-500/35 dark:from-fuchsia-950/40 dark:via-violet-950/35 dark:to-fuchsia-950/40"
      aria-label="CrewRules™ anniversary"
    >
      <p className="text-base font-semibold text-fuchsia-950 dark:text-fuchsia-100">
        CrewRules™ — {yearLabel} anniversary
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-fuchsia-900/85 dark:text-fuchsia-100/85">
        Thank you for being part of CrewRules™ — for trusting us with your schedule, commute, and time.
        We are grateful you are here, and we keep building this for you. Here&apos;s to many more years
        together.
      </p>
    </aside>
  );
}
