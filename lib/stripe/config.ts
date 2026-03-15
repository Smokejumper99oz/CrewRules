/**
 * Stripe config. Server-only. Use process.env for secrets.
 */

export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
export const STRIPE_PRO_MONTHLY_PRICE_ID = process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? "";
export const STRIPE_PRO_ANNUAL_PRICE_ID = process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? "";

/** True if Stripe is configured (secret key present). */
export function hasStripeConfig(): boolean {
  return Boolean(STRIPE_SECRET_KEY);
}
