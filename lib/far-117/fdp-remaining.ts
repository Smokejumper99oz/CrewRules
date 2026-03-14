/**
 * FAR 117 FDP elapsed and remaining helpers.
 * Pure functions; no side effects.
 */

/**
 * Computes elapsed FDP in whole minutes between report (FDP start) and end.
 * @param reportTimeIso FDP start as UTC ISO string
 * @param endIso end time as UTC ISO string (e.g. event.end_time or now)
 * @returns elapsed minutes, or null if dates are invalid
 */
export function computeProjectedFdpElapsedMinutes(
  reportTimeIso: string,
  endIso: string
): number | null {
  const start = new Date(reportTimeIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.floor((end - start) / 60_000);
}

/**
 * Computes remaining FDP minutes. Negative when exceeded.
 */
export function computeFdpRemainingMinutes(
  maxFdpMinutes: number,
  elapsedMinutes: number
): number {
  return maxFdpMinutes - elapsedMinutes;
}
