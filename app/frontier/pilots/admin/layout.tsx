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

const ADMIN_NAV_BASE = [
  { label: "Dashboard", href: "" },
  { label: "Uploads", href: "documents" },
  { label: "Library", href: "library" },
  { label: "Users", href: "people" },
];

function getAdminNav(isSuperAdmin: boolean) {
  if (!isSuperAdmin) return ADMIN_NAV_BASE;
  return [...ADMIN_NAV_BASE, { label: "Waitlist", href: "waitlist" }];
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cfg = getTenantPortalConfig(TENANT, PORTAL);
  if (!cfg) {
    return (
      <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-8">
        <p className="text-slate-400">Portal not found</p>
      </main>
    );
  }

  const userProfile = await getProfile();
  if (!userProfile) {
    redirect(`/${TENANT}/${PORTAL}/login?error=profile_missing`);
  }
  const admin = await isAdmin(TENANT, PORTAL);
  if (!admin) {
    redirect(`/${TENANT}/${PORTAL}/portal`);
  }

  const base = `/${TENANT}/${PORTAL}/admin`;
  const isSuperAdmin = userProfile.role === "super_admin";
  const adminNav = getAdminNav(isSuperAdmin);

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
              {adminNav.map((item) => (
                <Link
                  key={item.label}
                  href={item.href ? `${base}/${item.href}` : base}
                  className="touch-target touch-pad block rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="mt-6 border-t border-white/5 pt-4">
              <Link
                href={`/${TENANT}/${PORTAL}/portal`}
                className="touch-target touch-pad block rounded-xl px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white transition"
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
                  nav={adminNav}
                  portalBase={`/${TENANT}/${PORTAL}/portal`}
                />
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <PageTitle portalDisplayName={cfg.portal.displayName} isAdmin={true} />
                    {isSuperAdmin && (
                      <span className="inline-flex rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-amber-400/30">
                        Super Admin
                      </span>
                    )}
                  </div>
                  <div className="hidden text-xs text-slate-400 sm:block">
                    Manage content, roles, and portal configuration
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center">
                <PortalUserMenu
                  email={userProfile.email ?? null}
                  role={userProfile.role}
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
