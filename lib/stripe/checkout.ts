"use server";

import Stripe from "stripe";
import {
  STRIPE_SECRET_KEY,
  STRIPE_PRO_MONTHLY_PRICE_ID,
  STRIPE_PRO_ANNUAL_PRICE_ID,
  STRIPE_FOUNDING_PILOT_ANNUAL_PRICE_ID,
} from "./config";

export type BillingInterval = "pro_monthly" | "pro_annual" | "founding_pilot_annual";

type ProfileForCheckout = {
  id: string;
  email: string | null;
  full_name?: string | null;
  stripe_customer_id?: string | null;
};

function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

function getPriceId(interval: BillingInterval): string {
  if (interval === "pro_monthly") return STRIPE_PRO_MONTHLY_PRICE_ID;
  if (interval === "pro_annual") return STRIPE_PRO_ANNUAL_PRICE_ID;
  if (interval === "founding_pilot_annual") return STRIPE_FOUNDING_PILOT_ANNUAL_PRICE_ID;
  throw new Error(`Invalid billing interval: ${interval}`);
}

/**
 * Create a Stripe Checkout session for Pro subscription.
 * Does not update profiles; webhooks will handle activation.
 */
export async function createCheckoutSession(
  profile: ProfileForCheckout,
  interval: BillingInterval
): Promise<{ url: string }> {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured. Missing STRIPE_SECRET_KEY.");
  }

  const priceId = getPriceId(interval);
  if (!priceId) {
    const envKey =
      interval === "pro_monthly"
        ? "STRIPE_PRO_MONTHLY_PRICE_ID"
        : interval === "pro_annual"
          ? "STRIPE_PRO_ANNUAL_PRICE_ID"
          : "STRIPE_FOUNDING_PILOT_ANNUAL_PRICE_ID";
    throw new Error(`Stripe price not configured. Set ${envKey}.`);
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const baseUrl = getBaseUrl();
  const profilePath = "/frontier/pilots/portal/profile";
  const successUrl = `${baseUrl}${profilePath}?checkout=success`;
  const cancelUrl = `${baseUrl}${profilePath}?checkout=cancel`;

  let customerId: string | undefined;

  if (profile.stripe_customer_id) {
    customerId = profile.stripe_customer_id;
  } else {
    const customer = await stripe.customers.create({
      email: profile.email ?? undefined,
      name: profile.full_name ?? undefined,
      metadata: { user_id: profile.id },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { user_id: profile.id },
    subscription_data: {
      metadata: { user_id: profile.id },
    },
  });

  if (!session.url) {
    throw new Error("Stripe Checkout session created but no URL returned.");
  }

  return { url: session.url };
}
