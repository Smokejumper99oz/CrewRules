import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { getTenantPortalConfig } from "@/lib/tenant-config";
import { gateUserForPortal } from "@/lib/portal-gate";
import { isAdmin, getDisplayName, getProTrialBannerStatus } from "@/lib/profile";
import { signOut } from "./actions";
import { PortalLayoutShell } from "./portal-layout-shell";

const TENANT = "frontier";
const PORTAL = "pilots";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const cfg = getTenantPortalConfig(TENANT, PORTAL);
  if (!cfg) return null;

  const { user, profile } = await gateUserForPortal(TENANT, PORTAL);

  const cookieStore = await cookies();
  if (!cookieStore.get("crewrules-color-mode")?.value && profile?.color_mode) {
    cookieStore.set("crewrules-color-mode", profile.color_mode, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  }

  const admin = await isAdmin(TENANT, PORTAL);
  const trialBannerStatus = getProTrialBannerStatus(profile);
  const base = `/${TENANT}/${PORTAL}/portal`;
  const displayName = getDisplayName(profile ?? null);
  const roleLabel =
    profile?.role === "super_admin"
      ? "Super Administrator"
      : profile?.role === "tenant_admin"
        ? "Administrator"
        : profile?.role === "flight_attendant"
          ? "Flight Attendant"
          : "Pilot";

  return (
    <PortalLayoutShell
      base={base}
      cfg={cfg}
      user={user}
      profile={profile}
      admin={admin ?? false}
      displayName={displayName}
      roleLabel={roleLabel}
      signOut={signOut}
      trialBannerStatus={trialBannerStatus}
    >
      {children}
    </PortalLayoutShell>
  );
}
