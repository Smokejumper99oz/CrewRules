import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://www.crewrules.com";

function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const LOGIN_URL = `${APP_URL}/frontier/pilots/login`;

/**
 * Server-only. One-time nudge for unconfirmed signups (~2h). Returns { ok: true } or { ok: false, error }.
 */
export async function sendSignupFollowupEmail(params: {
  to: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { to } = params;

  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const subject = "Need help finishing your CrewRules signup?";

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#ffffff;padding:26px 0;">
      <tr>
        <td align="center" style="padding:0 14px;">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;box-shadow:0 10px 24px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:18px 20px 14px 20px;background:#0c111e;">
                <div style="height:3px;background:#75C043;border-radius:999px;margin:14px 0 0 0;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px;background:#ffffff;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;color:#111827;line-height:1.6;">
                  <p style="margin:0 0 16px 0;">Hi,</p>
                  <p style="margin:0 0 16px 0;">We noticed you started signing up for CrewRules but have not confirmed your email yet.</p>
                  <p style="margin:0 0 16px 0;">Check your inbox (and spam) for the confirmation message from CrewRules, or sign in to request a new code if you use email verification.</p>
                  <p style="margin:0 0 20px 0;">
                    <a href="${escapeHtml(LOGIN_URL)}" style="display:inline-block;background:#75C043;color:#0f172a;text-decoration:none;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-weight:700;font-size:14px;padding:10px 16px;border-radius:12px;">Go to login</a>
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 20px;background:#0c111e;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#cbd5e1;">
                  <span style="font-weight:400;color:#ffffff;">Crew</span><span style="font-weight:400;color:#75C043;">Rules</span><span style="font-size:10px;vertical-align:super;font-weight:400;color:#ffffff;">™</span>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const { error } = await resend.emails.send({
    from: "CrewRules <support@contact.crewrules.com>",
    to,
    subject,
    html,
  });

  if (error) {
    console.error("[signup-followup] resend error", { to, error });
    return { ok: false, error: error.message ?? "Resend error" };
  }

  return { ok: true };
}
