import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  STRIPE_SECRET_KEY,
  STRIPE_PRO_MONTHLY_PRICE_ID,
  STRIPE_PRO_ANNUAL_PRICE_ID,
} from "./config";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

function getBillingInterval(priceId: string): "monthly" | "annual" | null {
  if (priceId === STRIPE_PRO_MONTHLY_PRICE_ID) return "monthly";
  if (priceId === STRIPE_PRO_ANNUAL_PRICE_ID) return "annual";
  return null;
}

/**
 * Resolve profile id from subscription or session metadata.
 * Order: metadata.user_id > stripe_customer_id lookup > (avoid email-only if ambiguous)
 */
async function resolveProfileId(
  supabase: SupabaseAdmin,
  metadata: { user_id?: string } | null,
  stripeCustomerId: string | null
): Promise<string | null> {
  if (metadata?.user_id) return metadata.user_id;

  if (stripeCustomerId) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  return null;
}

async function syncSubscriptionToProfile(
  supabase: SupabaseAdmin,
  profileId: string,
  subscription: Stripe.Subscription
): Promise<void> {
  const status = subscription.status;
  const isActive = status === "active" || status === "trialing";
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const billingInterval = priceId ? getBillingInterval(priceId) : null;

  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;

  const updates: Record<string, unknown> = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    subscription_status: status,
    current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    billing_interval: billingInterval,
    updated_at: new Date().toISOString(),
  };

  if (isActive) {
    updates.subscription_tier = "pro";
    updates.billing_source = "stripe";
  }

  await supabase.from("profiles").update(updates).eq("id", profileId);
}

export async function handleCustomerSubscriptionCreated(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  event: Stripe.Event
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const metadata = subscription.metadata as { user_id?: string } | null;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;

  const profileId = await resolveProfileId(supabase, metadata, customerId);
  if (!profileId) {
    throw new Error(`Cannot resolve profile for subscription ${subscription.id}`);
  }

  const status = subscription.status;
  if (status !== "active" && status !== "trialing") {
    return;
  }

  await syncSubscriptionToProfile(supabase, profileId, subscription);
}

export async function handleCustomerSubscriptionUpdated(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  event: Stripe.Event
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const metadata = subscription.metadata as { user_id?: string } | null;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;

  const profileId = await resolveProfileId(supabase, metadata, customerId);
  if (!profileId) {
    throw new Error(`Cannot resolve profile for subscription ${subscription.id}`);
  }

  await syncSubscriptionToProfile(supabase, profileId, subscription);
}

export async function handleCustomerSubscriptionDeleted(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  event: Stripe.Event
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const metadata = subscription.metadata as { user_id?: string } | null;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;

  const profileId = await resolveProfileId(supabase, metadata, customerId);
  if (!profileId) {
    throw new Error(`Cannot resolve profile for subscription ${subscription.id}`);
  }

  await supabase
    .from("profiles")
    .update({
      subscription_tier: "free",
      stripe_subscription_id: null,
      stripe_price_id: null,
      subscription_status: "canceled",
      current_period_end: null,
      cancel_at_period_end: false,
      billing_interval: null,
      billing_source: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);
}

export async function handleInvoicePaymentFailed(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  event: Stripe.Event
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id ?? null;

  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const metadata = subscription.metadata as { user_id?: string } | null;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;

  const profileId = await resolveProfileId(supabase, metadata, customerId);
  if (!profileId) return;

  await supabase
    .from("profiles")
    .update({
      subscription_status: "past_due",
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);
}

export async function handleInvoicePaid(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  event: Stripe.Event
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id ?? null;

  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const metadata = subscription.metadata as { user_id?: string } | null;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;

  const profileId = await resolveProfileId(supabase, metadata, customerId);
  if (!profileId) return;

  await supabase
    .from("profiles")
    .update({
      subscription_status: subscription.status,
      current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);
}

export async function handleCheckoutSessionCompleted(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  event: Stripe.Event
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = session.metadata as { user_id?: string } | null;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;

  if (!subscriptionId || !metadata?.user_id) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const status = subscription.status;
  if (status !== "active" && status !== "trialing") return;

  await syncSubscriptionToProfile(supabase, metadata.user_id, subscription);
}

export type WebhookHandler = (
  supabase: SupabaseAdmin,
  stripe: Stripe,
  event: Stripe.Event
) => Promise<void>;

const HANDLERS: Record<string, WebhookHandler> = {
  "customer.subscription.created": handleCustomerSubscriptionCreated,
  "customer.subscription.updated": handleCustomerSubscriptionUpdated,
  "customer.subscription.deleted": handleCustomerSubscriptionDeleted,
  "invoice.payment_failed": handleInvoicePaymentFailed,
  "invoice.paid": handleInvoicePaid,
  "checkout.session.completed": handleCheckoutSessionCompleted,
};

export function getHandler(eventType: string): WebhookHandler | null {
  return HANDLERS[eventType] ?? null;
}
