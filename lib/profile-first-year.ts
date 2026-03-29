/** True when hire date (YYYY-MM-DD) is between day 0 and day 365 inclusive since hire. */
export function isWithinFirstYearSinceDateOfHire(dateOfHire: string | null | undefined): boolean {
  if (!dateOfHire || typeof dateOfHire !== "string") return false;
  const ymd = dateOfHire.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const hire = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(hire.getTime())) return false;
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysSinceHire = (now.getTime() - hire.getTime()) / msPerDay;
  return daysSinceHire >= 0 && daysSinceHire <= 365;
}
