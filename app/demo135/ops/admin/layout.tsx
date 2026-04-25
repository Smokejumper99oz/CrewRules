import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminAllowlistedEmail } from "@/lib/super-admin/allowlist";
import { DemoOpsSignOutButton } from "./demo-ops-sign-out-button";

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

  return (
    <div className="min-h-screen bg-[#F4F7F9] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Demo · Part 91 / 135</p>
            <p className="text-sm font-semibold text-slate-800">CrewRules™ Ops</p>
          </div>
          <DemoOpsSignOutButton />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
