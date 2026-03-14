/**
 * FAR 117 Appendix Table B — Flight Duty Period: Unaugmented Operations.
 * Max FDP (hours) by scheduled report time (acclimated) and segment count.
 * Source: 14 CFR Part 117 Appendix B.
 */
const TABLE_B_HOURS: readonly (readonly number[])[] = [
  [9, 9, 9, 9, 9, 9, 9],       // 0000-0359
  [10, 10, 10, 10, 9, 9, 9],   // 0400-0459
  [12, 12, 12, 12, 11.5, 11, 10.5],   // 0500-0559
  [13, 13, 12, 12, 11.5, 11, 10.5],   // 0600-0659
  [14, 14, 13, 13, 12.5, 12, 11.5],   // 0700-1159
  [13, 13, 13, 13, 12.5, 12, 11.5],   // 1200-1259
  [12, 12, 12, 12, 11.5, 11, 10.5],   // 1300-1659
  [12, 12, 11, 11, 10, 9, 9],         // 1700-2159
  [11, 11, 10, 10, 9, 9, 9],          // 2200-2259
  [10, 10, 10, 9, 9, 9, 9],           // 2300-2359
];

/** Map hour (0-23) to Table B row index. */
function hourToRowIndex(hour: number): number {
  if (hour >= 0 && hour <= 3) return 0;
  if (hour === 4) return 1;
  if (hour === 5) return 2;
  if (hour === 6) return 3;
  if (hour >= 7 && hour <= 11) return 4;
  if (hour === 12) return 5;
  if (hour >= 13 && hour <= 16) return 6;
  if (hour >= 17 && hour <= 21) return 7;
  if (hour === 22) return 8;
  if (hour === 23) return 9;
  return 0; // fallback
}

/** Map segment count (1-7+) to Table B column index (0-6). */
function segmentCountToColIndex(segmentCount: number): number {
  if (segmentCount <= 0) return 0;
  if (segmentCount >= 7) return 6;
  return segmentCount - 1;
}

/**
 * Returns max FDP in minutes per FAR 117 Table B (unaugmented).
 * @param reportTimeLocal "HH:MM" in acclimated local time
 * @param segmentCount number of flight segments (clamped to 1-7+)
 * @returns max FDP minutes, or null if reportTimeLocal is invalid
 */
export function getFar117MaxFdpMinutes(
  reportTimeLocal: string,
  segmentCount: number
): number | null {
  const match = reportTimeLocal.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  if (hour < 0 || hour > 23) return null;
  const row = hourToRowIndex(hour);
  const col = segmentCountToColIndex(Math.max(0, Math.floor(segmentCount)));
  const hours = TABLE_B_HOURS[row][col];
  return Math.round(hours * 60);
}
