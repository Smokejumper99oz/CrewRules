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
 * Server-only. Branded Tenant Admin invite via Resend (not wired to the invite flow yet).
 * Does not throw; returns { ok: false, error } on missing config or Resend failure.
 */
export async function sendTenantAdminInviteEmail(params: {
  to: string;
  fullName?: string | null;
  airlineName: string;
  inviteUrl: string;
  supportEmail?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.error("[tenant-admin-invite] RESEND_API_KEY not configured");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const { to, fullName, airlineName, inviteUrl, supportEmail } = params;
  const trimmedTo = to.trim();
  if (!trimmedTo) {
    return { ok: false, error: "Recipient email is required" };
  }

  const trimmedAirline = airlineName.trim();
  if (!trimmedAirline) {
    return { ok: false, error: "Airline name is required" };
  }

  const greetingName = fullName?.trim() ? fullName.trim() : "there";
  const safeGreeting = escapeHtml(greetingName);
  const safeAirline = escapeHtml(trimmedAirline);
  const safeUrl = escapeHtml(inviteUrl);
  const trimmedSupport = supportEmail?.trim() ?? "";

  const subject = `You're invited to join CrewRules™ as a ${trimmedAirline} Admin`;

  const supportLineText = trimmedSupport
    ? `If you have any questions, please contact ${trimmedSupport}.`
    : "If you have any questions, please contact the person who invited you or your organization's CrewRules administrator.";

  const text = [
    `Hello ${greetingName},`,
    "",
    `You have been invited to join CrewRules™ as a ${trimmedAirline} Admin.`,
    "",
    "Please use the link below to complete your sign up and access the platform.",
    "",
    inviteUrl,
    "",
    supportLineText,
    "",
    "— CrewRules™",
  ].join("\n");

  const supportLineHtml = trimmedSupport
    ? `If you have any questions, please contact <a href="mailto:${escapeHtml(trimmedSupport)}" style="color:#75C043;text-decoration:underline;">${escapeHtml(trimmedSupport)}</a>.`
    : "If you have any questions, please contact the person who invited you or your organization&apos;s CrewRules administrator.";

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
                  <span style="font-weight:400;color:#94a3b8;"> · ${safeAirline} Admin</span>
                </div>
                <div style="height:3px;background:#75C043;border-radius:999px;margin:14px 0 0 0;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 24px 28px;background:#ffffff;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#111827;line-height:1.65;">
                  <p style="margin:0 0 18px 0;">Hello ${safeGreeting},</p>
                  <p style="margin:0 0 24px 0;color:#374151;">
                    You have been invited to join CrewRules™ as a <strong>${safeAirline}</strong> Admin.
                  </p>
                  <p style="margin:0 0 10px 0;color:#374151;">
                    Please click the button below to complete your sign up and access the platform.
                  </p>
                  <p style="margin:0 0 28px 0;">
                    <a href="${safeUrl}" style="display:inline-block;background:#75C043;color:#0f172a;text-decoration:none;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-weight:700;font-size:14px;padding:12px 20px;border-radius:12px;">
                      Complete Sign Up
                    </a>
                  </p>
                  <p style="margin:0;font-size:13px;color:#6b7280;">
                    ${supportLineHtml}
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 20px;background:#0c111e;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#cbd5e1;">
                  <span style="font-weight:400;color:#ffffff;">Crew</span><span style="font-weight:400;color:#75C043;">Rules</span><span style="font-size:10px;vertical-align:super;font-weight:400;color:#ffffff;">™</span>
                  <span style="color:#64748b;"> · ${safeAirline} · Admin invitation</span>
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
    from: "CrewRules Admin Invites <admin-invites@notification.crewrules.com>",
    to: trimmedTo,
    subject,
    text,
    html,
  });

  if (error) {
    console.error("[tenant-admin-invite] Resend error:", error.message ?? error);
    return { ok: false, error: error.message ?? "Could not send invite email" };
  }

  return { ok: true };
}
