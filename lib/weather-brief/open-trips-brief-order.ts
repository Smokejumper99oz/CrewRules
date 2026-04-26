/**
 * Pure ordering + iteration for Weather Brief open trips.
 * Keeps Next.js / Supabase out of unit tests (tsx can import this file safely).
 */

import type { NextFlightResult } from "./types";

/** Minimal shape for row ordering; full schedule rows satisfy this structurally. */
export type WeatherBriefOpenTripRow = {
  id: string;
  start_time: string;
  report_time?: string | null;
};

/**
 * Instant for in-progress vs future partitioning.
 * Prefers `report_time` when it is a real datetime; FLICA often stores HH:MM only, which does not parse
 * as a finite Date — then falls back to `start_time`. Returns null only when both are unusable.
 */
function pickOpenTripOrderingInstant(
  row: Pick<WeatherBriefOpenTripRow, "start_time" | "report_time">
): Date | null {
  const tryParse = (s: string | null | undefined): Date | null => {
    if (s == null || !String(s).trim()) return null;
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d : null;
  };
  const fromReport = tryParse(row.report_time);
  if (fromReport) return fromReport;
  const fromStart = tryParse(row.start_time);
  if (fromStart) return fromStart;
  return null;
}

/**
 * CrewRules™ Weather Brief rule: attempt EVERY open trip in priority order before giving up.
 * Do not regress to “try one row then return empty state” — a bad or unbriefable earlier row
 * must never block a valid later trip (e.g. red-eye S3090 after an earlier pairing row fails).
 */
export function briefOpenTripsInPriorityOrder<T extends WeatherBriefOpenTripRow>(
  rows: T[],
  nowIso: string,
  timezone: string,
  tryFlight: (ev: T, timezone: string) => NextFlightResult | null
): NextFlightResult | null {
  const inProgress = rows.filter((r) => {
    const d = pickOpenTripOrderingInstant(r);
    if (d) return d.toISOString() <= nowIso;
    return r.start_time <= nowIso;
  });
  const futureOnly = rows.filter((r) => {
    const d = pickOpenTripOrderingInstant(r);
    if (d) return d.toISOString() > nowIso;
    return r.start_time > nowIso;
  });
  const seenIds = new Set<string>();
  const ordered: T[] = [];
  for (const r of [...inProgress, ...futureOnly]) {
    if (seenIds.has(r.id)) continue;
    seenIds.add(r.id);
    ordered.push(r);
  }
  for (const row of ordered) {
    const brief = tryFlight(row, timezone);
    if (brief) return brief;
  }
  return null;
}
