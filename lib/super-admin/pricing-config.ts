/**
 * Pre-billing estimated pricing values for Super Admin reporting only.
 * Not used for billing, Stripe, or pilot-facing features.
 */

export const PRO_MONTHLY_PRICE_USD = 0;

export const ENTERPRISE_MONTHLY_PRICE_USD: number | null = null;

/**
 * Live Stripe MRR: actual prices for Stripe-paid Pro users.
 * Used for live MRR/ARR calculations in Super Admin Cost & Monetization.
 * Set via env or override in config.
 */
export const STRIPE_PRO_MONTHLY_PRICE_USD =
  Number(process.env.STRIPE_PRO_MONTHLY_PRICE_USD) || 0;

export const STRIPE_PRO_ANNUAL_PRICE_USD =
  Number(process.env.STRIPE_PRO_ANNUAL_PRICE_USD) || 0;

export const STRIPE_FOUNDING_PILOT_ANNUAL_PRICE_USD =
  Number(process.env.STRIPE_FOUNDING_PILOT_ANNUAL_PRICE_USD) || 0;

/**
 * FlightAware AeroAPI cost per request (Super Admin reporting only).
 * Temporary default; update when actual pricing is known.
 */
export const FLIGHTAWARE_COST_PER_REQUEST_USD =
  Number(process.env.FLIGHTAWARE_COST_PER_REQUEST_USD) || 0.01;

/**
 * AviationStack monthly request limit (Super Admin reporting only).
 * From plan: Free=100, Basic=10000, Professional=50000, etc.
 */
export const AVIATIONSTACK_MONTHLY_LIMIT =
  Number(process.env.AVIATIONSTACK_MONTHLY_LIMIT) || 10_000;

/**
 * AviationStack cost per request (Super Admin reporting only).
 * Per-request pricing for estimated cost display.
 */
export const AVIATIONSTACK_COST_PER_REQUEST_USD =
  Number(process.env.AVIATIONSTACK_COST_PER_REQUEST_USD) || 0.009998;

/**
 * AviationStack billing period config (aligns usage tracking with provider billing).
 * AVIATIONSTACK_PERIOD_START_DAY: day of month when billing period starts (1–31).
 * AVIATIONSTACK_PERIOD_LENGTH_DAYS: length of each billing period in days.
 */
export const AVIATIONSTACK_PERIOD_START_DAY =
  Number(process.env.AVIATIONSTACK_PERIOD_START_DAY) || 1;

export const AVIATIONSTACK_PERIOD_LENGTH_DAYS =
  Number(process.env.AVIATIONSTACK_PERIOD_LENGTH_DAYS) || 30;
