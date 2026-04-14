import { NextResponse } from "next/server";
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
  let body: ResendWebhookBody;
  try {
    body = (await req.json()) as ResendWebhookBody;
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
