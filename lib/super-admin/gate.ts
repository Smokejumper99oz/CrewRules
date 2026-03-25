import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/profile";
import { isSuperAdminAllowlistedEmail } from "@/lib/super-admin/allowlist";

export { isSuperAdminAllowlistedEmail, SUPER_ADMIN_EMAIL_ALLOWLIST } from "@/lib/super-admin/allowlist";

function syntheticAllowlistProfile(user: User): Profile {
  const now = new Date().toISOString();
  return {
    id: user.id,
    email: user.email ?? null,
    tenant: "frontier",
    portal: "pilots",
    role: "super_admin",
    full_name: user.user_metadata?.full_name ?? null,
    created_at: now,
    updated_at: now,
  } as Profile;
}

/**
 * Gate for Super Admin Dashboard. Redirects if:
 * - Not signed in -> /frontier/pilots/login
 * - Signed in but not super_admin (role or allowlist) -> /frontier/pilots/portal
 * - No profile and not on allowlist -> login profile_missing
 */
export async function gateSuperAdmin(): Promise<{ user: { id: string; email?: string }; profile: Profile }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/frontier/pilots/login?error=not_signed_in");
  }

  const email = (user.email ?? "").toLowerCase().trim();
  const isAllowlisted = isSuperAdminAllowlistedEmail(email);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, tenant, portal, email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    const isSuperAdmin = profile.role === "super_admin" || isAllowlisted;
    if (!isSuperAdmin) {
      redirect("/frontier/pilots/portal");
    }
    return {
      user: { id: user.id, email: user.email ?? undefined },
      profile: profile as Profile,
    };
  }

  if (isAllowlisted) {
    return {
      user: { id: user.id, email: user.email ?? undefined },
      profile: syntheticAllowlistProfile(user),
    };
  }

  redirect("/frontier/pilots/login?error=profile_missing");
}
