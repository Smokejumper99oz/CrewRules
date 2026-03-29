/** Bounds for `<input type="date">` and server validation (reject e.g. year 0026). */
export const MENTOR_NEXT_CHECK_IN_YEAR_MIN = 1900;
export const MENTOR_NEXT_CHECK_IN_YEAR_MAX = 2100;

export const MENTOR_NEXT_CHECK_IN_DATE_MIN = `${MENTOR_NEXT_CHECK_IN_YEAR_MIN}-01-01`;
export const MENTOR_NEXT_CHECK_IN_DATE_MAX = `${MENTOR_NEXT_CHECK_IN_YEAR_MAX}-12-31`;

/** `ymd` must be `YYYY-MM-DD` with a calendar year in range and parse as a valid date. */
export function isValidMentorNextCheckInYmd(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const y = Number(ymd.slice(0, 4));
  if (y < MENTOR_NEXT_CHECK_IN_YEAR_MIN || y > MENTOR_NEXT_CHECK_IN_YEAR_MAX) return false;
  const t = new Date(`${ymd}T12:00:00.000Z`).getTime();
  return !Number.isNaN(t);
}
