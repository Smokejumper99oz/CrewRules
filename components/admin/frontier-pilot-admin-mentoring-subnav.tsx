"use client";

import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  LayoutDashboard,
  Mail,
  Upload,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE = "/frontier/pilots/admin/mentoring";

const TABS: readonly { href: string; label: string; Icon: LucideIcon }[] = [
  { href: BASE, label: "Overview", Icon: LayoutDashboard },
  { href: `${BASE}/assignments`, label: "Assignments", Icon: ClipboardList },
  { href: `${BASE}/mentee-roster`, label: "Mentee Roster", Icon: Users },
  { href: `${BASE}/mentor-roster`, label: "Mentor Roster", Icon: UserCheck },
  { href: `${BASE}/email-center`, label: "Email Center", Icon: Mail },
  { href: `${BASE}/mentee-import`, label: "Mentee Imports", Icon: Upload },
  { href: `${BASE}/mentor-import`, label: "Mentor Imports", Icon: Upload },
];

export function FrontierPilotAdminMentoringSubnav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Mentoring admin sections" className="min-w-0 w-full">
      <div
        className={[
          "sidebar-scrollbar-hide flex w-full max-w-full min-w-0 flex-nowrap items-end gap-0 overflow-x-auto overscroll-x-contain border-b border-white/10",
          "scroll-smooth scroll-ps-3 scroll-pe-8 sm:scroll-ps-4 sm:scroll-pe-10 lg:scroll-ps-0 lg:scroll-pe-8",
          "max-lg:snap-x max-lg:snap-mandatory",
        ].join(" ")}
      >
        {TABS.map(({ href, label, Icon }) => {
          const isActive = pathname === href || (href === BASE && pathname === `${BASE}/`);
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
              <Icon className="h-4 w-4 shrink-0 opacity-80 group-hover:opacity-100" aria-hidden />
              <span className="whitespace-nowrap">{label}</span>
            </Link>
          );
        })}
        <span className="w-6 shrink-0 select-none sm:w-8" aria-hidden />
      </div>
    </nav>
  );
}
