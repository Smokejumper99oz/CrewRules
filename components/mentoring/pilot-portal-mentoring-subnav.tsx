"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { UserCircle, Users } from "lucide-react";

const BASE = "/frontier/pilots/portal/mentoring";

const PRIMARY_TABS: readonly { href: string; label: string; icon: LucideIcon }[] = [
  { href: BASE, label: "Mentees Overview", icon: Users },
  { href: `${BASE}/profile`, label: "Mentor Profile", icon: UserCircle },
];

function tabLinkClass(isActive: boolean, snap: boolean) {
  return [
    "group flex shrink-0 items-center gap-1.5 border-0 border-b-2 border-b-transparent text-sm transition touch-manipulation",
    "-mb-px px-3 py-2.5 max-lg:min-h-[48px] max-lg:py-3 lg:min-h-0 lg:px-3.5 lg:py-2",
    snap ? "max-lg:snap-start max-lg:snap-always" : "",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75C043]/40 focus-visible:ring-offset-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-slate-950",
    isActive
      ? "font-medium text-white shadow-[inset_0_-2px_0_0_#75C043] dark:shadow-[inset_0_-2px_0_0_#34d399]"
      : "shadow-none text-slate-400",
  ]
    .filter(Boolean)
    .join(" ");
}

export function PilotPortalMentoringSubnav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Mentoring sections" className="min-w-0 w-full">
      <div className="flex w-full max-w-full min-w-0 items-end gap-2 border-b border-white/10 sm:gap-4">
        <div
          className={[
            "sidebar-scrollbar-hide flex min-w-0 flex-1 flex-nowrap items-end gap-0 overflow-x-auto overscroll-x-contain",
            "scroll-smooth scroll-ps-3 scroll-pe-8 sm:scroll-ps-4 sm:scroll-pe-10 lg:scroll-ps-0 lg:scroll-pe-8",
            "max-lg:snap-x max-lg:snap-mandatory",
          ].join(" ")}
        >
          {PRIMARY_TABS.map(({ href, label, icon: Icon }) => {
            const isOverview = href === BASE;
            const isActive = isOverview
              ? pathname === href || pathname === `${BASE}/`
              : pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={tabLinkClass(isActive, true)}
              >
                <Icon
                  className={[
                    "h-3.5 w-3.5 shrink-0 transition",
                    isActive
                      ? "text-[#5a9a35] dark:text-emerald-300"
                      : "text-slate-500 group-hover:text-slate-300 dark:text-slate-500 dark:group-hover:text-slate-300",
                  ].join(" ")}
                  aria-hidden
                />
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            );
          })}
          <span className="w-6 shrink-0 select-none sm:w-8" aria-hidden />
        </div>
      </div>
    </nav>
  );
}
