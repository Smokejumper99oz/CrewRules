"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AdminMobileNav } from "@/components/admin-mobile-nav";
import { AdminSidebarNav } from "@/components/admin-sidebar-nav";
import { PortalUserMenu } from "@/components/portal-user-menu";
import { PageTitle } from "@/components/page-title";
import { AdminFeedbackButton } from "@/components/admin-feedback-button";

type NavItem = { label: string; href: string };

type AdminLayoutShellProps = {
  children: ReactNode;
  tenantDisplayName: string;
  portalDisplayName: string;
  base: string;
  portalBase: string;
  adminNav: NavItem[];
  isSuperAdmin: boolean;
  hidePortalLink: boolean;
  userMenu: {
    email: string | null;
    roleLabel: string;
    signOut: () => Promise<void>;
    profileHref: string;
  };
};

export function AdminLayoutShell({
  children,
  tenantDisplayName,
  portalDisplayName,
  base,
  portalBase,
  adminNav,
  isSuperAdmin,
  hidePortalLink,
  userMenu,
}: AdminLayoutShellProps) {
  const [tabletNavOpen, setTabletNavOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const handle = () => {
      if (mq.matches) setTabletNavOpen(false);
    };
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);

  return (
    <main className="min-h-screen bg-[#F4F7F9] text-slate-900 md:h-dvh md:overflow-hidden">
      <div className="flex h-screen overflow-hidden">
        <aside className="hidden shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-[#F4F7F9] xl:flex xl:h-screen xl:w-72">
          <div className="shrink-0 px-6 pt-6">
            <div className="text-lg font-semibold text-slate-900">
              Crew<span className="text-[#75C043]">Rules</span>
              <span className="align-super text-xs">™</span>
            </div>
            <div className="mt-1 space-y-1 text-xs text-slate-600">
              <div>{tenantDisplayName}</div>
              <div>Admin Portal</div>
            </div>
          </div>
          <div className="sidebar-scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-[env(safe-area-inset-bottom)]">
            <AdminSidebarNav
              base={base}
              nav={adminNav}
              portalBase={portalBase}
              isSuperAdmin={isSuperAdmin}
              hidePortalLink={hidePortalLink}
            />
          </div>
        </aside>

        {tabletNavOpen && (
          <aside className="hidden shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-[#F4F7F9] md:flex md:h-screen md:w-56 xl:hidden">
            <div className="shrink-0 px-5 pt-6">
              <div className="text-lg font-semibold text-slate-900">
                Crew<span className="text-[#75C043]">Rules</span>
                <span className="align-super text-xs">™</span>
              </div>
              <div className="mt-1 space-y-1 text-xs text-slate-600">
                <div>{tenantDisplayName}</div>
                <div>Admin Portal</div>
              </div>
            </div>
            <div className="sidebar-scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-[env(safe-area-inset-bottom)]">
              <AdminSidebarNav
                base={base}
                nav={adminNav}
                portalBase={portalBase}
                isSuperAdmin={isSuperAdmin}
                hidePortalLink={hidePortalLink}
              />
            </div>
          </aside>
        )}

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-slate-200 bg-[#F4F7F9] pt-[env(safe-area-inset-top,0px)]">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <AdminMobileNav
                  base={base}
                  nav={adminNav}
                  portalBase={portalBase}
                  hidePortalLink={hidePortalLink}
                  isSuperAdmin={isSuperAdmin}
                  tabletNavOpen={tabletNavOpen}
                  setTabletNavOpen={setTabletNavOpen}
                />
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <PageTitle portalDisplayName={portalDisplayName} isAdmin={true} adminSurface />
                    {isSuperAdmin && (
                      <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                        Platform Owner
                      </span>
                    )}
                  </div>
                  <div className="hidden text-xs text-emerald-800 sm:block">
                    <span className="font-bold">Frontier Airlines</span> • ALPA Mentorship Program
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <AdminFeedbackButton />
                <PortalUserMenu
                  email={userMenu.email}
                  roleLabel={userMenu.roleLabel}
                  signOut={userMenu.signOut}
                  profileHref={userMenu.profileHref}
                  adminChrome
                />
              </div>
            </div>
          </header>

          <div className="sidebar-scrollbar-hide mx-auto w-full max-w-6xl flex-1 overflow-y-auto overscroll-y-contain px-4 py-8 sm:px-6 sm:py-10 pb-[env(safe-area-inset-bottom)]">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
