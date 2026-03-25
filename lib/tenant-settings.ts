import { createClient } from "@/lib/supabase/server";

/**
 * Read a tenant setting by key.
 * Lookup order: (tenant, portal, key) then (tenant, null, key) for tenant-wide fallback.
 * Returns the jsonb value, or null if not found. RLS: admins for tenant rows; some keys (e.g. show_connect_flica_onboarding) allow tenant users to read.
 */
export async function getTenantSetting<T = unknown>(
  tenant: string,
  portal: string | null,
  key: string
): Promise<T | null> {
  try {
    const supabase = await createClient();

    // 1. Try portal-specific (tenant, portal, key)
    if (portal) {
      const { data } = await supabase
        .from("tenant_settings")
        .select("value")
        .eq("tenant", tenant)
        .eq("portal", portal)
        .eq("key", key)
        .maybeSingle();
      if (data?.value != null) return data.value as T;
    }

    // 2. Fallback to tenant-wide (tenant, null, key)
    const { data } = await supabase
      .from("tenant_settings")
      .select("value")
      .eq("tenant", tenant)
      .is("portal", null)
      .eq("key", key)
      .maybeSingle();

    return data?.value != null ? (data.value as T) : null;
  } catch {
    return null;
  }
}

export type PayScale = {
  effective_date: string;
  seats: {
    FO: Record<string, number>;
    CA: Record<string, number>;
  };
};

export async function getPayScale(tenant: string, portal: string) {
  return getTenantSetting<PayScale>(tenant, portal, "pay_scale");
}
