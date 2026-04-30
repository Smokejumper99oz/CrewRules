"use client";

import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

type NavItem = { label: string; href: string; badge?: "BETA" | "IN DEVELOPMENT" };
type NavGroup = { title: string; items: readonly NavItem[] };

type PortalSidebarContentProps = {
  base: string;
  navGroups: readonly NavGroup[];
  admin: boolean;
  displayName: string;
  roleLabel: string;
  signOut: () => Promise<void>;
  /** "desktop" | "tablet" | "drawer" - affects padding and link styles */
  variant?: "desktop" | "tablet" | "drawer";
  onLinkClick?: () => void;
};

const variantStyles = {
  desktop: {
    heading: "text-slate-500 dark:text-slate-500",
    marker: "marker:text-slate-500 dark:marker:text-slate-500",
    link: "flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 transition touch-target touch-pad dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white",
    adminLink: "touch-target touch-pad mb-2 block rounded-xl px-3 py-2 text-sm",
    signOutButton: "touch-target touch-pad flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-100 transition touch-manipulation disabled:opacity-50 dark:text-white dark:hover:bg-white/5",
  },
  tablet: {
    heading: "text-slate-500 dark:text-slate-500",
    marker: "marker:text-slate-500 dark:marker:text-slate-500",
    link: "touch-target touch-pad flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 transition dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white",
    adminLink: "touch-target touch-pad mb-2 block rounded-xl px-3 py-2 text-sm",
    signOutButton: "touch-target touch-pad flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-100 transition touch-manipulation disabled:opacity-50 dark:text-white dark:hover:bg-white/5",
  },
  drawer: {
    heading: "text-slate-600 dark:text-slate-300/90",
    marker: "marker:text-slate-500 dark:marker:text-slate-400",
    link: "flex items-center justify-between gap-2 rounded-xl px-3 py-3 text-sm text-slate-600 hover:bg-slate-100 transition touch-manipulation min-h-[44px] dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white",
    adminLink: "mb-2 flex min-h-[44px] items-center rounded-xl px-3 py-3 text-sm",
    signOutButton: "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-100 transition touch-manipulation disabled:opacity-50 dark:text-white dark:hover:bg-white/5",
  },
};

export function PortalSidebarContent({
  base,
  navGroups,
  admin,
  displayName,
  roleLabel,
  signOut,
  variant = "desktop",
  onLinkClick,
}: PortalSidebarContentProps) {
  const s = variantStyles[variant];

  return (
    <>
      <div className="space-y-6">
        {navGroups.map((group) => (
          <div key={group.title}>
            <h3 className={`mb-2 px-3 text-xs font-semibold uppercase tracking-wider ${s.heading}`}>
              {group.title}
            </h3>
            <ul className={`space-y-0.5 list-disc pl-5 ${s.marker}`}>
              {group.items.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href ? `${base}/${item.href}` : base}
                    onClick={onLinkClick ? () => onLinkClick() : undefined}
                    className={s.link}
                  >
                    <span>{item.label}</span>
                    {item.badge === "BETA" && (
                      <span className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/40">
                        BETA
                      </span>
                    )}
                    {item.badge === "IN DEVELOPMENT" && (
                      <span className="shrink-0 bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 text-xs font-semibold px-2 py-0.5 rounded-full">
                        IN DEVELOPMENT
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className={`mt-6 border-t pt-4 ${variant === "drawer" ? "border-slate-200 dark:border-white/10" : "border-slate-200 dark:border-white/5"}`}>
        {admin && (
          <Link
            href={`${base.replace("/portal", "/admin")}`}
            onClick={onLinkClick ? () => onLinkClick() : undefined}
            className={`${s.adminLink} text-amber-600 hover:bg-slate-100 transition dark:text-amber-400/90 dark:hover:bg-white/5 dark:hover:text-amber-300`}
          >
            Admin →
          </Link>
        )}
        <div className="rounded-xl px-3 py-2">
          <div className="font-medium text-white">{displayName}</div>
          <div className="text-xs text-slate-400">{roleLabel}</div>
        </div>
        <SignOutButton signOut={signOut} className="mt-2" buttonClassName={s.signOutButton}>
          <span className="flex-1">Sign Out</span>
          <svg
            className="ml-auto h-4 w-4 text-slate-500 dark:text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </SignOutButton>
      </div>
    </>
  );
}
