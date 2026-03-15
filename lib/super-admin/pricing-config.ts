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
