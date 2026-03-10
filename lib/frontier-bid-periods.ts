/**
 * Frontier Airlines bid period definitions.
 * Bid periods do not align with calendar months (e.g. March 1 is in FEB bid period).
 */

import { formatInTimeZone } from "date-fns-tz";

const FRONTIER_BID_PERIODS_2026 = [
  { name: "JAN", start: "2026-01-01", end: "2026-01-30" },
  { name: "FEB", start: "2026-01-31", end: "2026-03-01" },
  { name: "MAR", start: "2026-03-02", end: "2026-03-31" },
  { name: "APR", start: "2026-04-01", end: "2026-04-30" },
  { name: "MAY", start: "2026-05-01", end: "2026-05-31" },
  { name: "JUN", start: "2026-06-01", end: "2026-06-30" },
  { name: "JUL", start: "2026-07-01", end: "2026-07-30" },
  { name: "AUG", start: "2026-07-31", end: "2026-08-30" },
  { name: "SEP", start: "2026-08-31", end: "2026-09-30" },
  { name: "OCT", start: "2026-10-01", end: "2026-10-31" },
  { name: "NOV", start: "2026-11-01", end: "2026-12-01" },
  { name: "DEC", start: "2026-12-02", end: "2026-12-31" },
] as const;

const SUPPORTED_YEARS = [2026] as const;

/** Frontier bid-period timezone fallback. Use for bid-period resolution only. */
export function getFrontierBidPeriodTimezone(options?: {
  sourceTimezone?: string | null;
  baseTimezone?: string | null;
  profileBaseTimezone?: string | null;
}): string {
  const { sourceTimezone, baseTimezone, profileBaseTimezone } = options ?? {};
  return (
    sourceTimezone ??
    baseTimezone ??
    profileBaseTimezone ??
    "America/Puerto_Rico"
  );
}

function getBidPeriodsForYear(year: number): typeof FRONTIER_BID_PERIODS_2026 | null {
  if (year === 2026) return FRONTIER_BID_PERIODS_2026;
  return null;
}

export function getBidPeriodForTimestamp(
  timestamp: string,
  timezone: string,
  year?: number
): { bidMonthIndex: number; name: string; startStr: string; endStr: string } | null {
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return null;
    const localDateStr = formatInTimeZone(d, timezone, "yyyy-MM-dd");
    return getBidPeriodForDate(localDateStr, year ?? Number(localDateStr.slice(0, 4)));
  } catch {
    return null;
  }
}

export function getBidPeriodForDate(
  dateStr: string,
  year: number
): { bidMonthIndex: number; name: string; startStr: string; endStr: string } | null {
  const periods = getBidPeriodsForYear(year);
  if (!periods) return null;
  const idx = periods.findIndex((p) => dateStr >= p.start && dateStr <= p.end);
  if (idx < 0) return null;
  const p = periods[idx];
  return { bidMonthIndex: idx, name: p.name, startStr: p.start, endStr: p.end };
}

export function getBidPeriodBounds(
  year: number,
  bidMonthIndex: number
): { startStr: string; endStr: string; name: string } | null {
  const periods = getBidPeriodsForYear(year);
  if (!periods || bidMonthIndex < 0 || bidMonthIndex >= periods.length) {
    return null;
  }
  const p = periods[bidMonthIndex];
  return { startStr: p.start, endStr: p.end, name: p.name };
}

export function getAllBidPeriodsForYear(
  year: number
): Array<{ index: number; name: string; startStr: string; endStr: string }> {
  const periods = getBidPeriodsForYear(year);
  if (!periods) return [];
  return periods.map((p, i) => ({
    index: i,
    name: p.name,
    startStr: p.start,
    endStr: p.end,
  }));
}
