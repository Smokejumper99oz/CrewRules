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

  const rawBody = await req.text();

  console.log("[inbound-email] content-type:", req.headers.get("content-type"));
  console.log("[inbound-email] raw first 300:", rawBody.slice(0, 300));

  const params = new URLSearchParams(rawBody);

  console.log("[inbound-email] params keys:", [...params.keys()]);
  console.log("[inbound-email] params recipient:", params.get("recipient"));
  console.log("[inbound-email] params To:", params.get("To"));
  console.log("[inbound-email] params to:", params.get("to"));
  console.log("[inbound-email] params subject:", params.get("subject"));
  console.log("[inbound-email] params from:", params.get("from"));

  const from = params.get("from") ?? "";
  const to = params.get("To") ?? params.get("recipient") ?? "";
  const subject = params.get("subject") ?? "";
  const bodyPlain = params.get("body-plain") ?? "";
  const bodyHtml = params.get("body-html") ?? "";

  const aliasMatch = to.match(/([^@<\s]+)@import\.crewrules\.com/i);
  const alias = aliasMatch ? aliasMatch[1].trim().toLowerCase() : "";

  console.log("[inbound-email] extracted alias:", alias);
  console.log("[inbound-email] from:", from);
  console.log("[inbound-email] subject:", subject);

  const recipientText = to;

  const supabase = createAdminClient();

  const { data: aliasRow, error: aliasError } = await supabase
    .from("inbound_email_aliases")
    .select("user_id, alias, is_active")
    .eq("alias", alias)
    .maybeSingle();

  console.log("[inbound-email] alias lookup result:", aliasRow);

  if (aliasError) {
    console.error("[inbound-email] alias lookup error", aliasError);
    return NextResponse.json({ ok: false, error: "alias_lookup_failed" }, { status: 500 });
  }

  if (!aliasRow || !aliasRow.is_active) {
    return NextResponse.json({ ok: false, error: "unknown_alias" }, { status: 404 });
  }

  console.log("[inbound-email] user_id:", aliasRow.user_id);

  console.log("[inbound-email] subject:", subject);
  console.log("[inbound-email] body:", bodyPlain.slice(0, 1000));

  const parsed = parseCrewEmailText(bodyPlain);
  console.log("[inbound-email] parsed pairing:", parsed.pairingCode);

  const payload = {
    from,
    to,
    subject,
    bodyPlain,
    bodyHtml,
    rawBody,
  };

  const { data: eventRow, error: eventInsertError } = await supabase
    .from("inbound_email_events")
    .insert({
      user_id: aliasRow.user_id,
      alias,
      sender: from,
      recipient: recipientText,
      subject,
      body_plain: bodyPlain,
      payload,
    })
    .select("id")
    .single();

  console.log("[inbound-email] event inserted");

  if (eventInsertError) {
    console.error("[inbound-email] event insert error", eventInsertError);
    return NextResponse.json({ ok: false, error: "event_insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, eventId: eventRow.id });
}
