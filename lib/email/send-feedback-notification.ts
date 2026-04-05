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

function formatTimestamp(iso: string): string {
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

function feedbackTypeSubjectTag(feedbackType: string): string {
  switch (feedbackType) {
    case "bug":
      return "BUG";
    case "feature":
      return "FEATURE";
    case "feedback":
      return "FEEDBACK";
    default:
      return String(feedbackType).toUpperCase();
  }
}

function feedbackTypeBodyLabel(feedbackType: string): string {
  switch (feedbackType) {
    case "bug":
      return "[BUG]";
    case "feature":
      return "[FEATURE]";
    case "feedback":
      return "[FEEDBACK]";
    default:
      return `[${String(feedbackType).toUpperCase()}]`;
  }
}

function subjectDisplayName(fullName: string | null, email: string | null): string {
  const n = fullName?.trim();
  if (n) return n.length > 80 ? `${n.slice(0, 77)}…` : n;
  const e = email?.trim();
  if (e) {
    const local = e.split("@")[0] ?? e;
    return local.length > 80 ? `${local.slice(0, 77)}…` : local;
  }
  return "User";
}

function subjectRouteSnippet(routePath: string | null): string {
  if (!routePath?.trim()) return "—";
  const r = routePath.trim();
  return r.length > 120 ? `${r.slice(0, 117)}…` : r;
}

/**
 * Server-only. Notify ops when in-app feedback is submitted. Does not throw.
 * Matches Resend usage in `app/api/contact/route.ts` / `lib/email/send-signup-followup.ts`.
 */
export async function sendFeedbackNotificationEmail(params: {
  feedback_type: string;
  message: string;
  submitter_full_name: string | null;
  submitter_email: string | null;
  /** Optional address from public feedback modal; distinct from authenticated profile email. */
  contact_email?: string | null;
  tenant: string;
  portal: string;
  route_path: string | null;
  created_at: string;
  /** Screenshots successfully linked in DB for this submission (service-role uploads). */
  attachment_count?: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.error("[feedback-notification] RESEND_API_KEY not configured");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const typeTag = feedbackTypeSubjectTag(params.feedback_type);
  const nameForSubject = subjectDisplayName(params.submitter_full_name, params.submitter_email);
  const routeForSubject = subjectRouteSnippet(params.route_path);
  const subject = `[CrewRules ${typeTag}] ${nameForSubject} — ${routeForSubject}`;

  const typeLabel = feedbackTypeBodyLabel(params.feedback_type);
  const safeMessage = escapeHtml(params.message).replaceAll("\n", "<br />");
  const safeName = escapeHtml(params.submitter_full_name ?? "—");
  const safeEmail = escapeHtml(params.submitter_email ?? "—");
  const safeTenant = escapeHtml(params.tenant);
  const safePortal = escapeHtml(params.portal);
  const safeRoute = escapeHtml(params.route_path?.trim() ? params.route_path.trim() : "—");
  const safeCreated = formatTimestamp(params.created_at);
  const attachmentCount = Math.max(0, Math.floor(Number(params.attachment_count ?? 0)));
  const safeAttachmentCount = escapeHtml(String(attachmentCount));

  const contactTrim = params.contact_email?.trim() ?? "";
  const safeContactEmail = escapeHtml(contactTrim || "—");

  const replyTo = params.submitter_email?.trim() || (contactTrim ? contactTrim : undefined);

  const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#ffffff;padding:26px 0;">
      <tr>
        <td align="center" style="padding:0 14px;">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;box-shadow:0 10px 24px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:18px 20px 14px 20px;background:#0c111e;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#e2e8f0;font-weight:700;">
                  ${escapeHtml(typeLabel)} In-app feedback
                </div>
                <div style="height:3px;background:#75C043;border-radius:999px;margin:14px 0 0 0;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px;background:#ffffff;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#111827;">
                  <tr>
                    <td style="padding:8px 0;color:#6b7280;width:140px;vertical-align:top;">Type</td>
                    <td style="padding:8px 0;font-weight:700;vertical-align:top;">${escapeHtml(typeLabel)}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#6b7280;border-top:1px solid #f3f4f6;vertical-align:top;">Message</td>
                    <td style="padding:8px 0;border-top:1px solid #f3f4f6;vertical-align:top;line-height:1.6;">${safeMessage}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#6b7280;border-top:1px solid #f3f4f6;vertical-align:top;">Name</td>
                    <td style="padding:8px 0;border-top:1px solid #f3f4f6;vertical-align:top;">${safeName}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#6b7280;border-top:1px solid #f3f4f6;vertical-align:top;">Email</td>
                    <td style="padding:8px 0;border-top:1px solid #f3f4f6;vertical-align:top;">${safeEmail}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#6b7280;border-top:1px solid #f3f4f6;vertical-align:top;">Contact email</td>
                    <td style="padding:8px 0;border-top:1px solid #f3f4f6;vertical-align:top;">${safeContactEmail}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#6b7280;border-top:1px solid #f3f4f6;vertical-align:top;">Tenant</td>
                    <td style="padding:8px 0;border-top:1px solid #f3f4f6;vertical-align:top;">${safeTenant}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#6b7280;border-top:1px solid #f3f4f6;vertical-align:top;">Portal</td>
                    <td style="padding:8px 0;border-top:1px solid #f3f4f6;vertical-align:top;">${safePortal}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#6b7280;border-top:1px solid #f3f4f6;vertical-align:top;">Route</td>
                    <td style="padding:8px 0;border-top:1px solid #f3f4f6;vertical-align:top;">${safeRoute}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#6b7280;border-top:1px solid #f3f4f6;vertical-align:top;">Submitted</td>
                    <td style="padding:8px 0;border-top:1px solid #f3f4f6;vertical-align:top;">${safeCreated}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#6b7280;border-top:1px solid #f3f4f6;vertical-align:top;">Screenshots</td>
                    <td style="padding:8px 0;border-top:1px solid #f3f4f6;vertical-align:top;">${safeAttachmentCount} attached</td>
                  </tr>
                </table>
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
    to: "contact@crewrules.com",
    cc: "svenfolmer92@gmail.com",
    ...(replyTo ? { replyTo } : {}),
    subject,
    html,
  });

  if (error) {
    console.error("[feedback-notification] Resend error:", error.message ?? error);
    return { ok: false, error: error.message ?? "Resend error" };
  }

  return { ok: true };
}
