"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { PortalMobileNav } from "@/components/portal-mobile-nav";
import { PortalUserMenu } from "@/components/portal-user-menu";
import { PortalSidebarContent } from "@/components/portal-sidebar-content";
import { PageTitle } from "@/components/page-title";
import { DesktopIdleLogout } from "@/components/desktop-idle-logout";
import { PortalDebugLine } from "@/components/portal-debug-line";
import { PortalFadeIn } from "@/components/portal-fade-in";

const NAV_GROUPS = [
  {
    title: "Core",
    items: [
      { label: "Dashboard", href: "" },
      { label: "Weather Brief", href: "weather-brief" },
      { label: "My Schedule", href: "schedule" },
      { label: "Family View", href: "family-view" },
      { label: "Ask", href: "ask" },
      { label: "Library", href: "library" },
    ],
  },
  {
    title: "Community",
    items: [
      { label: "Forum", href: "forum" },
      { label: "Notes", href: "notes" },
      { label: "Mentoring", href: "mentoring" },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Updates", href: "updates" },
      { label: "Archive", href: "archive" },
      { label: "Profile", href: "profile" },
      { label: "About", href: "profile/about" },
    ],
  },
] as const;

type Props = {
  children: ReactNode;
  base: string;
  cfg: { tenant: { displayName: string }; portal: { displayName: string } };
  user: { email?: string };
  profile: { role: string; tenant: string; portal: string; email: string | null };
  admin: boolean;
  displayName: string;
  roleLabel: string;
  signOut: () => Promise<void>;
};

export function PortalLayoutShell({
  children,
  base,
  cfg,
  user,
  profile,
  admin,
  displayName,
  roleLabel,
  signOut,
}: Props) {
  const [tabletNavOpen, setTabletNavOpen] = useState(false);

  return (
    <PortalFadeIn>
      <DesktopIdleLogout />
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="flex h-screen overflow-hidden">
          <aside className="sidebar-scrollbar-hide hidden shrink-0 flex-col gap-4 overflow-y-auto border-r border-white/5 bg-slate-950/70 backdrop-blur transition-[width] duration-300 xl:flex xl:h-screen xl:w-72">
            <div className="px-6 pt-6">
              <div className="text-lg font-semibold">
                Crew<span className="text-[#75C043]">Rules</span>
                <span className="align-super text-xs">™</span>
              </div>
              <div className="mt-1 space-y-1 text-xs text-slate-400">
                <div>{cfg.tenant.displayName}</div>
                <div>{cfg.portal.displayName}</div>
              </div>
            </div>

            <nav className="px-4 pb-6 pt-2">
              <PortalSidebarContent
                base={base}
                navGroups={NAV_GROUPS}
                admin={admin}
                displayName={displayName}
                roleLabel={roleLabel}
                signOut={signOut}
                variant="desktop"
              />
            </nav>
          </aside>

          {tabletNavOpen && (
            <aside className="hidden shrink-0 flex-col gap-4 overflow-hidden border-r border-white/5 bg-slate-950/88 backdrop-blur-xl md:flex md:h-screen md:w-56 xl:hidden">
              <div className="px-5 pt-6">
                <div className="text-lg font-semibold">
                  Crew<span className="text-[#75C043]">Rules</span>
                  <span className="align-super text-xs">™</span>
                </div>
                <div className="mt-1 space-y-1 text-xs text-slate-400">
                  <div>{cfg.tenant.displayName}</div>
                  <div>{cfg.portal.displayName}</div>
                </div>
              </div>

              <nav className="sidebar-scrollbar-hide flex-1 overflow-y-auto px-3 pb-6 pt-2">
                <PortalSidebarContent
                  base={base}
                  navGroups={NAV_GROUPS}
                  admin={admin}
                  displayName={displayName}
                  roleLabel={roleLabel}
                  signOut={signOut}
                  variant="tablet"
                />
              </nav>
            </aside>
          )}

          <section
            className={[
              "flex min-w-0 flex-1 flex-col overflow-hidden transition-[transform,margin] duration-200 ease-out",
              tabletNavOpen ? "md:ml-0" : "md:ml-0",
            ].join(" ")}
          >
            <header className="shrink-0 border-b border-white/5 bg-slate-950/70 backdrop-blur">
              <PortalDebugLine
                email={user.email}
                role={profile.role}
                tenant={profile.tenant}
                portal={profile.portal}
              />
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3 sm:px-6">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <PortalMobileNav
                    base={base}
                    navGroups={NAV_GROUPS}
                    admin={admin ?? false}
                    signOut={signOut}
                    portalName={cfg.portal.displayName}
                    displayName={displayName}
                    roleLabel={roleLabel}
                    tabletNavOpen={tabletNavOpen}
                    setTabletNavOpen={setTabletNavOpen}
                  />
                  <PageTitle portalDisplayName={cfg.portal.displayName} isAdmin={false} />
                </div>

                <div className="flex shrink-0 items-center">
                  <PortalUserMenu
                    email={profile.email ?? user.email ?? null}
                    role={profile.role}
                    signOut={signOut}
                  />
                </div>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 pb-[env(safe-area-inset-bottom)]">
                {children}
              </div>
            </div>
          </section>
        </div>
      </main>
    </PortalFadeIn>
  );
}
