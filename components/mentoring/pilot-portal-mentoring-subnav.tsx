"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE = "/frontier/pilots/portal/mentoring";
const GUIDE_HREF = `${BASE}/guide`;

const PRIMARY_TABS: readonly { href: string; label: string }[] = [
  { href: BASE, label: "Mentees Overview" },
  { href: `${BASE}/profile`, label: "Mentor Profile" },
  { href: `${BASE}/library`, label: "Mentor Library" },
];

function tabLinkClass(isActive: boolean, snap: boolean) {
  return [
    "group flex shrink-0 items-center gap-1.5 border-b-2 border-transparent text-sm transition touch-manipulation",
    "-mb-px px-3 py-2.5 max-lg:min-h-[48px] max-lg:py-3 lg:min-h-0 lg:px-3.5 lg:py-2",
    snap ? "max-lg:snap-start max-lg:snap-always" : "",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75C043]/40 focus-visible:ring-offset-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-slate-950",
    isActive
      ? "border-[#75C043] font-medium text-white dark:border-emerald-400"
      : "border-transparent text-slate-400",
  ]
    .filter(Boolean)
    .join(" ");
}

export function PilotPortalMentoringSubnav() {
  const pathname = usePathname();

  const isGuideActive =
    pathname === GUIDE_HREF || pathname === `${GUIDE_HREF}/`;

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
          {PRIMARY_TABS.map(({ href, label }) => {
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
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            );
          })}
          <span className="w-6 shrink-0 select-none sm:w-8" aria-hidden />
        </div>
        <Link
          href={GUIDE_HREF}
          className={tabLinkClass(isGuideActive, false)}
        >
          <span className="whitespace-nowrap">CrewRules Guide</span>
        </Link>
      </div>
    </nav>
  );
}
