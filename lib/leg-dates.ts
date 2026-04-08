/**
 * Shared leg date logic for schedule popover and dashboard next-duty.
 * Derives actual departure/arrival dates from leg.day + depTime/arrTime.
 */

import { addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
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

/** Normalize FLICA report_time (HH:MM / HHMM / HMM) to HH:MM for report-night anchoring. */
function normalizeReportHmForAnchor(reportTime: string | null | undefined): string | null {
  if (!reportTime?.trim()) return null;
  const t = reportTime.trim();
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(":");
    const hh = parseInt(h ?? "0", 10);
    const mm = parseInt(m ?? "0", 10);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  const s = t.replace(":", "");
  if (!/^\d{3,4}$/.test(s)) return null;
  const p = s.padStart(4, "0");
  const hh = parseInt(p.slice(0, 2), 10);
  const mm = parseInt(p.slice(2), 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${p.slice(0, 2)}:${p.slice(2)}`;
}

/**
 * True when this trip's FIRST report falls on calendarDayYyyyMmDd in timezone.
 * Anchors report_time against first departure (start_time):
 * report_time on the start day must be ≤ first departure for it to count as that day's report.
 */
export function isTripReportOnLocalCalendarDay(
  event: { event_type: string; report_time?: string | null; start_time: string; end_time: string },
  calendarDayYyyyMmDd: string,
  timezone: string
): boolean {
  if (event.event_type !== "trip") return false;
  const hm = normalizeReportHmForAnchor(event.report_time);
  if (!hm) return false;
  const firstDep = new Date(event.start_time);
  if (isNaN(firstDep.getTime())) return false;

  const startDateLocal = formatInTimeZone(firstDep, timezone, "yyyy-MM-dd");

  try {
    const reportSameDay = fromZonedTime(`${startDateLocal}T${hm}:00`, timezone);
    if (!isNaN(reportSameDay.getTime()) && reportSameDay.getTime() <= firstDep.getTime()) {
      return formatInTimeZone(reportSameDay, timezone, "yyyy-MM-dd") === calendarDayYyyyMmDd;
    }
  } catch {
    // ignore
  }

  return false;
}

/**
 * Instant (ms since epoch) when crew duty begins for this event.
 * Trips: earliest report wall time across trip calendar days if report_time is set, else start_time.
 * Other event types: start_time.
 */
export function getScheduleEventDutyStartMs(
  ev: { event_type: string; start_time: string; end_time: string; report_time?: string | null },
  timezone: string
): number {
  const startMs = new Date(ev.start_time).getTime();
  if (ev.event_type !== "trip") return startMs;
  const hm = normalizeReportHmForAnchor(ev.report_time);
  if (!hm) return startMs;
  const tripDates = getTripDateStrings(ev.start_time, ev.end_time, timezone);
  let best: number | null = null;
  for (const d of tripDates) {
    try {
      const ms = fromZonedTime(`${d}T${hm}:00`, timezone).getTime();
      if (!Number.isNaN(ms) && (best === null || ms < best)) best = ms;
    } catch {
      continue;
    }
  }
  return best ?? startMs;
}

/**
 * Pick the first calendar day (today → tomorrow → rest of trip span) that has legs, for next-duty cards.
 */
export function resolveDisplayDateWithLegs<T extends { day?: string; depTime?: string; arrTime?: string }>(
  event: { start_time: string; end_time: string; legs?: T[] | null },
  today: string,
  tomorrow: string,
  timezone: string
): string {
  const legs = event.legs ?? [];
  if (legs.length === 0) return today;
  const tripDates = getTripDateStrings(event.start_time, event.end_time, timezone);
  const rest = tripDates.filter((d) => d !== today && d !== tomorrow);
  const order = [today, tomorrow, ...rest];
  for (const d of order) {
    const slice = getLegsForDate(legs, d, tripDates, timezone);
    if (slice.length > 0) return d;
  }
  return today;
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
  timezone: string,
  releaseBufferMinutes = 0
): boolean {
  if (releaseBufferMinutes > 0) {
    const rows = computeLegDates(legs, tripDateStrs, timezone);
    for (let i = 0; i < legs.length; i++) {
      const { departureDate, arrivalDate } = rows[i]!;
      if (departureDate !== dateStr && arrivalDate !== dateStr) continue;
      const arrD = arrivalDate ?? departureDate;
      if (!legCrewReleasedFromLeg(legs[i]!, arrD, timezone, releaseBufferMinutes)) {
        return false;
      }
    }
    return true;
  }
  return getNextLegForDate(legs, dateStr, tripDateStrs, timezone) === null;
}

/** Same "arrival passed?" basis as getNextLegForDate (timezone wall clock vs leg arrival date). */
function isLegArrivalPassedForProgressive(
  leg: { arrTime?: string },
  arrivalDate: string | null,
  timezone: string
): boolean {
  if (!arrivalDate) return false;
  const arrMin = timeToMinutes(leg.arrTime);
  if (arrMin == null) return false;
  const nowDate = todayStr(timezone);
  const nowMin = nowMinutesInTz(timezone);
  return nowDate > arrivalDate || (nowDate === arrivalDate && nowMin >= arrMin);
}

/**
 * True after scheduled arrival + optional post-arrival release buffer (commute/duty display uses profile buffer).
 */
export function legCrewReleasedFromLeg<T extends { arrTime?: string }>(
  leg: T,
  arrivalDate: string | null,
  timezone: string,
  releaseBufferMinutes: number
): boolean {
  if (releaseBufferMinutes <= 0) {
    return isLegArrivalPassedForProgressive(leg, arrivalDate, timezone);
  }
  const arrMin = timeToMinutes(leg.arrTime);
  if (arrMin == null || !arrivalDate) return false;
  const h = Math.floor(arrMin / 60);
  const m = arrMin % 60;
  const localIso = `${arrivalDate}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  try {
    const arrInst = fromZonedTime(localIso, timezone);
    const releaseInst = addMinutes(arrInst, releaseBufferMinutes);
    return Date.now() >= releaseInst.getTime();
  } catch {
    return false;
  }
}

/**
 * First leg in pairing order the crew has not yet cleared (arrival + release buffer), or null if all cleared.
 * Unlike getNextLegForDate, not limited to a single calendar day — fixes post-midnight / red-eye progression.
 */
export function getNextActionableLeg<T extends { day?: string; depTime?: string; arrTime?: string }>(
  legs: T[],
  tripDateStrs: string[],
  timezone: string,
  releaseBufferMinutes: number
): T | null {
  if (legs.length === 0) return null;
  const rows = computeLegDates(legs, tripDateStrs, timezone);
  for (let i = 0; i < legs.length; i++) {
    const ld = rows[i];
    const arrD = ld?.arrivalDate ?? ld?.departureDate ?? null;
    if (!legCrewReleasedFromLeg(legs[i]!, arrD, timezone, releaseBufferMinutes)) {
      return legs[i]!;
    }
  }
  return null;
}

/**
 * Pairing-order window: first not-yet-released leg plus the following leg (max two).
 * Dashboard "Later today" / "Next duty" uses this instead of listing every leg touching a calendar day.
 *
 * When `progressiveAnchorCalendarDay` is set (Upcoming duty-day rows), the search for the first
 * actionable leg starts at the first pairing leg departing that calendar day (fallback: first leg
 * touching that date), so each row uses the same progressive contract as the Dashboard without
 * duplicating selection logic elsewhere.
 */
export function sliceNextTwoProgressiveLegs<T extends { day?: string; depTime?: string; arrTime?: string }>(
  legs: T[],
  tripDateStrs: string[],
  timezone: string,
  releaseBufferMinutes = 0,
  progressiveAnchorCalendarDay?: string | null
): T[] {
  if (legs.length === 0) return [];
  const rows = computeLegDates(legs, tripDateStrs, timezone);
  let minIdx = 0;
  if (progressiveAnchorCalendarDay) {
    let anchorIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i]!.departureDate === progressiveAnchorCalendarDay) {
        anchorIdx = i;
        break;
      }
    }
    if (anchorIdx < 0) {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]!;
        if (
          r.departureDate === progressiveAnchorCalendarDay ||
          r.arrivalDate === progressiveAnchorCalendarDay
        ) {
          anchorIdx = i;
          break;
        }
      }
    }
    if (anchorIdx >= 0) minIdx = anchorIdx;
  }
  let startIdx = minIdx;
  for (let i = minIdx; i < legs.length; i++) {
    const ld = rows[i];
    const arrD = ld?.arrivalDate ?? ld?.departureDate ?? null;
    if (!legCrewReleasedFromLeg(legs[i]!, arrD, timezone, releaseBufferMinutes)) {
      startIdx = i;
      break;
    }
    startIdx = i + 1;
  }
  if (startIdx >= legs.length) {
    const from = Math.max(0, legs.length - 2);
    return legs.slice(from);
  }
  return legs.slice(startIdx, startIdx + 2);
}
