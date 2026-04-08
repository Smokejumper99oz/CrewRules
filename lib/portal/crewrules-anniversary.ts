import { formatInTimeZone } from "date-fns-tz";

/** Calendar day for CrewRules™ public launch (Feb 23) — Eastern, all day. */
export const CREWRULES_BIRTHDAY_TIMEZONE = "America/New_York";

export const CREWRULES_LAUNCH_YEAR = 2026;

/**
 * When "today" in `CREWRULES_BIRTHDAY_TIMEZONE` is Feb 23 and after launch year,
 * returns years completed since launch (2027 → 1, 2028 → 2, …). Otherwise null.
 */
export function getCrewRulesAnniversaryYearsIfToday(now: Date = new Date()): number | null {
  const y = parseInt(formatInTimeZone(now, CREWRULES_BIRTHDAY_TIMEZONE, "yyyy"), 10);
  const md = formatInTimeZone(now, CREWRULES_BIRTHDAY_TIMEZONE, "MM-dd");
  if (md !== "02-23" || y <= CREWRULES_LAUNCH_YEAR) return null;
  return y - CREWRULES_LAUNCH_YEAR;
}
