/**
 * RBAC: super_admin, tenant_admin, pilot, flight_attendant
 * super_admin: app owner, can manage any tenant
 * tenant_admin: can manage users in own tenant only
 * pilot / flight_attendant: no admin access
 */

export const ROLES = ["super_admin", "tenant_admin", "pilot", "flight_attendant"] as const;
export type Role = (typeof ROLES)[number];

export function isAdminRole(role: string): role is "super_admin" | "tenant_admin" {
  return role === "super_admin" || role === "tenant_admin";
}

export function canAccessAdmin(profile: { role: string; tenant: string; portal: string } | null): boolean {
  if (!profile) return false;
  if (!isAdminRole(profile.role)) return false;
  return true;
}

/** Can manage users in the given tenant. super_admin: any; tenant_admin: own only. */
export function canManageUsersInTenant(
  profile: { role: string; tenant: string } | null,
  targetTenant: string
): boolean {
  if (!profile) return false;
  if (profile.role === "super_admin") return true;
  if (profile.role === "tenant_admin" && profile.tenant === targetTenant) return true;
  return false;
}
