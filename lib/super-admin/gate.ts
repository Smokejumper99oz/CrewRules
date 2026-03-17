import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/profile";

/** Super admin access: role or email allowlist. Used for /super-admin route only. */
const SUPER_ADMIN_EMAIL_ALLOWLIST = ["svenfolmer92@gmail.com"];

/**
 * Gate for Super Admin Dashboard. Redirects if:
 * - Not signed in -> /frontier/pilots/login
 * - Signed in but not super_admin (role or allowlist) -> /frontier/pilots/portal
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
  const isAllowlisted = SUPER_ADMIN_EMAIL_ALLOWLIST.some((e) => e.toLowerCase() === email);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, tenant, portal, email, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    redirect("/frontier/pilots/login?error=profile_missing");
  }

  const isSuperAdmin = profile.role === "super_admin" || isAllowlisted;
  if (!isSuperAdmin) {
    redirect("/frontier/pilots/portal");
  }

  return {
    user: { id: user.id, email: user.email ?? undefined },
    profile: profile as Profile,
  };
}
