import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Resend webhook POST body (minimal shape for email.opened). */
type ResendWebhookBody = {
  type?: string;
  data?: {
    email_id?: string;
    to?: string[];
  };
};

export async function POST(req: Request) {
  const rawBody = await req.text();

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error(
      "[resend/webhook] signature verification failed: missing Svix headers (svix-id, svix-timestamp, and/or svix-signature)"
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret?.trim()) {
    console.error("[resend/webhook] signature verification failed: RESEND_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const wh = new Webhook(webhookSecret);
    wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (e) {
    console.error("[resend/webhook] signature verification failed: invalid signature or payload", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ResendWebhookBody;
  try {
    body = JSON.parse(rawBody) as ResendWebhookBody;
  } catch (e) {
    console.error("[resend/webhook] invalid JSON", e);
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (body.type !== "email.opened") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const resend_email_id = body.data?.email_id;
  if (!resend_email_id || typeof resend_email_id !== "string") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const email = body.data?.to?.[0] ?? null;

  try {
    const admin = createAdminClient();
    const { data: sentRow } = await admin
      .from("mentor_email_events")
      .select("assignment_id")
      .eq("resend_email_id", resend_email_id)
      .eq("event_type", "sent")
      .limit(1)
      .maybeSingle();

    const { error: logError } = await admin.from("mentor_email_events").insert({
      assignment_id: sentRow?.assignment_id ?? null,
      email,
      event_type: "opened",
      resend_email_id,
    });

    if (logError) {
      console.error("[mentor_email_events] insert error", logError);
    }
  } catch (e) {
    console.error("[mentor_email_events] unexpected error", e);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
