import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCrewEmailText } from "@/lib/email/parse-crew-email-text";
import { importIcsFromText } from "@/lib/schedule/import-ics-from-text";

export async function POST(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

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

  const contentType = req.headers.get("content-type") ?? "";

  console.log("[inbound-email] parsed content-type:", contentType);

  function pickField(
    source: FormData | URLSearchParams,
    keys: string[]
  ): string {
    for (const key of keys) {
      const value = source.get(key);
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  }

  function htmlToText(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\r/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  let from = "";
  let to = "";
  let subject = "";
  let bodyPlain = "";
  let bodyHtml = "";
  let rawBody = "";
  let timestamp = "";
  let token = "";
  let signature = "";
  let messageId = "";
  let form: FormData | null = null;

  if (contentType.includes("multipart/form-data")) {
    form = await req.formData();

    from = pickField(form, ["from", "From", "sender"]);
    to = pickField(form, ["recipient", "To", "to"]);
    subject = pickField(form, ["subject", "Subject"]);
    bodyPlain = pickField(form, ["body-plain", "stripped-text", "text"]);
    bodyHtml = pickField(form, ["body-html", "stripped-html", "html"]);
    timestamp = pickField(form, ["timestamp"]);
    token = pickField(form, ["token"]);
    signature = pickField(form, ["signature"]);
    messageId = pickField(form, ["Message-Id", "message-id", "Message-ID"]);

    console.log("[inbound-email] multipart keys:", [...form.keys()]);
  } else {
    rawBody = await req.text();

    console.log("[inbound-email] raw first 300:", rawBody.slice(0, 300));

    const params = new URLSearchParams(rawBody);

    console.log("[inbound-email] params keys:", [...params.keys()]);
    console.log("[inbound-email] params recipient:", params.get("recipient"));
    console.log("[inbound-email] params To:", params.get("To"));
    console.log("[inbound-email] params to:", params.get("to"));
    console.log("[inbound-email] params subject:", params.get("subject"));
    console.log("[inbound-email] params from:", params.get("from"));

    from = pickField(params, ["from", "From", "sender"]);
    to = pickField(params, ["recipient", "To", "to"]);
    subject = pickField(params, ["subject", "Subject"]);
    bodyPlain = pickField(params, ["body-plain", "stripped-text", "text"]);
    bodyHtml = pickField(params, ["body-html", "stripped-html", "html"]);
    timestamp = pickField(params, ["timestamp"]);
    token = pickField(params, ["token"]);
    signature = pickField(params, ["signature"]);
    messageId = pickField(params, ["Message-Id", "message-id", "Message-ID"]);
  }

  if (!timestamp || !token || !signature) {
    console.warn("[inbound-email] missing Mailgun signature fields");
    return new Response("Missing signature fields", { status: 400 });
  }

  const signingKey = process.env.MAILGUN_SIGNING_KEY!;
  const expected = crypto
    .createHmac("sha256", signingKey)
    .update(timestamp + token)
    .digest("hex");

  if (expected !== signature) {
    console.warn("[inbound-email] invalid Mailgun signature");
    return new Response("Invalid signature", { status: 403 });
  }

  console.log("[inbound-email] Mailgun signature verified");

  const bodyText = bodyPlain || (bodyHtml ? htmlToText(bodyHtml) : "");

  // Check for ICS attachment before requiring body (FLICA sends attachment-only emails)
  let hasIcsAttachment = false;
  const attachmentCount = form?.get("attachment-count");
  const attachmentCountNum = typeof attachmentCount === "string" ? parseInt(attachmentCount, 10) : 0;
  if (form && attachmentCountNum > 0) {
    for (let i = 1; i <= attachmentCountNum; i++) {
      const part = form.get(`attachment-${i}`);
      if (part instanceof File) {
        const name = (part.name ?? "").toLowerCase();
        const type = (part.type ?? "").toLowerCase();
        if (name.endsWith(".ics") || type === "text/calendar" || type === "application/ics") {
          hasIcsAttachment = true;
          console.log("[inbound-email] found ics attachment");
          break;
        }
      }
    }
  }

  if (!bodyText.trim() && !bodyHtml.trim() && !hasIcsAttachment) {
    console.warn("[inbound-email] missing email body", {
      subject,
      from,
      to,
      messageId,
    });
    return new Response("Missing body", { status: 400 });
  }

  // Extract email from "Name <email>" or use whole string
  const angleMatch = to.match(/<([^>]+)>/);
  const emailPart = angleMatch ? angleMatch[1].trim() : to;
  const aliasMatch = emailPart.trim().match(/([^@\s]+)@import\.crewrules\.com$/i);
  const alias = aliasMatch ? aliasMatch[1].trim().toLowerCase() : "";

  console.log("[inbound-email] extracted alias from normalized to:", {
    to,
    alias,
  });

  if (!alias) {
    console.warn("[inbound-email] missing alias from recipient", { to });
    return new Response("Missing alias", { status: 400 });
  }

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
  console.log("[inbound-email] body:", bodyText.slice(0, 1000));

  const parsed = parseCrewEmailText(bodyText);
  console.log("[inbound-email] parsed pairing:", parsed.pairingCode);

  const payload = {
    from,
    to,
    subject,
    bodyPlain,
    bodyHtml,
    rawBody,
  };

  if (messageId) {
    const { data: existing } = await supabase
      .from("inbound_email_events")
      .select("id")
      .eq("message_id", messageId)
      .maybeSingle();

    if (existing) {
      console.log("[inbound-email] duplicate message ignored:", messageId);
      return new Response("ok", { status: 200 });
    }
  }

  const { data: eventRow, error: eventInsertError } = await supabase
    .from("inbound_email_events")
    .insert({
      user_id: aliasRow.user_id,
      alias,
      sender: from,
      recipient: recipientText,
      subject,
      body_plain: bodyText,
      payload,
      message_id: messageId,
    })
    .select("id")
    .single();

  console.log("[inbound-email] event inserted");

  if (eventInsertError) {
    console.error("[inbound-email] event insert error", eventInsertError);
    return NextResponse.json({ ok: false, error: "event_insert_failed" }, { status: 500 });
  }

  // ICS detection and import
  let icsText: string | null = null;
  let icsFromAttachment = false;
  if (form && attachmentCountNum > 0) {
    for (let i = 1; i <= attachmentCountNum; i++) {
      const part = form.get(`attachment-${i}`);
      if (part instanceof File) {
        const name = (part.name ?? "").toLowerCase();
        const type = (part.type ?? "").toLowerCase();
        if (name.endsWith(".ics") || type === "text/calendar" || type === "application/ics") {
          icsText = await part.text();
          icsFromAttachment = true;
          console.log("[inbound-email] ics source: attachment");
          break;
        }
      }
    }
  }
  if (!icsText && /BEGIN:VCALENDAR/i.test(bodyText)) {
    icsText = bodyText;
    console.log("[inbound-email] ics source: body");
  }
  if (!icsText) {
    console.log("[inbound-email] no ics content found");
  }

  if (icsText) {
    if (icsFromAttachment) {
      console.log("[inbound-email] importing ics attachment for user:", aliasRow.user_id);
    } else {
      console.log("[inbound-email] importing ics for user:", aliasRow.user_id);
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant, portal, base_timezone")
      .eq("id", aliasRow.user_id)
      .maybeSingle();

    const result = await importIcsFromText({
      supabase,
      userId: aliasRow.user_id,
      icsText,
      sourceTimezone: profile?.base_timezone ?? null,
      tenant: profile?.tenant ?? "frontier",
      portal: profile?.portal ?? "pilots",
    });

    if ("error" in result) {
      console.log("[inbound-email] ics import error:", result.error, result.technicalError ?? "");
    } else {
      console.log("[inbound-email] ics import result:", result.success, "count:", result.count);
    }
  }

  return new Response("ok", { status: 200 });
}
