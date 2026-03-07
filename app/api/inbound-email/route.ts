import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseCrewEmailText } from "@/lib/email/parse-crew-email-text";

export async function POST(req: Request) {
  const secret = req.headers.get("x-inbound-secret");
  if (secret !== process.env.INBOUND_EMAIL_WEBHOOK_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const payload = await req.json();

  const recipient =
    payload.recipient ||
    payload.To ||
    payload.to ||
    payload.envelope?.to;

  console.log("[inbound-email] recipient:", recipient);

  const recipientValue = Array.isArray(recipient) ? recipient[0] : recipient;
  const recipientText = typeof recipientValue === "string" ? recipientValue : "";

  const alias = recipientText.split("@")[0]?.trim().toLowerCase() ?? "";

  console.log("[inbound-email] alias:", alias);

  const supabase = await createClient();

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

  const subject = payload.subject || payload.Subject || "";
  const body =
    payload["body-plain"] ||
    payload["stripped-text"] ||
    payload.text ||
    payload.body ||
    "";

  console.log("[inbound-email] subject:", subject);
  console.log("[inbound-email] body:", body.slice(0, 1000));

  const parsed = parseCrewEmailText(body);
  console.log("[inbound-email] parsed pairing:", parsed.pairingCode);

  const { data: eventRow, error: eventInsertError } = await supabase
    .from("inbound_email_events")
    .insert({
      user_id: aliasRow.user_id,
      alias,
      sender: payload.sender || payload.from || "",
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
