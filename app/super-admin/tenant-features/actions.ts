"use server";

import { revalidatePath } from "next/cache";
import { gateSuperAdmin } from "@/lib/super-admin/gate";
import { setTenantFeature, type TenantFeatureKey } from "@/lib/tenant-features";

export async function toggleTenantFeature(
  tenant: string,
  portal: string,
  featureKey: TenantFeatureKey,
  enabled: boolean
): Promise<{ ok: boolean; error?: string }> {
  try {
    await gateSuperAdmin();
    await setTenantFeature(tenant, featureKey, enabled, portal);
    revalidatePath("/super-admin/tenant-features");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
