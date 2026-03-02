/**
 * Pay calculation utilities.
 */

export function payYearFromDOH(dohIso: string, now = new Date()): number {
  const doh = new Date(dohIso);
  const years =
    now.getFullYear() -
    doh.getFullYear() -
    (now < new Date(now.getFullYear(), doh.getMonth(), doh.getDate()) ? 1 : 0);
  return Math.min(12, Math.max(1, years + 1));
}
