/**
 * Commute search window utilities.
 * V1 rule: always show day prior; if duty starts at/after noon, also show day-of options.
 */

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export type CommuteSearchWindow = {
  kind: "day_prior" | "same_day";
  startUtc: string;
  endUtc: string;
};

/** Subtract one day from YYYY-MM-DD. */
function subtractDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return prev.toISOString().slice(0, 10);
}

/**
 * Get commute search windows for a duty that starts at base.
 * V1 rule: always show day prior; if duty starts at/after noon, also show day-of options.
 *
 * - day_prior: D-1 00:00 → D-1 23:59 (home local)
 * - same_day (only if duty start in base tz >= 12:00): D 00:00 (home local) → duty start (converted to home local)
 * - Returns windows in order: day_prior first, then same_day if included.
 */
export function getCommuteSearchWindowsToBase(
  dutyStartIsoUtc: string,
  baseTimezone: string,
  homeTimezone: string
): CommuteSearchWindow[] {
  const dutyStart = new Date(dutyStartIsoUtc);
  if (isNaN(dutyStart.getTime())) return [];

  // D = duty day (YYYY-MM-DD) in base timezone
  const dStr = formatInTimeZone(dutyStart, baseTimezone, "yyyy-MM-dd");
  const dMinus1Str = subtractDay(dStr);

  const windows: CommuteSearchWindow[] = [];

  // Always include day_prior: D-1 00:00 → D-1 23:59 (home local)
  const dayPriorStart = fromZonedTime(`${dMinus1Str}T00:00:00.000`, homeTimezone);
  const dayPriorEnd = fromZonedTime(`${dMinus1Str}T23:59:59.999`, homeTimezone);
  windows.push({
    kind: "day_prior",
    startUtc: dayPriorStart.toISOString(),
    endUtc: dayPriorEnd.toISOString(),
  });

  // Include same_day only if duty start time (in base timezone) is >= 12:00
  const dutyStartHourBase = parseInt(formatInTimeZone(dutyStart, baseTimezone, "HH"), 10);
  if (dutyStartHourBase >= 12) {
    // same_day: D 00:00 (home local) → duty start (instant, same in any tz)
    const sameDayStart = fromZonedTime(`${dStr}T00:00:00.000`, homeTimezone);
    windows.push({
      kind: "same_day",
      startUtc: sameDayStart.toISOString(),
      endUtc: dutyStart.toISOString(),
    });
  }

  return windows;
}
