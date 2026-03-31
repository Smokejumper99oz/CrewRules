/**
 * Stripe Customer Portal. Server-only.
 */

import Stripe from "stripe";
import { FRONTIER_PILOTS_PORTAL_SETTINGS_DEFAULT_PATH } from "@/lib/frontier-pilots-portal-settings-default";
import { STRIPE_SECRET_KEY } from "./config";

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

/**
 * Create a Stripe Checkout session for the Customer Portal.
 */
export async function createPortalSession(stripeCustomerId: string): Promise<{ url: string }> {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured. Missing STRIPE_SECRET_KEY.");
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const returnUrl = `${getBaseUrl()}${FRONTIER_PILOTS_PORTAL_SETTINGS_DEFAULT_PATH}`;

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  if (!session.url) {
    throw new Error("Stripe portal session created but no URL returned.");
  }

  return { url: session.url };
}
