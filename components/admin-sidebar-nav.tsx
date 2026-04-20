"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { label: string; href: string };

export function AdminSidebarNav({
  base,
  nav,
  portalBase,
  isSuperAdmin,
  hidePortalLink = false,
  onLinkClick,
}: {
  base: string;
  nav: NavItem[];
  portalBase: string;
  isSuperAdmin: boolean;
  hidePortalLink?: boolean;
  /** e.g. close mobile drawer after navigation */
  onLinkClick?: () => void;
}) {
  const pathname = usePathname();

  function isActive(item: NavItem) {
    const full = item.href ? `${base}/${item.href}` : base;
    if (full === base) return pathname === base;
    return pathname?.startsWith(full) ?? false;
  }

  return (
    <nav className="px-4 pb-6 pt-6">
      <div className="space-y-0.5">
        {nav.map((item) => {
          const full = item.href ? `${base}/${item.href}` : base;
          const active = isActive(item);
          const spacerBefore = item.href === "settings";
          return (
            <Fragment key={item.label}>
              {spacerBefore && (
                <div className="mt-5 h-3 shrink-0" aria-hidden />
              )}
              <Link
                href={full}
                onClick={() => onLinkClick?.()}
                className={`touch-target touch-pad flex items-center rounded-xl px-3 py-2 text-sm transition ${
                  active
                    ? "bg-slate-100 font-medium text-slate-900 ring-1 ring-inset ring-slate-200"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            </Fragment>
          );
        })}
      </div>

      <div className="mt-6 border-t border-slate-200 pt-4 space-y-0.5">
        {isSuperAdmin && (
          <Link
            href="/super-admin"
            onClick={() => onLinkClick?.()}
            className="touch-target touch-pad block rounded-xl px-3 py-2 text-sm text-amber-800/90 hover:bg-amber-50 hover:text-amber-900 transition"
          >
            Platform Owner Dashboard →
          </Link>
        )}
        {!hidePortalLink && (
          <Link
            href={portalBase}
            onClick={() => onLinkClick?.()}
            className="touch-target touch-pad block rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition"
          >
            ← Back to Portal
          </Link>
        )}
      </div>
    </nav>
  );
}
