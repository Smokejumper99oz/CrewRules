/**
 * Shared leg date logic for schedule popover and dashboard next-duty.
 * Derives actual departure/arrival dates from leg.day + depTime/arrTime.
 */

import { formatInTimeZone } from "date-fns-tz";
import { addDay } from "./schedule-time";

const DAY_ABBREVS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export type LegWithDates = {
  leg: { day?: string; depTime?: string; arrTime?: string; [k: string]: unknown };
  departureDate: string | null;
  arrivalDate: string | null;
};

function timeToMinutes(t: string | undefined): number | null {
  if (!t?.trim()) return null;
  const s = t.trim().replace(":", "");
  if (!/^\d{3,4}$/.test(s)) return null;
  const h = parseInt(s.slice(0, -2) || "0", 10);
  const m = parseInt(s.slice(-2), 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function isOvernightLeg(leg: { depTime?: string; arrTime?: string }): boolean {
  const dep = timeToMinutes(leg.depTime);
  const arr = timeToMinutes(leg.arrTime);
  if (dep == null || arr == null) return false;
  return arr < dep;
}

function getWeekdayAbbrev(dateStr: string, timezone: string): string {
  const d = new Date(dateStr + "T12:00:00.000Z");
  const dayIdx = parseInt(formatInTimeZone(d, timezone, "i"), 10) % 7;
  return DAY_ABBREVS[dayIdx];
}

export function getTripDateStrings(startTime: string, endTime: string, timezone: string): string[] {
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
  const dates: string[] = [];
  let cur = formatInTimeZone(start, timezone, "yyyy-MM-dd");
  const endStr = formatInTimeZone(end, timezone, "yyyy-MM-dd");
  while (cur <= endStr) {
    dates.push(cur);
    cur = addDay(cur);
  }
  return dates;
}

/**
 * Derive departure and arrival dates for each leg.
 * Uses leg order to handle multiple legs on the same weekday.
 */
export function computeLegDates<T extends { day?: string; depTime?: string; arrTime?: string }>(
  legs: T[],
  tripDateStrs: string[],
  timezone: string
): { leg: T; departureDate: string | null; arrivalDate: string | null }[] {
  const usedCountByWeekday = new Map<string, number>();
  return legs.map((leg) => {
    if (!leg.day) return { leg, departureDate: null, arrivalDate: null };
    const legDayNorm = leg.day.slice(0, 2).toLowerCase();
    const datesForWeekday = tripDateStrs.filter(
      (d) => getWeekdayAbbrev(d, timezone).toLowerCase() === legDayNorm
    );
    const usedCount = usedCountByWeekday.get(legDayNorm) ?? 0;
    const idx = Math.min(usedCount, Math.max(0, datesForWeekday.length - 1));
    const departureDate = datesForWeekday[idx] ?? null;
    if (departureDate) usedCountByWeekday.set(legDayNorm, usedCount + 1);
    if (!departureDate) return { leg, departureDate: null, arrivalDate: null };
    const arrivalDate = isOvernightLeg(leg) ? addDay(departureDate) : departureDate;
    return { leg, departureDate, arrivalDate };
  });
}

/** Legs that touch the given date (depart or arrive on it). */
export function getLegsForDate<T extends { day?: string; depTime?: string; arrTime?: string }>(
  legs: T[],
  dateStr: string,
  tripDateStrs: string[],
  timezone: string
): T[] {
  const legDates = computeLegDates(legs, tripDateStrs, timezone);
  return legDates
    .filter(({ departureDate, arrivalDate }) => departureDate === dateStr || arrivalDate === dateStr)
    .map(({ leg }) => leg);
}

/**
 * Current time in minutes since midnight (timezone).
 */
function nowMinutesInTz(timezone: string): number {
  const now = new Date();
  const h = parseInt(formatInTimeZone(now, timezone, "HH"), 10);
  const m = parseInt(formatInTimeZone(now, timezone, "mm"), 10);
  return h * 60 + m;
}

/**
 * Today's date string in timezone.
 */
export function todayStr(timezone: string): string {
  return formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
}

/**
 * Find the next leg that hasn't completed yet.
 * A leg is "done" when current time has passed its arrival (on arrival date).
 * Returns the first leg that hasn't arrived yet, or null if all are done.
 */
export function getNextLegForDate<T extends { day?: string; depTime?: string; arrTime?: string }>(
  legs: T[],
  dateStr: string,
  tripDateStrs: string[],
  timezone: string
): T | null {
  const legDates = computeLegDates(legs, tripDateStrs, timezone);
  const nowDate = todayStr(timezone);
  const nowMin = nowMinutesInTz(timezone);
  const legsOnDate = legDates.filter(
    ({ departureDate, arrivalDate }) => departureDate === dateStr || arrivalDate === dateStr
  );
  for (const { leg, arrivalDate } of legsOnDate) {
    const arrMin = timeToMinutes(leg.arrTime);
    if (arrMin == null) continue;
    const arrivalPassed = nowDate > arrivalDate! || (nowDate === arrivalDate && nowMin >= arrMin);
    if (!arrivalPassed) return leg;
  }
  return null;
}

/**
 * True if all legs for the given date are completed (no upcoming leg).
 */
export function isDateFullyComplete<T extends { day?: string; depTime?: string; arrTime?: string }>(
  legs: T[],
  dateStr: string,
  tripDateStrs: string[],
  timezone: string
): boolean {
  return getNextLegForDate(legs, dateStr, tripDateStrs, timezone) === null;
}
