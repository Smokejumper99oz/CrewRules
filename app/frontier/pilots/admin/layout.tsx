import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getTenantPortalConfig } from "@/lib/tenant-config";
import { getAccountRoleDisplay } from "@/lib/account-role-display";
import { getProfile, isAdmin } from "@/lib/profile";
import { signOut } from "../portal/actions";
import { AdminLayoutShell } from "@/components/admin-layout-shell";

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
  const isTenantAdminOnly = userProfile.role === "tenant_admin" && !isSuperAdmin;
  const adminNav = getAdminNav(isSuperAdmin);
  const userMenuRoleLabel = getAccountRoleDisplay({
    role: userProfile.role,
    is_admin: userProfile.is_admin,
    is_mentor: userProfile.is_mentor,
  }).combined;

  return (
    <AdminLayoutShell
      tenantDisplayName={cfg.tenant.displayName}
      portalDisplayName={cfg.portal.displayName}
      base={base}
      portalBase={`/${TENANT}/${PORTAL}/portal`}
      adminNav={adminNav}
      isSuperAdmin={isSuperAdmin}
      hidePortalLink={isTenantAdminOnly}
      userMenu={{
        email: userProfile.email ?? null,
        roleLabel: userMenuRoleLabel,
        signOut,
        profileHref: "/frontier/pilots/admin/profile",
      }}
    >
      {children}
    </AdminLayoutShell>
  );
}
