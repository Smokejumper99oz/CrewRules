import type { ReactNode } from "react";
import Link from "next/link";
import { getTenantPortalConfig } from "@/lib/tenant-config";
import { isAdmin } from "@/lib/profile";
import { signOut } from "./actions";
import { PortalMobileNav } from "@/components/portal-mobile-nav";

const TENANT = "frontier";
const PORTAL = "pilots";

const NAV = [
  { label: "Dashboard", href: "" },
  { label: "Ask", href: "ask" },
  { label: "Library", href: "library" },
  { label: "Forum", href: "forum" },
  { label: "Notes", href: "notes" },
  { label: "Mentoring", href: "mentoring" },
  { label: "Updates", href: "updates" },
  { label: "Settings", href: "settings" },
];

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const cfg = getTenantPortalConfig(TENANT, PORTAL);
  if (!cfg) return null;

  const admin = await isAdmin();
  const base = `/${TENANT}/${PORTAL}/portal`;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex">
        <aside className="hidden md:flex md:w-72 md:flex-col md:gap-4 border-r border-white/5 bg-slate-950/70 backdrop-blur">
          <div className="px-6 pt-6">
            <div className="text-sm font-semibold">
              Crew<span className="text-[#75C043]">Rules</span><span className="align-super text-xs">™</span>
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {cfg.tenant.displayName} • {cfg.portal.displayName}
            </div>
          </div>

          <nav className="px-4 pb-6 pt-2">
            <div className="space-y-1">
              {NAV.map((item) => (
                <Link
                  key={item.label}
                  href={item.href ? `${base}/${item.href}` : base}
                  className="block rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="mt-6 border-t border-white/5 pt-4">
              {admin && (
                <Link
                  href={`/${TENANT}/${PORTAL}/admin`}
                  className="mb-2 block rounded-xl px-3 py-2 text-sm text-amber-400/90 hover:bg-white/5 hover:text-amber-300 transition"
                >
                  Admin →
                </Link>
              )}
              <form action={signOut}>
                <button
                  type="submit"
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm text-slate-400 hover:bg-white/5 hover:text-white transition"
                >
                  Log out
                </button>
              </form>
            </div>
          </nav>
        </aside>

        <section className="flex-1">
          <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/70 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <PortalMobileNav
                  base={base}
                  nav={NAV}
                  admin={admin ?? false}
                  signOut={signOut}
                  portalName={cfg.portal.displayName}
                />
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-semibold">
                    Crew<span className="text-[#75C043]">Rules</span><span className="align-super text-xs">™</span>
                  </span>
                  <span className="hidden text-slate-500 sm:inline">|</span>
                  <span className="hidden truncate text-slate-400 sm:inline">
                    Tenant: {cfg.tenant.displayName}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:gap-4">
                <span className="text-xs text-slate-400">Role: {admin ? "admin" : "member"}</span>
                <span className="hidden text-slate-500 sm:inline">|</span>
                <Link
                  href={`${base}/settings`}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition"
                  aria-label="Profile & Settings"
                />
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 pb-[env(safe-area-inset-bottom)]">{children}</div>
        </section>
      </div>
    </main>
  );
}
