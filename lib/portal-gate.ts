import { redirect } from "next/navigation";
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
    .select("id, role, tenant, portal, email, subscription_tier, pro_trial_started_at, pro_trial_expires_at, is_founding_pilot, founding_pilot_number, welcome_modal_version_seen, color_mode, is_admin, is_mentor")
    .eq("id", user.id)
    .maybeSingle();

  if (minimalProfile && (minimalProfile.role === "super_admin" || isAllowlisted)) {
    return {
      user: { id: user.id, email: user.email ?? undefined },
      profile: minimalProfile as Profile,
    };
  }

  const requiredDomain = TENANT_EMAIL_DOMAIN[tenant];
  if (requiredDomain) {
    if (!email || !email.endsWith(requiredDomain.toLowerCase())) {
      redirect(`${loginPath}?error=company_email_required`);
    }
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, tenant, portal, email, subscription_tier, pro_trial_started_at, pro_trial_expires_at, is_founding_pilot, founding_pilot_number, welcome_modal_version_seen, base_airport, position, date_of_hire, home_airport, color_mode, is_admin, is_mentor")
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

  const hasRequiredOnboarding =
    !!String(p.base_airport ?? "").trim() &&
    !!String(p.position ?? "").trim() &&
    (p.date_of_hire != null && p.date_of_hire !== "") &&
    !!String(p.home_airport ?? "").trim();

  if (!hasRequiredOnboarding) {
    redirect(completeProfilePath);
  }

  return {
    user: { id: user.id, email: user.email ?? undefined },
    profile: p,
  };
}
