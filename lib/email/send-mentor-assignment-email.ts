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
 * Server-only. Notify a mentor of an assignment via CrewRules / Frontier Airlines mentoring.
 * Does not throw; returns { ok: false, error } on missing config or Resend failure.
 */
export async function sendMentorAssignmentEmail(params: {
  toEmail: string;
  mentorName: string;
  menteeName: string;
  menteeEmployeeNumber: string;
  /** Class / DOH for display (e.g. YYYY/MM/DD). */
  menteeDohDisplay: string;
  menteePrivateEmail: string;
  menteePrivatePhone: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const {
    toEmail,
    mentorName,
    menteeName,
    menteeEmployeeNumber,
    menteeDohDisplay,
    menteePrivateEmail,
    menteePrivatePhone,
  } = params;
  const to = toEmail.trim();
  if (!to) {
    return { ok: false, error: "Recipient email is required" };
  }

  const safeMentor = escapeHtml(mentorName);
  const safeMentee = escapeHtml(menteeName);
  const safeEmp = escapeHtml(menteeEmployeeNumber);
  const safeDoh = escapeHtml(menteeDohDisplay);
  const safeEmail = escapeHtml(menteePrivateEmail);
  const safePhone = escapeHtml(menteePrivatePhone);

  const subject = `Frontier Airlines New Mentee Assignment - ${menteeName}`;

  const text = [
    `Hello ${mentorName},`,
    "",
    "This message confirms your new mentee assignment in CrewRules™ for Frontier Airlines.",
    "",
    "Assigned mentee",
    "",
    menteeName,
    "",
    `DOH: ${menteeDohDisplay}`,
    "",
    `Employee #${menteeEmployeeNumber}`,
    `Email: ${menteePrivateEmail}`,
    `Phone: ${menteePrivatePhone}`,
    "",
    "If you have questions, please contact your NH Mentorship Program Manager.",
    "",
    "— CrewRules™ · Frontier Airlines Mentoring",
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
                  <span style="font-weight:400;color:#94a3b8;"> · Frontier Airlines Mentoring</span>
                </div>
                <div style="height:3px;background:#75C043;border-radius:999px;margin:14px 0 0 0;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 24px 28px;background:#ffffff;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#111827;line-height:1.65;">
                  <p style="margin:0 0 16px 0;">Hello ${safeMentor},</p>
                  <p style="margin:0 0 16px 0;color:#374151;">
                    This message confirms your <strong>new mentee assignment</strong> in CrewRules™ for Frontier Airlines.
                  </p>
                  <p style="margin:0 0 8px 0;color:#374151;"><strong>Assigned mentee</strong></p>
                  <p style="margin:0 0 12px 0;color:#111827;">${safeMentee}</p>
                  <p style="margin:0 0 4px 0;font-size:14px;color:#111827;"><strong style="color:#374151;">DOH:</strong> ${safeDoh}</p>
                  <p style="margin:12px 0 4px 0;font-size:14px;color:#111827;">Employee #${safeEmp}</p>
                  <p style="margin:0 0 4px 0;font-size:14px;color:#111827;">Email: ${safeEmail}</p>
                  <p style="margin:0 0 20px 0;font-size:14px;color:#111827;">Phone: ${safePhone}</p>
                  <p style="margin:0;font-size:13px;color:#6b7280;">
                    If you have questions, please contact your NH Mentorship Program Manager.
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 20px;background:#0c111e;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#cbd5e1;">
                  <span style="font-weight:400;color:#ffffff;">Crew</span><span style="font-weight:400;color:#75C043;">Rules</span><span style="font-size:10px;vertical-align:super;font-weight:400;color:#ffffff;">™</span>
                  <span style="color:#64748b;"> · Frontier Airlines Mentoring</span>
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
    from: "Frontier Airlines Mentoring via CrewRules™ <F9mentorship@notification.crewrules.com>",
    to,
    subject,
    text,
    html,
  });

  if (error) {
    console.error("[mentor-assignment-email] resend error", { to, error });
    return { ok: false, error: error.message ?? "Resend error" };
  }

  return { ok: true };
}
