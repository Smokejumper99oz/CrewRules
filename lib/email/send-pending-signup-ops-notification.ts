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

function formatSignupTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return escapeHtml(iso);
  }
  return escapeHtml(
    d.toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    })
  );
}

/**
 * Server-only. Notify ops when a Frontier pilot signup is pending email confirmation.
 * Does not throw. Admin recipients only (not the user).
 */
export async function sendPendingSignupOpsNotificationEmail(params: {
  userId: string;
  email: string;
  fullName: string;
  employeeNumber: string | null;
  signupAt: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.error("[pending-signup-ops] RESEND_API_KEY not configured");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const safeEmail = escapeHtml(params.email.trim());
  const safeName = escapeHtml(params.fullName.trim());
  const safeEmp =
    params.employeeNumber?.trim() ? escapeHtml(params.employeeNumber.trim()) : "—";
  const safeUserId = escapeHtml(params.userId);
  const safeTime = formatSignupTime(params.signupAt);

  const subject = "CrewRules™ pending signup";

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#ffffff;padding:26px 0;">
      <tr>
        <td align="center" style="padding:0 14px;">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:18px 20px 14px 20px;background:#0c111e;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#e2e8f0;font-weight:700;">
                  Pending signup (not yet confirmed)
                </div>
                <div style="height:3px;background:#75C043;border-radius:999px;margin:14px 0 0 0;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px;background:#ffffff;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#111827;">
                  <tr>
                    <td style="padding:8px 0;color:#6b7280;width:140px;vertical-align:top;">Email</td>
                    <td style="padding:8px 0;vertical-align:top;">${safeEmail}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#6b7280;border-top:1px solid #f3f4f6;vertical-align:top;">Name</td>
                    <td style="padding:8px 0;border-top:1px solid #f3f4f6;vertical-align:top;">${safeName}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#6b7280;border-top:1px solid #f3f4f6;vertical-align:top;">Employee #</td>
                    <td style="padding:8px 0;border-top:1px solid #f3f4f6;vertical-align:top;">${safeEmp}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#6b7280;border-top:1px solid #f3f4f6;vertical-align:top;">Signup time</td>
                    <td style="padding:8px 0;border-top:1px solid #f3f4f6;vertical-align:top;">${safeTime}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#6b7280;border-top:1px solid #f3f4f6;vertical-align:top;">User ID</td>
                    <td style="padding:8px 0;border-top:1px solid #f3f4f6;vertical-align:top;font-size:12px;word-break:break-all;">${safeUserId}</td>
                  </tr>
                </table>
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
    to: "contact@crewrules.com",
    cc: "svenfolmer92@gmail.com",
    subject,
    html,
  });

  if (error) {
    console.error("[pending-signup-ops] Resend error:", error.message ?? error);
    return { ok: false, error: error.message ?? "Resend error" };
  }

  return { ok: true };
}
