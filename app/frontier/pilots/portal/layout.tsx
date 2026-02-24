import type { ReactNode } from "react";
import Link from "next/link";
import { getTenantPortalConfig } from "@/lib/tenant-config";

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

export default function PortalLayout({ children }: { children: ReactNode }) {
  const cfg = getTenantPortalConfig(TENANT, PORTAL);
  if (!cfg) return null;

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
              <Link
                href={`/${TENANT}/${PORTAL}/login`}
                className="block rounded-xl px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white transition"
              >
                Log out (placeholder)
              </Link>
            </div>
          </nav>
        </aside>

        <section className="flex-1">
          <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/70 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <div>
                <div className="text-sm font-semibold">
                  {cfg.portal.displayName}
                </div>
                <div className="text-xs text-slate-400">
                  Tenant: {cfg.tenant.displayName}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-xs text-slate-400">
                  Role: member (placeholder)
                </div>
                <div className="h-9 w-9 rounded-xl bg-white/5 ring-1 ring-white/10" />
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
        </section>
      </div>
    </main>
  );
}
