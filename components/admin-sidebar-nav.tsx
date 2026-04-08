"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { label: string; href: string };

export function AdminSidebarNav({
  base,
  nav,
  portalBase,
  isSuperAdmin,
  hidePortalLink = false,
}: {
  base: string;
  nav: NavItem[];
  portalBase: string;
  isSuperAdmin: boolean;
  hidePortalLink?: boolean;
}) {
  const pathname = usePathname();

  function isActive(item: NavItem) {
    const full = item.href ? `${base}/${item.href}` : base;
    if (full === base) return pathname === base;
    return pathname?.startsWith(full) ?? false;
  }

  return (
    <nav className="px-4 pb-6 pt-2">
      <div className="space-y-0.5">
        {nav.map((item) => {
          const full = item.href ? `${base}/${item.href}` : base;
          const active = isActive(item);
          return (
            <Link
              key={item.label}
              href={full}
              className={`touch-target touch-pad flex items-center rounded-xl px-3 py-2 text-sm transition ${
                active
                  ? "bg-white/8 font-medium text-white ring-1 ring-inset ring-white/10"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-6 border-t border-white/5 pt-4 space-y-0.5">
        {isSuperAdmin && (
          <Link
            href="/super-admin"
            className="touch-target touch-pad block rounded-xl px-3 py-2 text-sm text-amber-400/80 hover:bg-white/5 hover:text-amber-400 transition"
          >
            Platform Owner Dashboard →
          </Link>
        )}
        {!hidePortalLink && (
          <Link
            href={portalBase}
            className="touch-target touch-pad block rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-white/5 hover:text-slate-300 transition"
          >
            ← Back to Portal
          </Link>
        )}
      </div>
    </nav>
  );
}
