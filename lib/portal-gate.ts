import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/profile";

/** Allowed roles per portal. Expand as needed. */
const PORTAL_ALLOWED_ROLES: Record<string, string[]> = {
  pilots: ["super_admin", "tenant_admin", "pilot", "flight_attendant"],
  fa: ["super_admin", "tenant_admin", "pilot", "flight_attendant"],
  "flight-attendants": ["super_admin", "tenant_admin", "pilot", "flight_attendant"],
};

/**
 * Fail-closed portal gate. Redirects to login with error param if:
 * - No auth session
 * - No profile row
 * - profile.tenant !== tenant
 * - profile.portal !== portal
 * - profile.role not in allowed roles
 * Do NOT render portal if any of these fail.
 */
export async function gateUserForPortal(
  tenant: string,
  portal: string
): Promise<{ user: { id: string; email?: string }; profile: Profile }> {
  const loginPath = `/${tenant}/${portal}/login`;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`${loginPath}?error=not_signed_in`);
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, tenant, portal, email")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirect(`${loginPath}?error=profile_missing`);
  }

  const p = profile as Profile;
  if (p.tenant !== tenant) {
    redirect(`${loginPath}?error=tenant_mismatch`);
  }
  if (p.portal !== portal) {
    redirect(`${loginPath}?error=portal_mismatch`);
  }

  const allowed = PORTAL_ALLOWED_ROLES[portal] ?? PORTAL_ALLOWED_ROLES.pilots;
  if (!allowed.includes(p.role)) {
    redirect(`${loginPath}?error=role_not_allowed`);
  }

  return {
    user: { id: user.id, email: user.email ?? undefined },
    profile: p,
  };
}
