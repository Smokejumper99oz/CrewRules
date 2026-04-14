import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getTenantPortalConfig } from "@/lib/tenant-config";
import { getAccountRoleDisplay } from "@/lib/account-role-display";
import { getProfile, isAdmin } from "@/lib/profile";
import { signOut } from "../portal/actions";
import { AdminMobileNav } from "@/components/admin-mobile-nav";
import { AdminSidebarNav } from "@/components/admin-sidebar-nav";
import { PortalUserMenu } from "@/components/portal-user-menu";
import { PageTitle } from "@/components/page-title";
import { AdminFeedbackButton } from "@/components/admin-feedback-button";

const TENANT = "frontier";
const PORTAL = "pilots";

const ADMIN_NAV_BASE = [
  { label: "Dashboard", href: "" },
  { label: "Mentoring", href: "mentoring" },
  { label: "Users", href: "users" },
  { label: "Library", href: "library" },
  { label: "Uploads", href: "documents" },
  { label: "Settings", href: "settings" },
];

function getAdminNav(isSuperAdmin: boolean) {
  if (!isSuperAdmin) return ADMIN_NAV_BASE;
  return [...ADMIN_NAV_BASE, { label: "Waitlist", href: "waitlist" }];
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cfg = getTenantPortalConfig(TENANT, PORTAL);
  if (!cfg) {
    return (
      <main className="min-h-screen bg-[#F4F7F9] text-slate-900 grid place-items-center p-8">
        <p className="text-slate-600">Portal not found</p>
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
  // tenant_admin users (e.g. ALPA program managers) have no pilot portal — hide the back link
  const isTenantAdminOnly = userProfile.role === "tenant_admin" && !isSuperAdmin;
  const adminNav = getAdminNav(isSuperAdmin);
  const userMenuRoleLabel = getAccountRoleDisplay({
    role: userProfile.role,
    is_admin: userProfile.is_admin,
    is_mentor: userProfile.is_mentor,
  }).combined;

  return (
    <main className="min-h-screen bg-[#F4F7F9] text-slate-900 md:h-dvh md:overflow-hidden">
      {/* Fixed desktop sidebar; mobile uses hamburger only */}
      <aside className="fixed left-0 top-0 z-30 hidden h-dvh w-72 flex-col border-r border-slate-200 bg-[#F4F7F9] md:flex">
        <div className="shrink-0 px-6 pt-6">
          <div className="text-lg font-semibold text-slate-900">
            Crew<span className="text-[#75C043]">Rules</span>
            <span className="align-super text-xs">™</span>
          </div>
          <div className="mt-1 space-y-1 text-xs text-slate-600">
            <div>{cfg.tenant.displayName}</div>
            <div>Admin Portal</div>
          </div>
        </div>

        <div className="sidebar-scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-[env(safe-area-inset-bottom)]">
          <AdminSidebarNav
            base={base}
            nav={adminNav}
            portalBase={`/${TENANT}/${PORTAL}/portal`}
            isSuperAdmin={isSuperAdmin}
            hidePortalLink={isTenantAdminOnly}
          />
        </div>
      </aside>

      <section className="flex min-h-screen min-w-0 flex-col md:ml-72 md:h-dvh md:min-h-0 md:overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 bg-[#F4F7F9]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <AdminMobileNav
                base={`/${TENANT}/${PORTAL}/admin`}
                nav={adminNav}
                portalBase={`/${TENANT}/${PORTAL}/portal`}
                hidePortalLink={isTenantAdminOnly}
              />
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <PageTitle portalDisplayName={cfg.portal.displayName} isAdmin={true} adminSurface />
                  {isSuperAdmin && (
                    <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                      Platform Owner
                    </span>
                  )}
                </div>
                <div className="hidden text-xs text-emerald-800 sm:block">
                  <span className="font-bold">Frontier Airlines</span> • ALPA Mentorship Program
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <AdminFeedbackButton />
              <PortalUserMenu
                email={userProfile.email ?? null}
                roleLabel={userMenuRoleLabel}
                signOut={signOut}
                profileHref="/frontier/pilots/admin/profile"
                adminChrome
              />
            </div>
          </div>
        </header>

        <div className="sidebar-scrollbar-hide mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 pb-[env(safe-area-inset-bottom)] md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-y-contain">
          {children}
        </div>
      </section>
    </main>
  );
}
