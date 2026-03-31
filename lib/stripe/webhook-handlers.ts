import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  STRIPE_PRO_MONTHLY_PRICE_ID,
  STRIPE_PRO_ANNUAL_PRICE_ID,
  STRIPE_FOUNDING_PILOT_ANNUAL_PRICE_ID,
} from "./config";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

function getBillingInterval(priceId: string): "monthly" | "annual" | null {
  if (priceId === STRIPE_PRO_MONTHLY_PRICE_ID) return "monthly";
  if (priceId === STRIPE_PRO_ANNUAL_PRICE_ID) return "annual";
  if (priceId === STRIPE_FOUNDING_PILOT_ANNUAL_PRICE_ID) return "annual";
  return null;
}

function isFoundingPilotPrice(priceId: string): boolean {
  return priceId === STRIPE_FOUNDING_PILOT_ANNUAL_PRICE_ID;
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

/** Get current period end from subscription (Basil API: on SubscriptionItem; legacy: on Subscription). */
function getSubscriptionCurrentPeriodEnd(subscription: Stripe.Subscription): number | null {
  const fromItem = subscription.items?.data?.[0] as { current_period_end?: number } | undefined;
  if (fromItem?.current_period_end) return fromItem.current_period_end;
  const fromSub = subscription as { current_period_end?: number };
  return typeof fromSub.current_period_end === "number" ? fromSub.current_period_end : null;
}

/** Gross/fee/net from the same BalanceTransaction Stripe uses for the charge (cents). */
function getChargeAndBalanceTransactionFromInvoice(
  inv: Stripe.Invoice
): { chargeId: string; balanceTransaction: Stripe.BalanceTransaction } | null {
  const list = inv.payments?.data;
  if (!list?.length) return null;

  const paid =
    list.find((p) => p.status === "paid" && (p.amount_paid ?? 0) > 0) ??
    list.find((p) => p.status === "paid") ??
    (list[0]?.is_default ? list[0] : null);

  if (!paid?.payment) return null;

  const { payment } = paid;
  if (payment.type === "charge" && payment.charge && typeof payment.charge === "object") {
    const charge = payment.charge as Stripe.Charge;
    const bt = charge.balance_transaction;
    if (bt && typeof bt === "object" && "amount" in bt) {
      return { chargeId: charge.id, balanceTransaction: bt as Stripe.BalanceTransaction };
    }
  }

  if (payment.type === "payment_intent" && payment.payment_intent && typeof payment.payment_intent === "object") {
    const pi = payment.payment_intent as Stripe.PaymentIntent;
    const lc = pi.latest_charge;
    if (lc && typeof lc === "object" && "balance_transaction" in lc) {
      const charge = lc as Stripe.Charge;
      const bt = charge.balance_transaction;
      if (bt && typeof bt === "object" && "amount" in bt) {
        return { chargeId: charge.id, balanceTransaction: bt as Stripe.BalanceTransaction };
      }
    }
  }

  return null;
}

async function upsertStripeSubscriptionPaymentRow(
  supabase: SupabaseAdmin,
  stripe: Stripe,
  invoice: Stripe.Invoice,
  subscription: Stripe.Subscription,
  profileId: string,
  subscriptionId: string
): Promise<void> {
  if (invoice.status !== "paid" || invoice.amount_paid <= 0) {
    return;
  }

  let fullInvoice: Stripe.Invoice;
  try {
    fullInvoice = await stripe.invoices.retrieve(invoice.id, {
      expand: [
        "payments.data.payment.charge.balance_transaction",
        "payments.data.payment.payment_intent.latest_charge.balance_transaction",
      ],
    });
  } catch (err) {
    console.error("[handleInvoicePaid] Failed to retrieve invoice for payment row", invoice.id, err);
    return;
  }

  const resolved = getChargeAndBalanceTransactionFromInvoice(fullInvoice);
  if (!resolved) {
    console.error(
      "[handleInvoicePaid] No balance transaction for subscription invoice; skipping payment row",
      invoice.id
    );
    return;
  }

  const { chargeId, balanceTransaction: bt } = resolved;

  const customerRaw = fullInvoice.customer ?? subscription.customer;
  const stripeCustomerId =
    typeof customerRaw === "string" ? customerRaw : customerRaw?.id ?? null;

  const priceRef = subscription.items?.data?.[0]?.price;
  const stripePriceId = typeof priceRef === "string" ? priceRef : priceRef?.id ?? null;

  const paidTs =
    fullInvoice.status_transitions?.paid_at ??
    (typeof bt.created === "number" ? bt.created : null);
  const paidAt =
    paidTs != null ? new Date(paidTs * 1000).toISOString() : new Date().toISOString();

  const row = {
    stripe_invoice_id: fullInvoice.id,
    stripe_charge_id: chargeId,
    stripe_balance_transaction_id: bt.id,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: stripePriceId,
    profile_id: profileId,
    amount_gross_cents: bt.amount,
    fee_cents: bt.fee,
    net_cents: bt.net,
    currency: bt.currency,
    paid_at: paidAt,
  };

  const { error } = await supabase.from("stripe_subscription_payments").upsert(row, {
    onConflict: "stripe_invoice_id",
  });

  if (error) {
    console.error("[handleInvoicePaid] stripe_subscription_payments upsert failed", fullInvoice.id, error);
  }
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
  const periodEnd = getSubscriptionCurrentPeriodEnd(subscription);

  const updates: Record<string, unknown> = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    subscription_status: status,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    billing_interval: billingInterval,
    updated_at: new Date().toISOString(),
  };

  if (isActive) {
    updates.subscription_tier = "pro";
    updates.billing_source = "stripe";
  }

  if (isActive && priceId && isFoundingPilotPrice(priceId)) {
    updates.is_founding_pilot = true;
    const { data: existing } = await supabase
      .from("profiles")
      .select("founding_pilot_started_at")
      .eq("id", profileId)
      .single();
    if (!existing?.founding_pilot_started_at) {
      updates.founding_pilot_started_at = new Date().toISOString();
    }
  }

  await supabase.from("profiles").update(updates).eq("id", profileId);

  if (isActive && priceId && isFoundingPilotPrice(priceId)) {
    const { error: claimError } = await supabase.rpc("claim_founding_pilot_number", {
      p_profile_id: profileId,
    });
    if (claimError) {
      throw new Error(`claim_founding_pilot_number: ${claimError.message}`);
    }
  }
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
  const subRef = (invoice as { subscription?: string | { id?: string } }).subscription;
  const subscriptionId = typeof subRef === "string" ? subRef : subRef?.id ?? null;

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
  const subRef = (invoice as { subscription?: string | { id?: string } }).subscription;
  const subscriptionId = typeof subRef === "string" ? subRef : subRef?.id ?? null;

  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const metadata = subscription.metadata as { user_id?: string } | null;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;

  const profileId = await resolveProfileId(supabase, metadata, customerId);
  if (!profileId) return;

  const periodEnd = getSubscriptionCurrentPeriodEnd(subscription);
  await supabase
    .from("profiles")
    .update({
      subscription_status: subscription.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  await upsertStripeSubscriptionPaymentRow(supabase, stripe, invoice, subscription, profileId, subscriptionId);
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
