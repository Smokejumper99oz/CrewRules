"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Plane,
  UserCircle,
  CalendarClock,
  Users,
  LineChart,
  MessagesSquare,
  CreditCard,
  Bell,
  SlidersHorizontal,
  CircleUser,
} from "lucide-react";

const SETTINGS_BASE = "/frontier/pilots/portal/settings";

function buildSettingsNavItems(
  communityTabLabel: string,
  includeCommunityMentoring: boolean,
): readonly { href: string; label: ReactNode; icon: LucideIcon }[] {
  const items: { href: string; label: ReactNode; icon: LucideIcon }[] = [
    { href: `${SETTINGS_BASE}/pilot`, label: "Pilot", icon: UserCircle },
    {
      href: `${SETTINGS_BASE}/commute-assist`,
      label: (
        <>
          Commute Assist
          <span className="align-super text-[10px]">™</span>
        </>
      ),
      icon: Plane,
    },
    { href: `${SETTINGS_BASE}/schedule-import`, label: "FLICA", icon: CalendarClock },
    { href: `${SETTINGS_BASE}/family-view`, label: "Family View", icon: Users },
    { href: `${SETTINGS_BASE}/pay-projection`, label: "Pay Projection", icon: LineChart },
  ];
  if (includeCommunityMentoring) {
    items.push({ href: `${SETTINGS_BASE}/community`, label: communityTabLabel, icon: MessagesSquare });
  }
  items.push(
    { href: `${SETTINGS_BASE}/subscription`, label: "Subscription", icon: CreditCard },
    { href: `${SETTINGS_BASE}/notifications`, label: "Notifications", icon: Bell },
    { href: `${SETTINGS_BASE}/preferences`, label: "Preferences", icon: SlidersHorizontal },
    { href: `${SETTINGS_BASE}/account`, label: "Account", icon: CircleUser },
  );
  return items;
}

type PortalSettingsShellProps = {
  children: React.ReactNode;
  /** Label for the /settings/community tab (Mentor / Mentee / Community). */
  communityTabLabel?: string;
  /** When false, /settings/community is omitted from the Settings subnav (mentors + first-year mentees only). */
  shouldShowCommunityMentoringSettings?: boolean;
};

export function PortalSettingsShell({
  children,
  communityTabLabel = "Community",
  shouldShowCommunityMentoringSettings = true,
}: PortalSettingsShellProps) {
  const pathname = usePathname();
  const navItems = useMemo(
    () => buildSettingsNavItems(communityTabLabel, shouldShowCommunityMentoringSettings),
    [communityTabLabel, shouldShowCommunityMentoringSettings],
  );

  return (
    <div className="w-full min-w-0">
      <header className="min-w-0 w-full space-y-3.5 sm:space-y-5">
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere] dark:text-slate-400">
          Manage your Pilot Profile, Tools, Notifications, and Account Preferences.
        </p>

        <nav aria-label="Settings sections" className="min-w-0 w-full">
          <div
            className={[
              "sidebar-scrollbar-hide flex w-full max-w-full min-w-0 flex-nowrap items-end gap-0 overflow-x-auto overscroll-x-contain border-b border-slate-200 [touch-action:pan-x] dark:border-white/10",
              "scroll-smooth scroll-ps-3 scroll-pe-8 sm:scroll-ps-4 sm:scroll-pe-10 lg:scroll-ps-2 lg:scroll-pe-8",
              "ps-[max(0.75rem,env(safe-area-inset-left,0px))] pe-[max(2rem,calc(1rem+env(safe-area-inset-right,0px)))] sm:ps-4 sm:pe-10 lg:ps-2 lg:pe-8",
              "max-lg:snap-x max-lg:snap-mandatory",
            ].join(" ")}
          >
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    "group flex shrink-0 items-center gap-1.5 border-b-2 border-transparent text-sm transition touch-manipulation",
                    "-mb-px px-3 py-2.5 max-lg:min-h-[48px] max-lg:snap-start max-lg:snap-always max-lg:py-3 lg:min-h-0 lg:px-3.5 lg:py-2",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75C043]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-emerald-400/50 dark:focus-visible:ring-offset-slate-950",
                    isActive
                      ? "border-[#75C043] font-medium text-slate-900 dark:border-emerald-400 dark:text-white"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
                  ].join(" ")}
                >
                  <Icon
                    className={[
                      "h-3.5 w-3.5 shrink-0 transition",
                      isActive
                        ? "text-[#5a9a35] dark:text-emerald-300"
                        : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300",
                    ].join(" ")}
                    aria-hidden
                  />
                  <span className="whitespace-nowrap">{label}</span>
                </Link>
              );
            })}
            {/* Ensures scrollWidth extends past last tab so “Account” isn’t flush against the clip edge */}
            <span className="w-6 shrink-0 select-none sm:w-8" aria-hidden />
          </div>
        </nav>
      </header>

      <div className="mt-5 min-w-0 sm:mt-6 lg:mt-8">{children}</div>
    </div>
  );
}
