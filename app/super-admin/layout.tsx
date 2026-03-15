import type { ReactNode } from "react";
import { gateSuperAdmin } from "@/lib/super-admin/gate";
import { getDisplayName } from "@/lib/profile";
import { signOut } from "@/app/frontier/pilots/portal/actions";
import { SuperAdminUserMenu } from "@/components/super-admin/super-admin-user-menu";
import { SuperAdminNav } from "@/components/super-admin/super-admin-nav";

export default async function SuperAdminLayout({ children }: { children: ReactNode }) {
  const { profile } = await gateSuperAdmin();
  const displayName = getDisplayName(profile);

  return (
    <main className="min-h-screen bg-slate-900">
      <div className="flex">
        <aside className="hidden md:flex md:w-72 md:flex-col border-r border-slate-700/50 bg-slate-900/95">
          <div className="px-6 pt-6 pb-4">
            <div className="text-lg font-semibold text-slate-100">
              Crew<span className="text-[#75C043]">Rules</span>
              <span className="align-super text-xs">™</span>
            </div>
            <div className="mt-1.5 text-xs text-slate-400">
              Super Admin Dashboard
            </div>
          </div>

          <div className="px-4 pb-6 pt-2 flex-1 overflow-y-auto">
            <SuperAdminNav />
          </div>
        </aside>

        <section className="flex-1 min-w-0">
          <header className="sticky top-0 z-40 border-b border-slate-700/50 bg-slate-900/95">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-semibold tracking-tight truncate text-slate-100">
                  Super Admin Dashboard
                </h1>
                <div className="text-xs text-slate-400 mt-0.5">
                  Platform Owner Console
                </div>
              </div>

              <div className="flex shrink-0 items-center">
                <SuperAdminUserMenu displayName={displayName} signOut={signOut} />
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 pb-[env(safe-area-inset-bottom)]">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
