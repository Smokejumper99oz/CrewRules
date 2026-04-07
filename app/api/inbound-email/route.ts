import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCrewEmailText } from "@/lib/email/parse-crew-email-text";
import { parseElpPairingNotification } from "@/lib/email/parse-elp-pairing-notification";
import { importIcsFromText } from "@/lib/schedule/import-ics-from-text";
import { importFlicaHtmlFromText } from "@/lib/schedule/import-flica-html";
import { isFlicaHtml } from "@/lib/schedule/parse-flica-html";

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
  let params: URLSearchParams | null = null;

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

    const decodedRaw = decodeURIComponent(rawBody.replace(/\+/g, " "));
    const htmlMatch = decodedRaw.match(/<html[\s\S]*<\/html>/i);
    if (htmlMatch) {
      console.log("[inbound-email] html extracted from raw body");
      bodyHtml = htmlMatch[0];
    }

    params = new URLSearchParams(rawBody);

    console.log("[inbound-email] form keys:", Array.from(params.keys()));
    console.log("[inbound-email] params recipient:", params.get("recipient"));
    console.log("[inbound-email] params To:", params.get("To"));
    console.log("[inbound-email] params to:", params.get("to"));
    console.log("[inbound-email] params subject:", params.get("subject"));
    console.log("[inbound-email] params from:", params.get("from"));

    from = pickField(params, ["from", "From", "sender"]);
    to = pickField(params, ["recipient", "To", "to"]);
    subject = pickField(params, ["subject", "Subject"]);
    bodyPlain = pickField(params, ["body-plain", "stripped-text", "text"]);
    bodyHtml = bodyHtml || pickField(params, ["body-html", "stripped-html", "html"]);
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

  // Extract alias first (needed for ICS import from attachment)
  const angleMatch = to.match(/<([^>]+)>/);
  const emailPart = angleMatch ? angleMatch[1].trim() : to;
  const aliasMatch = emailPart.trim().match(/([^@\s]+)@import\.crewrules\.com$/i);
  const alias = aliasMatch ? aliasMatch[1].trim().toLowerCase() : "";

  console.log("[inbound-email] extracted alias from normalized to:", {
    to,
    alias,
  });

  const supabase = createAdminClient();

  // 1. Multipart: read attachment text and detect ICS or FLICA HTML (before body check)
  const attachmentCount = form?.get("attachment-count");
  const attachmentCountNum = typeof attachmentCount === "string" ? parseInt(attachmentCount, 10) : 0;
  const maxAttachments = attachmentCountNum > 0 ? attachmentCountNum : 10;
  let icsTextFromAttachment: string | null = null;
  let flicaHtmlFromAttachment: string | null = null;

  if (form) {
    for (let i = 1; i <= maxAttachments; i++) {
      const key = `attachment-${i}`;
      const part = form.get(key);
      if (!part) break;
      if (part instanceof File) {
        const text = await part.text();
        console.log("[inbound-email] reading attachment text from:", key);
        console.log("[inbound-email] attachment text length:", text.length);

        if (/BEGIN:VCALENDAR/i.test(text)) {
          icsTextFromAttachment = text;
          console.log("[inbound-email] detected ics content from attachment");
          break;
        }
        if (isFlicaHtml(text)) {
          flicaHtmlFromAttachment = text;
          console.log("[inbound-email] detected flica html calendar from attachment");
          break;
        }
      }
    }
  }

  // 2. If ICS attachment found: resolve alias, mark processed, import, return success immediately
  if (icsTextFromAttachment && alias) {
    const { data: aliasRow, error: aliasError } = await supabase
      .from("inbound_email_aliases")
      .select("user_id, alias, is_active")
      .eq("alias", alias)
      .maybeSingle();

    if (!aliasError && aliasRow?.is_active) {
      const { error: markError } = await supabase.from("inbound_email_events").insert({
        user_id: aliasRow.user_id,
        alias,
        sender: from,
        recipient: to,
        subject,
        body_plain: "",
        payload: { from, to, subject, bodyPlain: "", bodyHtml: "", rawBody: "" },
      });
      if (markError) {
        const isDuplicate = /duplicate key value|unique constraint/i.test(markError.message);
        if (isDuplicate) {
          console.log("[inbound-email] duplicate message ignored (race)");
          return new Response("ok", { status: 200 });
        }
        console.error("[inbound-email] event insert error (ics attachment):", markError);
        return NextResponse.json({ ok: false, error: "event_insert_failed" }, { status: 500 });
      }
      console.log("[inbound-email] importing ics attachment for user:", aliasRow.user_id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant, portal, base_timezone")
        .eq("id", aliasRow.user_id)
        .maybeSingle();

      const result = await importIcsFromText({
        supabase,
        userId: aliasRow.user_id,
        icsText: icsTextFromAttachment,
        sourceTimezone: profile?.base_timezone ?? null,
        tenant: profile?.tenant ?? "frontier",
        portal: profile?.portal ?? "pilots",
      });

      if ("error" in result) {
        console.log("[inbound-email] ics import error:", result.error, result.technicalError ?? "");
      } else {
        console.log("[inbound-email] ics import result:", result.success, "count:", result.count);
      }
      return new Response("ok", { status: 200 });
    }
  }

  // 3. If FLICA HTML attachment found: resolve alias, mark processed, import, return success immediately
  if (flicaHtmlFromAttachment && alias) {
    const { data: aliasRow, error: aliasError } = await supabase
      .from("inbound_email_aliases")
      .select("user_id, alias, is_active")
      .eq("alias", alias)
      .maybeSingle();

    if (!aliasError && aliasRow?.is_active) {
      const { error: markError } = await supabase.from("inbound_email_events").insert({
        user_id: aliasRow.user_id,
        alias,
        sender: from,
        recipient: to,
        subject,
        body_plain: "",
        payload: { from, to, subject, bodyPlain: "", bodyHtml: "", rawBody: "" },
      });
      if (markError) {
        const isDuplicate = /duplicate key value|unique constraint/i.test(markError.message);
        if (isDuplicate) {
          console.log("[inbound-email] duplicate message ignored (race)");
          return new Response("ok", { status: 200 });
        }
        console.error("[inbound-email] event insert error (flica attachment):", markError);
        return NextResponse.json({ ok: false, error: "event_insert_failed" }, { status: 500 });
      }
      console.log("[inbound-email] detected flica html calendar");
      console.log("[inbound-email] flica html import start");
      console.log("[inbound-email] attachment text length:", flicaHtmlFromAttachment.length);
      console.log(
        "[inbound-email] attachment preview:",
        flicaHtmlFromAttachment.slice(0, 500)
      );

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant, portal, base_timezone")
          .eq("id", aliasRow.user_id)
          .maybeSingle();

        const result = await importFlicaHtmlFromText({
          supabase,
          userId: aliasRow.user_id,
          htmlText: flicaHtmlFromAttachment,
          sourceTimezone: profile?.base_timezone ?? null,
          tenant: profile?.tenant ?? "frontier",
          portal: profile?.portal ?? "pilots",
        });

        if ("error" in result) {
          console.log("[inbound-email] flica html import error:", result.error, result.technicalError ?? "");
        } else {
          console.log("[inbound-email] flica html import result:", result.success, "count:", result.count);
        }
      } catch (err) {
        const ex = err instanceof Error ? err : new Error(String(err));
        console.error("[inbound-email] flica html import crash:", ex.message);
        console.error("[inbound-email] flica html import stack:", ex.stack);
        console.error("[inbound-email] flica html first 200 chars:", flicaHtmlFromAttachment.slice(0, 200));
      }
      return new Response("ok", { status: 200 });
    }
  }

  // 4. Only NOW perform body check — return missing body only if no body AND no usable attachment
  if (!bodyText.trim() && !bodyHtml.trim() && !icsTextFromAttachment && !flicaHtmlFromAttachment) {
    console.warn("[inbound-email] missing email body", {
      subject,
      from,
      to,
      messageId,
    });
    return new Response("Missing body", { status: 400 });
  }

  // 5. Rest of flow: alias required for non-attachment path
  if (!alias) {
    console.warn("[inbound-email] missing alias from recipient", { to });
    return new Response("Missing alias", { status: 400 });
  }

  console.log("[inbound-email] from:", from);
  console.log("[inbound-email] subject:", subject);

  const recipientText = to;

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
    })
    .select("id")
    .single();

  console.log("[inbound-email] event inserted");

  if (eventInsertError) {
    const isDuplicate = /duplicate key value|unique constraint/i.test(eventInsertError.message);
    if (isDuplicate) {
      console.log("[inbound-email] duplicate message ignored (race)");
      return new Response("ok", { status: 200 });
    }
    console.error("[inbound-email] event insert error", eventInsertError);
    return NextResponse.json({ ok: false, error: "event_insert_failed" }, { status: 500 });
  }

  {
    const parsed = parseElpPairingNotification(bodyText);
    console.log("[inbound-email] parsed ELP:", parsed);
    if (!parsed.pairingCode) {
      console.log("[inbound-email] no pairing code found → skipping ELP update");
    } else {
      console.log("[inbound-email] applying ELP update for pairing:", parsed.pairingCode);

      const pairingFamily = parsed.pairingCode.replace(/[A-Z]$/i, "");

      // 1. Find existing trip rows for this pairing
      const { data: existingTrips, error: tripError } = await supabase
        .from("schedule_events")
        .select("*")
        .eq("user_id", aliasRow.user_id)
        .ilike("title", `%${pairingFamily}%`);

      console.log("[ELP DEBUG] pairingFamily:", pairingFamily);
      console.log("[ELP DEBUG] trips found:", existingTrips?.length);

      if (tripError) {
        console.error("[inbound-email] failed to load trips", tripError);
      } else if (!existingTrips || existingTrips.length === 0) {
        console.log("[inbound-email] no matching trip found for pairing", parsed.pairingCode);
      } else {
        console.log("[inbound-email] found trips:", existingTrips.length);

        const trip = existingTrips[0];

        if (!trip) {
          console.log("[inbound-email] no trip to update");
        } else {
          console.log("[inbound-email] updating trip:", trip.id);

          const currentLegs = Array.isArray(trip.legs) ? [...trip.legs] : [];

          const updatedLegs = currentLegs.filter((l: any) => {
            return !parsed.legsDeleted.some((d) =>
              String(l.flightNumber || "").includes(d.flightNumber)
            );
          });

          for (const leg of parsed.legsAdded) {
            updatedLegs.push({
              flightNumber: leg.flightNumber,
              origin: leg.dep,
              destination: leg.arr,
              depTime: leg.depText,
              arrTime: leg.arrText,
              blockMinutes: null,
              deadhead: leg.deadhead,
              raw: "ELP update",
            });
          }

          const newReport =
            parsed.dutyModifications?.[0]?.reportText || trip.report_time;

          const newTitle = `Trip ${parsed.pairingCode}`;

          const { error: updateError } = await supabase
            .from("schedule_events")
            .update({
              title: newTitle,
              legs: updatedLegs,
              report_time: newReport,
            })
            .eq("id", trip.id);

          if (updateError) {
            console.error("[inbound-email] trip update error", updateError);
          } else {
            console.log("[inbound-email] trip updated successfully");
          }
        }
      }
    }
  }

  // ICS from body (when not from attachment)
  let icsText: string | null = icsTextFromAttachment;
  if (!icsText && /BEGIN:VCALENDAR/i.test(bodyText)) {
    icsText = bodyText;
    console.log("[inbound-email] ics source: body");
  }
  if (!icsText) {
    // Try FLICA HTML (body or attachment)
    let htmlContent: string | null = null;
    if (bodyHtml?.trim()) htmlContent = bodyHtml;
    if (!htmlContent && form) {
      for (let i = 1; i <= maxAttachments; i++) {
        const part = form.get(`attachment-${i}`);
        if (!part) break;
        if (part instanceof File) {
          const name = (part.name ?? "").toLowerCase();
          const type = (part.type ?? "").toLowerCase();
          if (name.endsWith(".html") || type === "text/html") {
            htmlContent = await part.text();
            break;
          }
        }
      }
    }
    if (htmlContent && isFlicaHtml(htmlContent) && aliasRow) {
      console.log("[inbound-email] detected flica html calendar");
      console.log("[inbound-email] importing flica html for user:", aliasRow.user_id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant, portal, base_timezone")
        .eq("id", aliasRow.user_id)
        .maybeSingle();

      const result = await importFlicaHtmlFromText({
        supabase,
        userId: aliasRow.user_id,
        htmlText: htmlContent,
        sourceTimezone: profile?.base_timezone ?? null,
        tenant: profile?.tenant ?? "frontier",
        portal: profile?.portal ?? "pilots",
      });

      if ("error" in result) {
        console.log("[inbound-email] flica html import error:", result.error, result.technicalError ?? "");
      } else {
        console.log("[inbound-email] flica html import result:", result.success, "count:", result.count);
      }
      return new Response("ok", { status: 200 });
    }

    // Debug: why no ICS content found
    const source = form ?? params;
    const hasBodyPlain = source && (() => {
      const v = source.get("body-plain");
      return typeof v === "string" && v.trim().length > 0;
    })();
    const hasBodyHtml = source && (() => {
      const v = source.get("body-html");
      return typeof v === "string" && v.trim().length > 0;
    })();
    const hasStrippedText = source && (() => {
      const v = source.get("stripped-text");
      return typeof v === "string" && v.trim().length > 0;
    })();
    const attachmentCandidates: { key: string; filename?: string; mimeType?: string; size?: number }[] = [];
    if (form) {
      const count = typeof form.get("attachment-count") === "string" ? parseInt(form.get("attachment-count") as string, 10) : 0;
      const max = count > 0 ? count : 10;
      for (let i = 1; i <= max; i++) {
        const key = `attachment-${i}`;
        const part = form.get(key);
        if (!part) break;
        if (part instanceof File) {
          attachmentCandidates.push({
            key,
            filename: part.name ?? undefined,
            mimeType: part.type || undefined,
            size: part.size,
          });
        }
      }
    }
    const bodyHasBeginVcalendar = /BEGIN:VCALENDAR/i.test(bodyText);
    const bodyHasBeginVevent = /BEGIN:VEVENT/i.test(bodyText);
    const candidatePreview = bodyText.trim().slice(0, 200) || "(empty)";
    console.log("[inbound-email] ics debug: no ics content found", {
      hasBodyPlain,
      hasBodyHtml,
      hasStrippedText,
      attachmentCandidatesCount: attachmentCandidates.length,
      attachmentCandidates,
      bodyHasBeginVcalendar,
      bodyHasBeginVevent,
      candidatePreviewFirst200: candidatePreview,
    });
    console.log("[inbound-email] no ics content found");
  }

  if (icsText) {
    console.log("[inbound-email] importing ics for user:", aliasRow.user_id);
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
