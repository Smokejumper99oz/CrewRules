import { Resend } from "resend";
import { buildCrewrulesTransactionalEmailHtml } from "@/lib/email/crewrules-transactional-email-html";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getInviteContext(portal: string, role: string) {
  if (portal === "ops" && role === "tenant_admin") {
    return {
      title: "Operations Portal",
      roleLabel: "Operations Admin",
      description: "management-level access to CrewRules operations tools",
    };
  }

  if (portal === "pilots") {
    return {
      title: "Pilot Portal",
      roleLabel: "Pilot",
      description: "your schedule, mentoring, and flight tools",
    };
  }

  if (portal === "flight-attendants") {
    return {
      title: "Cabin Crew Portal",
      roleLabel: "Flight Attendant",
      description: "your schedule and crew tools",
    };
  }

  return {
    title: "CrewRules",
    roleLabel: "User",
    description: "CrewRules platform access",
  };
}

const SUBJECT = "You've been invited to CrewRules";

/**
 * Super Admin (and any flow that should not name a tenant in email).
 * Server-only. Does not throw; returns { ok: false, error } on missing config or Resend failure.
 */
export async function sendCrewRulesUniversalInviteEmail(params: {
  to: string;
  fullName?: string | null;
  inviteUrl: string;
  /** Super Admin form values — drives human-friendly copy; never output raw. */
  portal: string;
  role: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.error("[crewrules-universal-invite] RESEND_API_KEY not configured");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const { to, fullName, inviteUrl, portal, role } = params;
  const trimmedTo = to.trim();
  if (!trimmedTo) {
    return { ok: false, error: "Recipient email is required" };
  }

  const { title, roleLabel, description } = getInviteContext(
    (portal ?? "").trim(),
    (role ?? "").trim()
  );

  const safeUrl = escapeHtml(inviteUrl);
  const greetingName = fullName?.trim() ? fullName.trim() : "there";
  const safeGreeting = escapeHtml(greetingName);
  const safeTitle = escapeHtml(title);
  const safeRoleLabel = escapeHtml(roleLabel);
  const safeDescription = escapeHtml(description);

  /** Avoid "CrewRules™ CrewRules" when the fallback mapping title is the product name. */
  const introLinePlain =
    title === "CrewRules"
      ? "You've been invited to access your CrewRules™ account."
      : `You've been invited to access the CrewRules™ ${title}.`;
  const introLineHtml =
    title === "CrewRules"
      ? `You&apos;ve been invited to access your CrewRules™ account.`
      : `You&apos;ve been invited to access the CrewRules™ ${safeTitle}.`;

  const text = [
    `Hello ${greetingName},`,
    "",
    introLinePlain,
    "",
    `Role: ${roleLabel}`,
    "",
    `This account provides ${description}.`,
    "",
    "Open the link below to accept your invite and finish signing up:",
    "",
    inviteUrl,
    "",
    "If you didn't expect this message, you can ignore it.",
    "",
    "— CrewRules",
  ].join("\n");

  const bodyInner = `
<p style="margin:0 0 16px 0;">Hello ${safeGreeting},</p>
<p style="margin:0 0 12px 0;">${introLineHtml}</p>
<p style="margin:0 0 8px 0;">Role: ${safeRoleLabel}</p>
<p style="margin:0 0 20px 0;">This account provides ${safeDescription}.</p>
<p style="margin:0 0 24px 0;">
  <a href="${safeUrl}" style="display:inline-block;background:#75C043;color:#0f172a;text-decoration:none;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-weight:700;font-size:14px;padding:12px 20px;border-radius:12px;">Accept Invite</a>
</p>
<p style="margin:0;font-size:14px;color:#6b7280;">If you didn&apos;t expect this message, you can ignore it.</p>`.trim();

  const html = buildCrewrulesTransactionalEmailHtml(bodyInner);

  const { error } = await resend.emails.send({
    from: "CrewRules <support@contact.crewrules.com>",
    to: trimmedTo,
    subject: SUBJECT,
    text,
    html,
  });

  if (error) {
    console.error("[crewrules-universal-invite] Resend error:", error.message ?? error);
    return { ok: false, error: error.message ?? "Could not send invite email" };
  }

  return { ok: true };
}
