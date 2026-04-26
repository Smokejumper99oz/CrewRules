import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminAllowlistedEmail } from "@/lib/super-admin/allowlist";
const LOGIN = "/demo135/ops/login";

function isDemo135OpsTenantAdmin(profile: {
  role: string | null;
  tenant: string | null;
  portal: string | null;
}): boolean {
  return (
    profile.role === "tenant_admin" &&
    profile.tenant === "demo135" &&
    profile.portal === "ops"
  );
}

export default async function Demo135OpsAdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`${LOGIN}?error=not_signed_in`);
  }

  const email = (user.email ?? "").toLowerCase().trim();
  const allowlisted = isSuperAdminAllowlistedEmail(email);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, tenant, portal")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    redirect(`${LOGIN}?error=profile_missing`);
  }

  const isSuperAdmin = profile.role === "super_admin" || allowlisted;
  if (!isSuperAdmin && !isDemo135OpsTenantAdmin(profile)) {
    redirect(`${LOGIN}?error=role_not_allowed`);
  }

  // Shell + DemoOpsViewProvider: see page.tsx so client content mounts inside the provider.
  return <>{children}</>;
}
