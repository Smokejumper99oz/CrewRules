import type { ReactNode } from "react";
import Link from "next/link";
import { getTenantPortalConfig } from "@/lib/tenant-config";
import { getProfile, isAdmin } from "@/lib/profile";
import { signOut } from "./actions";
import { PortalMobileNav } from "@/components/portal-mobile-nav";
import { PortalUserMenu } from "@/components/portal-user-menu";
import { PageTitle } from "@/components/page-title";

function emailToDisplayName(email: string | null): string {
  if (!email) return "User";
  const local = email.split("@")[0] || "";
  return local
    .split(/[._-]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(" ") || email;
}

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

  const profile = await getProfile();
  const admin = await isAdmin();
  const base = `/${TENANT}/${PORTAL}/portal`;
  const displayName = emailToDisplayName(profile?.email ?? null);
  const roleLabel = admin ? "System Administrator" : "Member";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex">
        <aside className="hidden md:flex md:w-72 md:flex-col md:gap-4 border-r border-white/5 bg-slate-950/70 backdrop-blur">
          <div className="px-6 pt-6">
            <div className="text-lg font-semibold">
              Crew<span className="text-[#75C043]">Rules</span><span className="align-super text-xs">™</span>
            </div>
            <div className="mt-1 space-y-1 text-xs text-slate-400">
              <div>{cfg.tenant.displayName}</div>
              <div>{cfg.portal.displayName}</div>
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
              <div className="rounded-xl px-3 py-2">
                <div className="font-medium text-white">{displayName}</div>
                <div className="text-xs text-slate-400">{roleLabel}</div>
              </div>
              <form action={signOut} className="mt-2">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-white hover:bg-white/5 hover:text-white transition"
                >
                  Sign Out
                  <svg className="ml-auto h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </form>
            </div>
          </nav>
        </aside>

        <section className="flex-1">
          <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/70 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3 sm:px-6">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <PortalMobileNav
                  base={base}
                  nav={NAV}
                  admin={admin ?? false}
                  signOut={signOut}
                  portalName={cfg.portal.displayName}
                  displayName={displayName}
                  roleLabel={roleLabel}
                />
                <PageTitle portalDisplayName={cfg.portal.displayName} isAdmin={false} />
              </div>

              <div className="flex shrink-0 items-center">
                <PortalUserMenu
                  email={profile?.email ?? null}
                  role={admin ? "admin" : "member"}
                  signOut={signOut}
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
