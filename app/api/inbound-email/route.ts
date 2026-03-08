import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCrewEmailText } from "@/lib/email/parse-crew-email-text";

export async function POST(req: Request) {
  const url = new URL(req.url);

  const headerSecret = req.headers.get("x-inbound-secret");
  const querySecret = url.searchParams.get("secret");

  const expectedSecret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;

  if (headerSecret !== expectedSecret && querySecret !== expectedSecret) {
    console.error("Inbound email rejected: invalid secret", {
      headerSecret,
      querySecret,
    });

    return new NextResponse("Unauthorized", { status: 401 });
  }

  const form = await req.formData();

  const from = String(form.get("from") ?? "");
  const to = String(form.get("To") ?? form.get("recipient") ?? "");
  const subject = String(form.get("subject") ?? "");
  const text = String(form.get("body-plain") ?? "");
  const html = String(form.get("body-html") ?? "");

  const recipientText = to;

  const alias = recipientText.split("@")[0]?.trim().toLowerCase() ?? "";

  console.log("[inbound-email] recipient:", to);

  console.log("[inbound-email] alias:", alias);

  const supabase = createAdminClient();

  const { data: aliasRow, error: aliasError } = await supabase
    .from("inbound_email_aliases")
    .select("user_id, alias, is_active")
    .eq("alias", alias)
    .maybeSingle();

  if (aliasError) {
    console.error("[inbound-email] alias lookup error", aliasError);
    return NextResponse.json({ ok: false, error: "alias_lookup_failed" }, { status: 500 });
  }

  if (!aliasRow || !aliasRow.is_active) {
    return NextResponse.json({ ok: false, error: "unknown_alias" }, { status: 404 });
  }

  console.log("[inbound-email] user_id:", aliasRow.user_id);

  const body = text;

  console.log("[inbound-email] subject:", subject);
  console.log("[inbound-email] body:", body.slice(0, 1000));

  const parsed = parseCrewEmailText(body);
  console.log("[inbound-email] parsed pairing:", parsed.pairingCode);

  const payload = { from, to, subject, "body-plain": text, "body-html": html };

  const { data: eventRow, error: eventInsertError } = await supabase
    .from("inbound_email_events")
    .insert({
      user_id: aliasRow.user_id,
      alias,
      sender: from,
      recipient: recipientText,
      subject,
      body_plain: body,
      payload,
    })
    .select("id")
    .single();

  if (eventInsertError) {
    console.error("[inbound-email] event insert error", eventInsertError);
    return NextResponse.json({ ok: false, error: "event_insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, eventId: eventRow.id });
}
