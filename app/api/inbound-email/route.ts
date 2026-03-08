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

  // --- RAW EMAIL MODE (Mailgun) ---

  const rawBody = await req.text();

  console.log("[inbound-email] content-type:", req.headers.get("content-type"));
  console.log("[inbound-email] raw first 300:", rawBody.slice(0, 300));

  // Extract headers from the raw email
  function extractHeader(name: string, text: string) {
    const regex = new RegExp(`^${name}:\\s*(.*)$`, "im");
    const match = text.match(regex);
    return match ? match[1].trim() : "";
  }

  const from = extractHeader("From", rawBody);
  const to = extractHeader("To", rawBody);
  const subject = extractHeader("Subject", rawBody);

  // Extract alias from email address
  const aliasMatch = to.match(/([^@<\s]+)@import\.crewrules\.com/i);
  const alias = aliasMatch ? aliasMatch[1].trim().toLowerCase() : "";

  console.log("[inbound-email] extracted alias:", alias);
  console.log("[inbound-email] from:", from);
  console.log("[inbound-email] subject:", subject);

  const recipientText = to;

  // Extract body (content after headers)
  const bodyMatch = rawBody.match(/\r?\n\r?\n([\s\S]*)/);
  const body = bodyMatch ? bodyMatch[1].trim() : "";

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
  console.log("[inbound-email] body:", body.slice(0, 1000));

  const parsed = parseCrewEmailText(body);
  console.log("[inbound-email] parsed pairing:", parsed.pairingCode);

  const payload = { from, to, subject, rawBody };

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

  console.log("[inbound-email] event inserted");

  if (eventInsertError) {
    console.error("[inbound-email] event insert error", eventInsertError);
    return NextResponse.json({ ok: false, error: "event_insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, eventId: eventRow.id });
}
