export type PortalKey = "pilots" | "flight-attendants" | "line-check-airman";

export type PortalConfig = {
  displayName: string;
  accentColorHex: string; // used later if you want per-portal accents
  discourseUrl: string; // iframe URL for the forum page
};

export type TenantConfig = {
  displayName: string;
  /** Default IANA timezone for ICS import when times have no TZID (e.g. FLICA exports). */
  sourceTimezone?: string;
  /** Default credit hours for reserve lines when not in ICS (monthly total, per CBA). */
  reserveCreditHours?: number;
  /** Credit hours per reserve day (RSA, RSB, RSC, RSD, RSE) when not in ICS. Typically 4 to reach ~75/month. */
  reserveCreditPerDay?: number;
  portals: Record<PortalKey, PortalConfig>;
};

// Frontier-first (you can expand later)
export const TENANT_CONFIG: Record<string, TenantConfig> = {
  frontier: {
    displayName: "Frontier Airlines",
    sourceTimezone: "America/Denver",
    reserveCreditHours: 75,
    reserveCreditPerDay: 4,
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

/** Default IANA timezone for ICS import (floating times). Falls back to America/Denver. */
export function getTenantSourceTimezone(tenant: string): string {
  return TENANT_CONFIG[tenant]?.sourceTimezone ?? "America/Denver";
}

/** Default credit hours for reserve lines when not in ICS (monthly total, per CBA). */
export function getReserveCreditHours(tenant: string): number {
  return TENANT_CONFIG[tenant]?.reserveCreditHours ?? 75;
}

/** Credit hours per reserve day (RSA, RSB, RSC, RSD, RSE) when not in ICS. */
export function getReserveCreditPerDay(tenant: string): number {
  return TENANT_CONFIG[tenant]?.reserveCreditPerDay ?? 4;
}
