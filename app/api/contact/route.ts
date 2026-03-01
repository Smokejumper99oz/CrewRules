import { NextResponse } from "next/server";
import { Resend } from "resend";

function escapeHtml(input: unknown) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTimestamp(date = new Date()) {
  // readable, stable-ish format without pulling in libs
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { name, email, subject, message } = await req.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject || "—");
    const safeMessage = escapeHtml(message);
    const ts = escapeHtml(formatTimestamp());

    const mailtoReply = `mailto:${encodeURIComponent(String(email))}?subject=${encodeURIComponent(
      "Re: CrewRules Contact Message"
    )}`;

    const { error } = await resend.emails.send({
      from: "CrewRules <support@contact.crewrules.com>",
      to: "svenfolmer92@gmail.com",
      replyTo: String(email),
      subject: subject ? `CrewRules Contact: ${String(subject)}` : "CrewRules Contact Message",
      html: `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#0b1220;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background-color:#0b1220;padding:28px 0;">
      <tr>
        <td align="center" style="padding:0 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0;">

            <!-- Header with logo -->
            <tr>
              <td style="background:#0b1220;border-radius:16px 16px 0 0;padding:24px 18px;text-align:center;">

                <img
                  src="https://crewrules.com/logo/crewrules-logo.png"
                  alt="CrewRules"
                  width="260"
                  style="max-width:260px;height:auto;display:block;margin:0 auto 12px auto;border:0;"
                />

                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#9ca3af;">
                  ${ts}
                </div>

                <div style="height:1px;background:rgba(255,255,255,0.08);margin-top:18px;"></div>

              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background:#0f172a;border:1px solid rgba(148,163,184,0.18);border-radius:18px;padding:18px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="padding:0;">
                      <div style="height:4px;background:#75C043;border-radius:18px 18px 0 0;"></div>
                    </td>
                  </tr>
                  <!-- Rows -->
                  <tr>
                    <td style="padding:10px 0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                        <tr>
                          <td width="120" style="vertical-align:top;padding-right:12px;">
                            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#94a3b8;">
                              Name
                            </div>
                          </td>
                          <td style="vertical-align:top;">
                            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#e5e7eb;font-weight:700;">
                              ${safeName}
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:10px 0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                        <tr>
                          <td width="120" style="vertical-align:top;padding-right:12px;">
                            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#94a3b8;">
                              Email
                            </div>
                          </td>
                          <td style="vertical-align:top;">
                            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#e5e7eb;font-weight:700;">
                              <a href="mailto:${safeEmail}" style="color:#75C043;text-decoration:underline;font-weight:700;">${safeEmail}</a>
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:10px 0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                        <tr>
                          <td width="120" style="vertical-align:top;padding-right:12px;">
                            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#94a3b8;">
                              Subject
                            </div>
                          </td>
                          <td style="vertical-align:top;">
                            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#e5e7eb;font-weight:700;">
                              ${safeSubject}
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Message block -->
                  <tr>
                    <td style="padding:14px 0 8px 0;">
                      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#94a3b8;margin-bottom:8px;">
                        Message
                      </div>
                      <div style="background:#020617;border:1px solid rgba(148,163,184,0.16);border-radius:14px;padding:16px 18px;">
                        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.7;color:#e5e7eb;white-space:pre-wrap;">
                          ${safeMessage}
                        </div>
                      </div>
                    </td>
                  </tr>

                  <!-- CTA -->
                  <tr>
                    <td style="padding:14px 0 2px 0;">
                      <a href="${mailtoReply}"
                         style="display:inline-block;background:#75C043;color:#0b1220;text-decoration:none;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-weight:900;font-size:14px;padding:10px 14px;border-radius:10px;">
                        Reply to sender
                      </a>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:14px 4px 0 4px;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#94a3b8;line-height:1.6;">
                  Sent by <span style="color:#e5e7eb;font-weight:700;">CrewRules</span> via <span style="color:#e5e7eb;font-weight:700;">contact.crewrules.com</span>
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
      console.error(error);
      return NextResponse.json({ error: "Email failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
