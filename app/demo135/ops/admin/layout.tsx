import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminAllowlistedEmail } from "@/lib/super-admin/allowlist";
import { DemoOpsSidebar } from "./demo-ops-sidebar";

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
    <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-[#f8f2ea] text-[#333333]">
      <DemoOpsSidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-white/10 bg-gradient-to-r from-[#102b46] to-[#173c5f] px-6 py-5 shadow-lg shadow-slate-900/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                <span className="text-white">Crew</span>
                <span className="text-amber-300">Rules</span>
                <span className="align-super text-sm font-bold text-white">™</span>{" "}
                <span className="text-white">Ops Dashboard</span>
              </h1>
              <p className="mt-1 max-w-xl text-sm text-white/80">
                Real-time overview of your operations, pilots, fleet, and compliance.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <button
                type="button"
                className="relative rounded-sm p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
                aria-label="Notifications, 3 unread (demo)"
              >
                <Bell className="h-5 w-5" aria-hidden />
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  3
                </span>
              </button>
              <div className="flex items-center gap-3 rounded-sm border border-white/20 bg-white/10 py-1.5 pl-1.5 pr-3 backdrop-blur-sm">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-sm bg-gradient-to-b from-amber-300 to-amber-500 text-xs font-bold text-slate-950"
                  aria-hidden
                >
                  SF
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">Sven Folmer</p>
                  <p className="truncate text-xs text-white/65">Ops Administrator</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-[#f8f2ea]">
          <div className="px-6 py-6">{children}</div>
          <footer className="border-t border-[#102b46]/10 bg-white px-6 py-3">
            <div className="flex flex-col gap-2 text-xs text-[#666666] sm:flex-row sm:items-center sm:justify-between">
              <p>
                <span className="font-semibold text-[#17324d]">CrewRules™</span> Ops Demo · Part 91 / 135 management
                portal preview
              </p>
              <p className="flex items-center gap-1.5 sm:justify-end">
                <ClockIcon />
                All times shown in local time
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-[#17324d]" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" className="stroke-current" strokeWidth="2" />
      <path className="stroke-current" strokeWidth="2" strokeLinecap="round" d="M12 7v5l3 2" />
    </svg>
  );
}
