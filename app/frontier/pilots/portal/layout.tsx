import type { ReactNode } from "react";
import { getTenantPortalConfig } from "@/lib/tenant-config";
import { gateUserForPortal } from "@/lib/portal-gate";
import { isAdmin, getDisplayName, getProTrialBannerStatus } from "@/lib/profile";
import { signOut } from "./actions";
import { PortalLayoutShell } from "./portal-layout-shell";

export const dynamic = "force-dynamic";

const TENANT = "frontier";
const PORTAL = "pilots";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const cfg = getTenantPortalConfig(TENANT, PORTAL);
  if (!cfg) return null;

  const { user, profile } = await gateUserForPortal(TENANT, PORTAL);

  const admin = await isAdmin(TENANT, PORTAL);
  const trialBannerStatus = getProTrialBannerStatus(profile);
  const base = `/${TENANT}/${PORTAL}/portal`;
  const displayName = getDisplayName(profile ?? null);
  const roleLabel =
    profile?.role === "super_admin"
      ? "Platform Owner"
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
