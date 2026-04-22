import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe/config";
import { getHandler } from "@/lib/stripe/webhook-handlers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (err) {
    console.error("[stripe/webhook] Failed to read body", err);
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const stripeEventId = event.id;
  const eventType = event.type;

  const payload = event.data.object as unknown as Record<string, unknown>;
  const payloadForLog = {
    id: payload?.id,
    object: payload?.object,
    customer: payload?.customer,
    subscription: payload?.subscription,
    status: payload?.status,
  };

  const { error: insertError } = await supabase.from("stripe_webhook_events").insert({
    stripe_event_id: stripeEventId,
    event_type: eventType,
    payload: payloadForLog,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true });
    }
    console.error("[stripe/webhook] Failed to insert event", insertError);
    return NextResponse.json({ error: "Failed to log event" }, { status: 500 });
  }

  const handler = getHandler(eventType);
  if (!handler) {
    await supabase
      .from("stripe_webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("stripe_event_id", stripeEventId);
    return NextResponse.json({ received: true });
  }

  try {
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    await handler(supabase, stripe, event);

    await supabase
      .from("stripe_webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("stripe_event_id", stripeEventId);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[stripe/webhook] Handler error", eventType, stripeEventId, err);

    await supabase
      .from("stripe_webhook_events")
      .update({ error: errorMessage })
      .eq("stripe_event_id", stripeEventId);

    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
