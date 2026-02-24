export type PortalKey = "pilots" | "flight-attendants" | "line-check-airman";

export type PortalConfig = {
  displayName: string;
  accentColorHex: string; // used later if you want per-portal accents
  discourseUrl: string; // iframe URL for the forum page
};

export type TenantConfig = {
  displayName: string;
  portals: Record<PortalKey, PortalConfig>;
};

// Frontier-first (you can expand later)
export const TENANT_CONFIG: Record<string, TenantConfig> = {
  frontier: {
    displayName: "Frontier Airlines",
    portals: {
      pilots: {
        displayName: "Pilot Portal",
        accentColorHex: "#75C043",
        discourseUrl: "https://f9-pilots.discourse.group",
      },
      "flight-attendants": {
        displayName: "Flight Attendant Portal",
        accentColorHex: "#75C043",
        discourseUrl: "https://f9-fas.discourse.group", // TODO: create when ready
      },
      "line-check-airman": {
        displayName: "Line Check Airman Portal",
        accentColorHex: "#75C043",
        discourseUrl: "https://f9-lca.discourse.group", // TODO: create when ready
      },
    },
  },
};

export function getTenantPortalConfig(tenant: string, portal: string) {
  const t = TENANT_CONFIG[tenant];
  if (!t) return null;

  const p = (t.portals as Record<string, PortalConfig>)[portal];
  if (!p) return null;

  return { tenant: t, portal: p };
}
