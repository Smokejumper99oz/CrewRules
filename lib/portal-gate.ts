import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CREWRULES_PATHNAME_HEADER } from "@/lib/crewrules-pathname-header";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/profile";

/** Belt-and-suspenders: these emails can bypass domain/tenant/portal checks if profile is messed up. */
const SUPER_ADMIN_EMAIL_ALLOWLIST = ["svenfolmer92@gmail.com"];

/**
 * Required email domain per tenant. Non-company emails get company_email_required.
 * Optional: In Supabase Auth settings, restrict signups to @flyfrontier.com
 * (or disable public signups and use invite-only) for defense in depth.
 */
const TENANT_EMAIL_DOMAIN: Record<string, string> = {
  frontier: "@flyfrontier.com",
};

/** Allowed roles per portal. Pilots portal: pilot only; FA portal: flight_attendant only. */
const PORTAL_ALLOWED_ROLES: Record<string, string[]> = {
  pilots: ["super_admin", "tenant_admin", "pilot"],
  fa: ["super_admin", "tenant_admin", "flight_attendant"],
  "flight-attendants": ["super_admin", "tenant_admin", "flight_attendant"],
};

function normalizeRequestPathname(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const pathOnly = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? new URL(trimmed).pathname
      : trimmed.split("?")[0]?.split("#")[0] ?? trimmed;
    const collapsed = pathOnly.replace(/\/+$/, "") || "/";
    return collapsed;
  } catch {
    return null;
  }
}

/**
 * Pathname for the active request: middleware sets {@link CREWRULES_PATHNAME_HEADER}
 * from `request.nextUrl.pathname` (no Referer / client-header guessing).
 */
async function getRequestPathnameForPortalGate(): Promise<string | null> {
  const h = await headers();
  return normalizeRequestPathname(h.get(CREWRULES_PATHNAME_HEADER));
}

/**
 * Fail-closed portal gate. Redirects to login with error param if:
 * - No auth session
 * - Missing/invalid email (not company domain)
 * - No profile row for this tenant+portal (redirect: complete-profile)
 * - profile.role not in allowed roles for portal
 * Do NOT render portal if any of these fail.
 */
export async function gateUserForPortal(
  tenant: string,
  portal: string
): Promise<{ user: { id: string; email?: string }; profile: Profile }> {
  const loginPath = `/${tenant}/${portal}/login`;
  const completeProfilePath = `/${tenant}/${portal}/complete-profile`;
  /** Only path where pending-deletion users may use the portal (restore / Danger Zone). */
  const accountSettingsPath = `/${tenant}/${portal}/portal/settings/account`;
  const accountSettingsPathNormalized = normalizeRequestPathname(accountSettingsPath)!;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`${loginPath}?error=not_signed_in`);
  }

  const email = (user.email ?? "").toLowerCase().trim();
  const isAllowlisted = SUPER_ADMIN_EMAIL_ALLOWLIST.some((e) => e.toLowerCase() === email);

  const { data: minimalProfile } = await supabase
    .from("profiles")
    .select(
      "id, role, tenant, portal, email, subscription_tier, pro_trial_started_at, pro_trial_expires_at, is_founding_pilot, founding_pilot_number, welcome_modal_version_seen, color_mode, is_admin, is_mentor, deleted_at, deletion_scheduled_for"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (minimalProfile && (minimalProfile.role === "super_admin" || isAllowlisted)) {
    return {
      user: { id: user.id, email: user.email ?? undefined },
      profile: minimalProfile as Profile,
    };
  }

  // tenant_admin and is_admin users may use any email (e.g. ALPA or personal).
  // They are invited manually via Super Admin and must not be gated by airline domain.
  const isTenantAdmin =
    minimalProfile?.role === "tenant_admin" ||
    minimalProfile?.is_admin === true;

  const requiredDomain = TENANT_EMAIL_DOMAIN[tenant];
  if (requiredDomain && !isTenantAdmin) {
    if (!email || !email.endsWith(requiredDomain.toLowerCase())) {
      redirect(`${loginPath}?error=company_email_required`);
    }
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, role, tenant, portal, email, subscription_tier, pro_trial_started_at, pro_trial_expires_at, is_founding_pilot, founding_pilot_number, welcome_modal_version_seen, base_airport, position, date_of_hire, home_airport, color_mode, is_admin, is_mentor, deleted_at, deletion_scheduled_for"
    )
    .eq("id", user.id)
    .eq("tenant", tenant)
    .eq("portal", portal)
    .single();

  if (error || !profile) {
    redirect(completeProfilePath);
  }

  const p = profile as Profile;

  const allowed = PORTAL_ALLOWED_ROLES[portal] ?? PORTAL_ALLOWED_ROLES.pilots;
  if (!allowed.includes(p.role)) {
    redirect(`${loginPath}?error=role_not_allowed`);
  }

  // tenant_admin and is_admin users are invited externally; they skip pilot onboarding.
  const isAdminUser = p.role === "tenant_admin" || p.is_admin === true;

  const hasRequiredOnboarding =
    !!String(p.base_airport ?? "").trim() &&
    !!String(p.position ?? "").trim() &&
    (p.date_of_hire != null && p.date_of_hire !== "") &&
    !!String(p.home_airport ?? "").trim();

  if (!hasRequiredOnboarding && !isAdminUser) {
    redirect(completeProfilePath);
  }

  const pendingDeletion = p.deleted_at != null || p.deletion_scheduled_for != null;
  if (pendingDeletion) {
    const path = await getRequestPathnameForPortalGate();
    const onAccountSettings = path != null && path === accountSettingsPathNormalized;
    if (!onAccountSettings) {
      redirect(accountSettingsPath);
    }
  }

  return {
    user: { id: user.id, email: user.email ?? undefined },
    profile: p,
  };
}
