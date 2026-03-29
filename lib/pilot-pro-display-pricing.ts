/**
 * Pilot-facing Pro list prices (USD) shown in portal pricing UI.
 * Must match Stripe list prices; used for display strings and savings math.
 */

export const PILOT_PRO_MONTHLY_DISPLAY_USD = 11.99;
export const PILOT_PRO_ANNUAL_DISPLAY_USD = 99;
export const PILOT_FOUNDING_ANNUAL_DISPLAY_USD = 59;

/** Yearly savings vs paying Pro Monthly for 12 months, at displayed list prices. */
export function getFoundingYearlySavingsVsProMonthlyUsd(): number {
  const raw = PILOT_PRO_MONTHLY_DISPLAY_USD * 12 - PILOT_FOUNDING_ANNUAL_DISPLAY_USD;
  return Math.round(raw * 100) / 100;
}

/**
 * Rounded percent saved vs 12× Pro Monthly price when choosing Founding annual (display only).
 */
export function getFoundingSavingsPercentVsProMonthlyRounded(): number {
  const annualizedMonthly = PILOT_PRO_MONTHLY_DISPLAY_USD * 12;
  if (annualizedMonthly <= 0) return 0;
  const savings = getFoundingYearlySavingsVsProMonthlyUsd();
  return Math.max(0, Math.round((savings / annualizedMonthly) * 100));
}

/**
 * Rounded percent saved vs 12× Pro Monthly price when choosing Pro Annual (display only).
 */
export function getProAnnualSavingsPercentVsProMonthlyRounded(): number {
  const annualizedMonthly = PILOT_PRO_MONTHLY_DISPLAY_USD * 12;
  if (annualizedMonthly <= 0) return 0;
  const savings = annualizedMonthly - PILOT_PRO_ANNUAL_DISPLAY_USD;
  return Math.max(0, Math.round((savings / annualizedMonthly) * 100));
}

export function formatUsdAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Currency string for plan prices (drops “.00” for whole dollars, e.g. $59). */
export function formatPilotListPriceUsd(amount: number): string {
  const n = Math.round(amount * 100) / 100;
  const hasCents = n % 1 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n);
}
