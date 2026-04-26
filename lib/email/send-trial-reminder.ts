import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const CONTACT_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://www.crewrules.com";

function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type TrialReminderType = "7d" | "3d";

type SendParams = {
  to: string;
  fullName: string | null;
  daysRemaining: number;
  type: TrialReminderType;
};

function buildSubject(params: SendParams): string {
  const { daysRemaining, type } = params;
  if (daysRemaining === 1) {
    return "Your Pro trial ends tomorrow — CrewRules™";
  }
  return `Your Pro trial ends in ${daysRemaining} days — CrewRules™`;
}

function buildGreeting(fullName: string | null): string {
  if (fullName) {
    return `Hi ${escapeHtml(fullName)},`;
  }
  return "Hi,";
}

function buildDaysCopy(daysRemaining: number): string {
  if (daysRemaining === 1) {
    return "Your Pro trial ends tomorrow.";
  }
  return `Your Pro trial ends in ${daysRemaining} days.`;
}

function buildBodyCopy(type: TrialReminderType): string {
  if (type === "3d") {
    return "Upgrade now to keep your advanced tools — Ask, Commute Assist, Family View, and more.";
  }
  return "Upgrade to keep your advanced tools — Ask, Commute Assist, Family View, and more.";
}

/**
 * Server-only. Sends a Pro trial reminder email (7-day or 3-day).
 * Reuses Resend setup from contact route. Returns { ok: true } or { ok: false, error }.
 */
export async function sendProTrialReminder(params: SendParams): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  const { to, fullName, daysRemaining, type } = params;

  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const greeting = buildGreeting(fullName);
  const daysCopy = buildDaysCopy(daysRemaining);
  const bodyCopy = buildBodyCopy(type);
  const contactLink = `${CONTACT_URL}/contact`;

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#ffffff;padding:26px 0;">
      <tr>
        <td align="center" style="padding:0 14px;">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;box-shadow:0 10px 24px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:18px 20px 14px 20px;background:#0c111e;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td align="center" style="padding:0;">
                      <img src="https://crewrules.com/logo/crewrules-logo.png" alt="CrewRules™" width="300" style="max-width:300px;height:auto;display:block;border:0;outline:none;text-decoration:none;margin:0 auto;" />
                    </td>
                  </tr>
                </table>
                <div style="height:3px;background:#75C043;border-radius:999px;margin:14px 0 0 0;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px;background:#ffffff;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;color:#111827;line-height:1.6;">
                  <p style="margin:0 0 16px 0;">${greeting}</p>
                  <p style="margin:0 0 16px 0;">${daysCopy} ${bodyCopy}</p>
                  <p style="margin:0 0 20px 0;">
                    <a href="${escapeHtml(contactLink)}" style="display:inline-block;background:#75C043;color:#0f172a;text-decoration:none;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-weight:700;font-size:14px;padding:10px 16px;border-radius:12px;">Contact us to upgrade</a>
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 20px;background:#0c111e;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#cbd5e1;">
                  <span style="font-weight:400;color:#ffffff;">Crew</span><span style="font-weight:400;color:#75C043;">Rules</span><span style="font-size:10px;vertical-align:super;font-weight:400;color:#ffffff;">™</span> — The Smart Knowledge Platform for Airline Crew
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
    from: "CrewRules™ <support@contact.crewrules.com>",
    to,
    subject: buildSubject(params),
    html,
  });

  if (error) {
    console.error("[trial-reminder] resend error", { to, type, error });
    return { ok: false, error: error.message ?? "Resend error" };
  }

  return { ok: true };
}
