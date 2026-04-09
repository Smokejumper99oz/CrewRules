import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Server-only. Send a Family View invite email via Resend. Does not throw.
 * On Resend failure: returns { ok: false } so the caller can surface a warning
 * without blocking invite creation.
 */
export async function sendFamilyViewInviteEmail(params: {
  /** Invitee email address. */
  to: string;
  /** Pilot's first name, shown in the body. */
  pilotFirstName: string;
  /** Full magic-link share URL (https://www.crewrules.com/family-view/v/{rawToken}). */
  shareUrl: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.error("[family-view-invite] RESEND_API_KEY not configured");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const { to, pilotFirstName, shareUrl } = params;
  const safeName = escapeHtml(pilotFirstName);
  const safeUrl = escapeHtml(shareUrl);

  const subject = "You're invited to view a CrewRules™ Family View ✈️";

  const text = [
    `${pilotFirstName} has shared their flight schedule with you using CrewRules™.`,
    "",
    "You can view when they are working, traveling, and home — in a simple format designed for family.",
    "",
    "Open Family View:",
    shareUrl,
    "",
    "This link is private and meant only for you.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#ffffff;padding:26px 0;">
      <tr>
        <td align="center" style="padding:0 14px;">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;box-shadow:0 10px 24px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:18px 20px 14px 20px;background:#0c111e;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;">
                  <span style="color:#ffffff;">Crew</span><span style="color:#75C043;">Rules</span><span style="font-size:11px;vertical-align:super;color:#ffffff;">™</span>
                  <span style="font-weight:400;color:#94a3b8;"> · Family View</span>
                </div>
                <div style="height:3px;background:#75C043;border-radius:999px;margin:14px 0 0 0;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 24px 28px;background:#ffffff;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#111827;line-height:1.65;">
                  <p style="margin:0 0 18px 0;">
                    <strong>${safeName}</strong> has shared their flight schedule with you using CrewRules™.
                  </p>
                  <p style="margin:0 0 24px 0;color:#374151;">
                    You can view when they are working, traveling, and home — in a simple format designed for family.
                  </p>
                  <p style="margin:0 0 28px 0;">
                    <a href="${safeUrl}" style="display:inline-block;background:#75C043;color:#0f172a;text-decoration:none;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-weight:700;font-size:14px;padding:12px 20px;border-radius:12px;">
                      Open Family View ✈️
                    </a>
                  </p>
                  <p style="margin:0;font-size:12px;color:#9ca3af;">
                    This link is private and meant only for you. Do not share it with others.
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 20px;background:#0c111e;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#cbd5e1;">
                  <span style="font-weight:400;color:#ffffff;">Crew</span><span style="font-weight:400;color:#75C043;">Rules</span><span style="font-size:10px;vertical-align:super;font-weight:400;color:#ffffff;">™</span>
                  <span style="color:#64748b;"> · Family View sharing</span>
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
    from: "CrewRules Family View <familyview@notification.crewrules.com>",
    to,
    subject,
    text,
    html,
  });

  if (error) {
    console.error("[family-view-invite] Resend error:", error.message ?? error);
    return { ok: false, error: error.message ?? "Could not send invite email" };
  }

  return { ok: true };
}
