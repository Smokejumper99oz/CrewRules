/**
 * Tenant-scoped feature flags.
 * Read via admin client (bypasses RLS — feature state is not user-specific).
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type TenantFeatureKey =
  | "mentoring"
  | "pilot_to_pilot"
  | "advanced_analytics"
  | "scheduling_tools"
  | "show_enterprise_programs";

export type TenantFeature = {
  feature_key: TenantFeatureKey;
  enabled: boolean;
  notes: string | null;
  enabled_at: string | null;
};

/** Returns all feature rows for the given tenant/portal. */
export async function getTenantFeatures(
  tenant: string,
  portal = "pilots"
): Promise<TenantFeature[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenant_features")
    .select("feature_key, enabled, notes, enabled_at")
    .eq("tenant", tenant)
    .eq("portal", portal)
    .order("feature_key");
  return (data ?? []) as TenantFeature[];
}

/** Returns a Set of enabled feature keys for quick lookup. */
export async function getEnabledFeatureSet(
  tenant: string,
  portal = "pilots"
): Promise<Set<TenantFeatureKey>> {
  const features = await getTenantFeatures(tenant, portal);
  return new Set(features.filter((f) => f.enabled).map((f) => f.feature_key));
}

/** Single feature check. */
export async function hasTenantFeature(
  tenant: string,
  feature: TenantFeatureKey,
  portal = "pilots"
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenant_features")
    .select("enabled")
    .eq("tenant", tenant)
    .eq("portal", portal)
    .eq("feature_key", feature)
    .maybeSingle();
  return data?.enabled === true;
}

/** Toggle a feature (called from Super Admin server action). */
export async function setTenantFeature(
  tenant: string,
  feature: TenantFeatureKey,
  enabled: boolean,
  portal = "pilots"
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("tenant_features").upsert(
    {
      tenant,
      portal,
      feature_key: feature,
      enabled,
      enabled_at: enabled ? new Date().toISOString() : null,
    },
    { onConflict: "tenant,portal,feature_key" }
  );
}
