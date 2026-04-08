"use client";

import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { MessageSquare } from "lucide-react";
import { PortalMobileNav } from "@/components/portal-mobile-nav";
import { PortalUserMenu } from "@/components/portal-user-menu";
import { PortalSidebarContent } from "@/components/portal-sidebar-content";
import { PageTitle } from "@/components/page-title";
import { DesktopIdleLogout } from "@/components/desktop-idle-logout";
import { PortalDebugLine } from "@/components/portal-debug-line";
import { PortalFadeIn } from "@/components/portal-fade-in";
import { PortalTrialUpgradeBanner } from "@/components/portal-trial-upgrade-banner";
import { PortalWelcomeModal } from "@/components/portal-welcome-modal";
import { PortalFeedbackModal, type FeedbackType } from "@/components/portal-feedback-modal";

function portalFeedbackSuccessMessage(kind: FeedbackType): string {
  switch (kind) {
    case "bug":
      return "Thank you! — We really appreciate the report. We're on it and will follow up if needed.";
    case "feature":
      return "Thank you! — We really appreciate the idea. We're on it.";
    case "feedback":
      return "Thank you! — We really appreciate the feedback. We're on it and will follow up if needed.";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
import { CURRENT_WELCOME_MODAL_VERSION } from "@/lib/welcome-modal";

const NAV_GROUPS = [
  {
    title: "Core",
    items: [
      { label: "Dashboard", href: "" },
      { label: "Weather Brief", href: "weather-brief", badge: "BETA" },
      { label: "My Schedule", href: "schedule" },
      { label: "Family View", href: "family-view", badge: "BETA" },
      { label: "Ask", href: "ask" },
      { label: "Library", href: "library" },
    ],
  },
  {
    title: "Community",
    items: [
      { label: "Forum", href: "forum", badge: "IN DEVELOPMENT" },
      { label: "Notes", href: "notes" },
      { label: "Mentoring", href: "mentoring", badge: "BETA" },
    ],
  },
  {
    title: "System",
    items: [
      { label: "System updates", href: "updates" },
      { label: "Archive", href: "archive" },
      { label: "Settings", href: "settings/pilot" },
      { label: "About", href: "profile/about" },
    ],
  },
] as const;

type TrialBannerStatus =
  | { status: "expiring_soon"; daysRemaining: number }
  | { status: "expiring_urgent"; daysRemaining: number };

type Props = {
  children: ReactNode;
  base: string;
  cfg: { tenant: { displayName: string }; portal: { displayName: string } };
  user: { email?: string };
  profile: { role: string; tenant: string; portal: string; email: string | null; welcome_modal_version_seen?: number | null };
  admin: boolean;
  displayName: string;
  roleLabel: string;
  signOut: () => Promise<void>;
  trialBannerStatus: TrialBannerStatus | null;
  trialBannerFoundingPilot: {
    foundingPilotCount: number;
    foundingPilotCap: number;
    foundingPilotSpotsRemaining: number;
  } | null;
  isFoundingPilot: boolean;
  foundingPilotNumber: number | null;
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
  trialBannerStatus,
  trialBannerFoundingPilot,
  isFoundingPilot,
  foundingPilotNumber,
}: Props) {
  const [tabletNavOpen, setTabletNavOpen] = useState(false);
  const [welcomeModalDismissed, setWelcomeModalDismissed] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackSuccessKind, setFeedbackSuccessKind] = useState<FeedbackType | null>(null);

  useEffect(() => {
    if (feedbackSuccessKind === null) return;
    const t = window.setTimeout(() => setFeedbackSuccessKind(null), 5000);
    return () => window.clearTimeout(t);
  }, [feedbackSuccessKind]);

  const shouldShowWelcomeModal =
    !welcomeModalDismissed &&
    profile &&
    ((profile.welcome_modal_version_seen ?? null) === null ||
      (profile.welcome_modal_version_seen ?? 0) < CURRENT_WELCOME_MODAL_VERSION);

  return (
    <PortalFadeIn>
      {shouldShowWelcomeModal && (
        <PortalWelcomeModal
          profileBase={base}
          onDismiss={() => setWelcomeModalDismissed(true)}
        />
      )}
      <PortalFeedbackModal
        open={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        onSubmitted={(kind) => setFeedbackSuccessKind(kind)}
      />
      <DesktopIdleLogout />
      <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
        <div className="flex h-screen overflow-hidden">
          <aside className="sidebar-scrollbar-hide hidden shrink-0 flex-col gap-4 overflow-y-auto border-r border-white/5 bg-slate-950/70 backdrop-blur transition-[width] duration-300 xl:flex xl:h-screen xl:w-72 [html[data-theme=light]_&]:border-slate-200 [html[data-theme=light]_&]:bg-white">
            <div className="px-6 pt-6">
              <div className="text-lg font-semibold">
                Crew<span className="text-[#75C043]">Rules</span>
                <span className="align-super text-xs">™</span>
              </div>
              <div className="mt-1 space-y-1 text-xs text-slate-500 dark:text-slate-400">
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
            <aside className="hidden shrink-0 flex-col gap-4 overflow-hidden border-r border-white/5 bg-slate-950/88 backdrop-blur-xl md:flex md:h-screen md:w-56 xl:hidden [html[data-theme=light]_&]:border-slate-200 [html[data-theme=light]_&]:bg-white">
              <div className="px-5 pt-6">
                <div className="text-lg font-semibold">
                  Crew<span className="text-[#75C043]">Rules</span>
                  <span className="align-super text-xs">™</span>
                </div>
                <div className="mt-1 space-y-1 text-xs text-slate-500 dark:text-slate-400">
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
            <header className="relative z-20 shrink-0 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top,0px)] dark:border-white/5 dark:bg-slate-950/70 dark:backdrop-blur">
              <PortalDebugLine
                email={user.email}
                role={profile.role}
                tenant={profile.tenant}
                portal={profile.portal}
              />
              <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-3 sm:gap-6 sm:px-6">
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
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

                <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setFeedbackModalOpen(true)}
                    className="flex touch-manipulation items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10 sm:px-3 min-h-[44px]"
                    aria-label="Send feedback"
                  >
                    <MessageSquare className="h-4 w-4 shrink-0 text-[#75C043]" aria-hidden />
                    <span className="hidden sm:inline">Feedback</span>
                  </button>
                  <PortalUserMenu
                    email={profile.email ?? user.email ?? null}
                    roleLabel={roleLabel}
                    signOut={signOut}
                    isFoundingPilot={isFoundingPilot}
                    foundingPilotNumber={foundingPilotNumber}
                  />
                </div>
              </div>
            </header>

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8 pb-[env(safe-area-inset-bottom)]">
                {feedbackSuccessKind !== null && (
                  <div
                    role="status"
                    className="mb-4 rounded-xl border border-[#75C043]/35 bg-[#75C043]/10 px-4 py-3 text-sm text-slate-800 dark:text-slate-100"
                  >
                    {portalFeedbackSuccessMessage(feedbackSuccessKind)}
                  </div>
                )}
                {trialBannerStatus && trialBannerFoundingPilot && (
                  <PortalTrialUpgradeBanner
                    displayName={displayName}
                    status={trialBannerStatus.status}
                    daysRemaining={trialBannerStatus.daysRemaining}
                    foundingPilotCount={trialBannerFoundingPilot.foundingPilotCount}
                    foundingPilotCap={trialBannerFoundingPilot.foundingPilotCap}
                    foundingPilotSpotsRemaining={trialBannerFoundingPilot.foundingPilotSpotsRemaining}
                  />
                )}
                {children}
              </div>
            </div>
          </section>
        </div>
      </main>
    </PortalFadeIn>
  );
}
