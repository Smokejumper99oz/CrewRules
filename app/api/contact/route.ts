import { NextResponse } from "next/server";
import { Resend } from "resend";
import { logSystemEvent } from "@/lib/system-events";

function escapeHtml(input: unknown) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTimestamp(date = new Date()) {
  return date.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const resend = new Resend(process.env.RESEND_API_KEY);

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 3;
const rateLimitMap = new Map<string, number[]>();

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = rateLimitMap.get(ip) ?? [];
  const recent = timestamps.filter((t) => t > cutoff);
  return recent.length >= RATE_LIMIT_MAX;
}

function recordSubmission(ip: string): void {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (rateLimitMap.get(ip) ?? []).filter((t) => t > cutoff);
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const { name, email, subject, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    recordSubmission(ip);

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject || "—");
    const safeMessage = escapeHtml(message);
    const ts = escapeHtml(formatTimestamp());

    const mailtoReply = `mailto:${encodeURIComponent(String(email))}?subject=${encodeURIComponent(
      "Re: CrewRules™ Contact Message"
    )}`;

    const { error } = await resend.emails.send({
      from: "CrewRules™ <support@contact.crewrules.com>",
      to: "contact@crewrules.com",
      cc: "svenfolmer92@gmail.com",
      replyTo: String(email),
      subject: `CrewRules™ Contact — ${subject || "General"} — ${name}`,
      html: `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#ffffff;padding:26px 0;">
      <tr>
        <td align="center" style="padding:0 14px;">

          <!-- Outer card -->
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;box-shadow:0 10px 24px rgba(15,23,42,0.08);">

            <!-- Header -->
            <tr>
              <td style="padding:18px 20px 14px 20px;background:#0c111e;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td align="center" style="padding:0;">
                      <img
                        src="https://crewrules.com/logo/crewrules-logo.png"
                        alt="CrewRules™"
                        width="300"
                        style="max-width:300px;height:auto;display:block;border:0;outline:none;text-decoration:none;margin:0 auto;"
                      />
                    </td>
                  </tr>

                  <tr>
                    <td align="center" style="padding:12px 0 0 0;">
                      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#cbd5e1;">
                        ${ts}
                      </div>
                    </td>
                  </tr>
                </table>

                <!-- Keep ONLY this accent line -->
                <div style="height:3px;background:#75C043;border-radius:999px;margin:14px 0 0 0;"></div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:18px 20px 20px 20px;background:#0c111e;">

                <!-- Inner white content card -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                  style="border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
                  <tr>
                    <td style="padding:26px 28px;">

                      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#374151;line-height:1.6;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid #e5e7eb;">
                        From: ${safeName}<br />
                        Email: ${safeEmail}<br />
                        Subject: ${safeSubject}
                      </div>

                      <!-- Details -->
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">

                        <tr>
                          <td width="120" style="padding:10px 0;vertical-align:top;">
                            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#6b7280;">Name</div>
                          </td>
                          <td style="padding:10px 0;vertical-align:top;">
                            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#111827;font-weight:700;">
                              ${safeName}
                            </div>
                          </td>
                        </tr>

                        <tr>
                          <td width="120" style="padding:10px 0;vertical-align:top;border-top:1px solid #f3f4f6;">
                            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#6b7280;">Email</div>
                          </td>
                          <td style="padding:10px 0;vertical-align:top;border-top:1px solid #f3f4f6;">
                            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;">
                              <a href="mailto:${safeEmail}" style="color:#0f766e;text-decoration:underline;">${safeEmail}</a>
                            </div>
                          </td>
                        </tr>

                        <tr>
                          <td width="120" style="padding:10px 0;vertical-align:top;border-top:1px solid #f3f4f6;">
                            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#6b7280;">Subject</div>
                          </td>
                          <td style="padding:10px 0;vertical-align:top;border-top:1px solid #f3f4f6;">
                            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#111827;font-weight:700;">
                              ${safeSubject}
                            </div>
                          </td>
                        </tr>

                      </table>

                      <!-- Message -->
                      <div style="margin-top:14px;">
                        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#6b7280;margin-bottom:8px;">
                          Message
                        </div>
                        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:14px;padding:16px 18px;">
                          <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.7;color:#111827;white-space:pre-wrap;">
                            ${safeMessage}
                          </div>
                        </div>
                      </div>

                      <!-- Reply -->
                      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:16px;">
                        <tr>
                          <td>
                            <a href="${mailtoReply}"
                              style="display:inline-block;background:#75C043;color:#0f172a;text-decoration:none;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-weight:900;font-size:14px;padding:10px 16px;border-radius:12px;">
                              Reply to sender
                            </a>
                          </td>
                        </tr>
                      </table>

                    </td>
                  </tr>
                </table>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:14px 20px;background:#0c111e;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#cbd5e1;">
                  Sent by <span style="font-weight:400;color:#ffffff;">Crew</span><span style="font-weight:400;color:#75C043;">Rules</span><span style="font-size:10px;vertical-align:super;font-weight:400;color:#ffffff;">™</span> — The Smart Knowledge Platform for Airline Crew
                </div>
              </td>
            </tr>

          </table>

        </td>
      </tr>
    </table>
  </body>
</html>`,
    });

    if (error) {
      console.error("[contact] resend error", error);
      await logSystemEvent({
        type: "system",
        severity: "error",
        title: "Email send failed",
        message: String(error?.message ?? error ?? "Resend error"),
      });
      return NextResponse.json({ error: "Email failed" }, { status: 500 });
    }

    console.log("[contact] email sent", { to: "contact@crewrules.com" });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[contact] server error", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
