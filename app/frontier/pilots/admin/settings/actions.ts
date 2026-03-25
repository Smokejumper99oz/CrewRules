"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/profile";
import { revalidatePath } from "next/cache";
import { getTenantSetting } from "@/lib/tenant-settings";

const TENANT = "frontier";
const PORTAL = "pilots";
const SHOW_CONNECT_FLICA_ONBOARDING_KEY = "show_connect_flica_onboarding";

const PAY_SCALE_VALUE = {
  effective_date: "2026-01-01",
  seats: {
    FO: {
      "1": 100,
      "2": 118.74,
      "3": 0,
      "4": 0,
      "5": 0,
      "6": 0,
      "7": 0,
      "8": 0,
      "9": 0,
      "10": 0,
      "11": 0,
      "12": 0,
    },
    CA: {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
      "6": 0,
      "7": 0,
      "8": 0,
      "9": 0,
      "10": 0,
      "11": 0,
      "12": 0,
    },
  },
} as const;

function interpretShowConnectFlicaOnboarding(raw: unknown): boolean {
  if (raw == null) return true;
  if (raw === false) return false;
  if (raw === true) return true;
  return true;
}

export async function getShowConnectFlicaOnboardingSetting(): Promise<
  { enabled: boolean } | { error: string }
> {
  const allowed = await isAdmin(TENANT, PORTAL);
  if (!allowed) {
    return { error: "Unauthorized" };
  }
  const raw = await getTenantSetting<unknown>(TENANT, PORTAL, SHOW_CONNECT_FLICA_ONBOARDING_KEY);
  return { enabled: interpretShowConnectFlicaOnboarding(raw) };
}

export async function setShowConnectFlicaOnboardingSetting(
  enabled: boolean
): Promise<{ success?: boolean; error?: string }> {
  const admin = await isAdmin(TENANT, PORTAL);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  try {
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("tenant_settings")
      .select("tenant")
      .eq("tenant", TENANT)
      .eq("portal", PORTAL)
      .eq("key", SHOW_CONNECT_FLICA_ONBOARDING_KEY)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("tenant_settings")
        .update({ value: enabled })
        .eq("tenant", TENANT)
        .eq("portal", PORTAL)
        .eq("key", SHOW_CONNECT_FLICA_ONBOARDING_KEY);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("tenant_settings").insert({
        tenant: TENANT,
        portal: PORTAL,
        key: SHOW_CONNECT_FLICA_ONBOARDING_KEY,
        value: enabled,
      });
      if (error) return { error: error.message };
    }

    revalidatePath(`/${TENANT}/${PORTAL}/admin`);
    revalidatePath(`/${TENANT}/${PORTAL}/admin/settings`);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function upsertPayScaleSetting(): Promise<{ success?: boolean; error?: string }> {
  const admin = await isAdmin(TENANT, PORTAL);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  try {
    const supabase = await createClient();
    const row = {
      tenant: TENANT,
      portal: PORTAL,
      key: "pay_scale",
      value: PAY_SCALE_VALUE as unknown as Record<string, unknown>,
    };

    const { data: existing } = await supabase
      .from("tenant_settings")
      .select("tenant")
      .eq("tenant", TENANT)
      .eq("portal", PORTAL)
      .eq("key", "pay_scale")
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("tenant_settings")
        .update({ value: row.value })
        .eq("tenant", TENANT)
        .eq("portal", PORTAL)
        .eq("key", "pay_scale");
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase.from("tenant_settings").insert(row);
      if (error) return { error: error.message };
    }

    revalidatePath(`/${TENANT}/${PORTAL}/admin`);
    revalidatePath(`/${TENANT}/${PORTAL}/admin/settings`);
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unknown error" };
  }
}
