import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantPortalConfig } from "@/lib/tenant-config";
import { getProfile, isAdmin } from "@/lib/profile";
import { signOut } from "../portal/actions";
import { AdminMobileNav } from "@/components/admin-mobile-nav";
import { PortalUserMenu } from "@/components/portal-user-menu";
import { PageTitle } from "@/components/page-title";

const TENANT = "frontier";
const PORTAL = "pilots";

const ADMIN_NAV = [
  { label: "Dashboard", href: "" },
  { label: "Uploads", href: "documents" },
  { label: "Library", href: "library" },
  { label: "Users", href: "people" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cfg = getTenantPortalConfig(TENANT, PORTAL);
  if (!cfg) return null;

  const userProfile = await getProfile();
  const admin = await isAdmin(TENANT, PORTAL);
  if (!admin || !userProfile) {
    redirect(`/${TENANT}/${PORTAL}/portal`);
  }

  const base = `/${TENANT}/${PORTAL}/admin`;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex">
        <aside className="hidden md:flex md:w-72 md:flex-col md:gap-4 border-r border-white/5 bg-slate-950/70 backdrop-blur">
          <div className="px-6 pt-6">
            <div className="text-lg font-semibold">
              Crew<span className="text-[#75C043]">Rules</span>
              <span className="align-super text-xs">™</span>
            </div>
            <div className="mt-1 space-y-1 text-xs text-slate-400">
              <div>{cfg.tenant.displayName}</div>
              <div>{cfg.portal.displayName}</div>
            </div>
          </div>

          <nav className="px-4 pb-6 pt-2">
            <div className="space-y-1">
              {ADMIN_NAV.map((item) => (
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
                href={`/${TENANT}/${PORTAL}/portal`}
                className="block rounded-xl px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white transition"
              >
                ← Back to Portal
              </Link>
            </div>
          </nav>
        </aside>

        <section className="flex-1">
          <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/70 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <AdminMobileNav
                  base={`/${TENANT}/${PORTAL}/admin`}
                  nav={ADMIN_NAV}
                  portalBase={`/${TENANT}/${PORTAL}/portal`}
                />
                <div className="min-w-0 space-y-0.5">
                  <PageTitle portalDisplayName={cfg.portal.displayName} isAdmin={true} />
                  <div className="hidden text-xs text-slate-400 sm:block">
                    Manage content, roles, and portal configuration
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center">
                <PortalUserMenu
                  email={userProfile?.email ?? null}
                  role={userProfile?.role ?? "tenant_admin"}
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
