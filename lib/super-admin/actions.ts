"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gateSuperAdmin } from "./gate";
import { subDays, startOfDay, addDays } from "date-fns";
import { TENANT_CONFIG } from "@/lib/tenant-config";
import {
  STRIPE_PRO_MONTHLY_PRICE_USD,
  STRIPE_PRO_ANNUAL_PRICE_USD,
} from "./pricing-config";

/** Run gate first; only call these actions from super-admin layout/page. */
async function ensureSuperAdmin() {
  await gateSuperAdmin();
}

export type SuperAdminKpiData = {
  newSignupsToday: number;
  newSignups7d: number;
  newSignups30d: number;
  freeCount: number;
  proCount: number;
  enterpriseCount: number;
  tenantCount: number;
};

export async function getSuperAdminKpis(): Promise<SuperAdminKpiData> {
  await ensureSuperAdmin();
  const supabase = await createClient();

  const now = new Date();
  const todayStart = startOfDay(now).toISOString();
  const sevenDaysAgo = subDays(now, 7).toISOString();
  const thirtyDaysAgo = subDays(now, 30).toISOString();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("created_at, subscription_tier, tenant");

  if (error) {
    return {
      newSignupsToday: 0,
      newSignups7d: 0,
      newSignups30d: 0,
      freeCount: 0,
      proCount: 0,
      enterpriseCount: 0,
      tenantCount: 0,
    };
  }

  const list = profiles ?? [];
  const tenants = new Set(list.map((p) => p.tenant).filter(Boolean));

  const newSignupsToday = list.filter((p) => p.created_at >= todayStart).length;
  const newSignups7d = list.filter((p) => p.created_at >= sevenDaysAgo).length;
  const newSignups30d = list.filter((p) => p.created_at >= thirtyDaysAgo).length;

  const freeCount = list.filter((p) => (p.subscription_tier ?? "free") === "free").length;
  const proCount = list.filter((p) => (p.subscription_tier ?? "free") === "pro").length;
  const enterpriseCount = list.filter((p) => (p.subscription_tier ?? "free") === "enterprise").length;

  return {
    newSignupsToday,
    newSignups7d,
    newSignups30d,
    freeCount,
    proCount,
    enterpriseCount,
    tenantCount: tenants.size,
  };
}

export type ProTrialMetrics = {
  trialsStarted: number;
  proTrialActive: number;
  expiringIn7Days: number;
  expiringIn3Days: number;
  trialExpired: number;
  convertedFromTrial: number;
  trialConversionRate: number | null;
  avgDaysRemaining: number | null;
};

export type ProTrialUserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  tenant: string;
  subscription_tier: string;
  pro_trial_started_at: string | null;
  pro_trial_expires_at: string | null;
  pro_trial_converted_at: string | null;
  updated_at: string | null;
  status: "expiring_urgent" | "expiring_soon" | "expired" | "converted";
  daysRemaining: number | null;
};

export type ProTrialUsers = {
  expiringUrgent: ProTrialUserRow[];
  expiringSoon: ProTrialUserRow[];
  expired: ProTrialUserRow[];
  converted: ProTrialUserRow[];
};

const TRIAL_USERS_PER_GROUP = 15;

export async function getProTrialUsers(): Promise<ProTrialUsers> {
  await ensureSuperAdmin();
  const supabase = await createClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, tenant, subscription_tier, pro_trial_started_at, pro_trial_expires_at, pro_trial_converted_at, updated_at");

  if (error) {
    return {
      expiringUrgent: [],
      expiringSoon: [],
      expired: [],
      converted: [],
    };
  }

  const now = new Date();
  const nowMs = now.getTime();
  const in3Days = addDays(now, 3).getTime();
  const in7Days = addDays(now, 7).getTime();
  const msPerDay = 24 * 60 * 60 * 1000;

  const expiringUrgent: ProTrialUserRow[] = [];
  const expiringSoon: ProTrialUserRow[] = [];
  const expired: ProTrialUserRow[] = [];
  const converted: ProTrialUserRow[] = [];

  for (const p of profiles ?? []) {
    const tier = (p.subscription_tier ?? "free") as string;
    const startedAt = p.pro_trial_started_at;
    const expiresAt = p.pro_trial_expires_at; // string | null

    if (tier === "free" && startedAt && expiresAt) {
      const expiresMs = new Date(expiresAt).getTime();
      if (Number.isNaN(expiresMs)) continue;

      const row: ProTrialUserRow = {
        id: p.id,
        email: p.email ?? null,
        full_name: p.full_name ?? null,
        tenant: p.tenant ?? "unknown",
        subscription_tier: tier,
        pro_trial_started_at: startedAt,
        pro_trial_expires_at: expiresAt,
        pro_trial_converted_at: null,
        updated_at: p.updated_at ?? null,
        status: "expired",
        daysRemaining: null,
      };

      if (expiresMs > nowMs) {
        const daysLeft = Math.ceil((expiresMs - nowMs) / msPerDay);
        row.daysRemaining = daysLeft;
        if (expiresMs <= in3Days) {
          row.status = "expiring_urgent";
          expiringUrgent.push(row);
        } else if (expiresMs <= in7Days) {
          row.status = "expiring_soon";
          expiringSoon.push(row);
        }
      } else {
        row.status = "expired";
        expired.push(row);
      }
    } else if (
      (tier === "pro" || tier === "enterprise") &&
      (p.pro_trial_converted_at != null || (startedAt != null && p.pro_trial_converted_at == null))
    ) {
      converted.push({
        id: p.id,
        email: p.email ?? null,
        full_name: p.full_name ?? null,
        tenant: p.tenant ?? "unknown",
        subscription_tier: tier,
        pro_trial_started_at: startedAt,
        pro_trial_expires_at: expiresAt ?? null,
        pro_trial_converted_at: p.pro_trial_converted_at ?? null,
        updated_at: p.updated_at ?? null,
        status: "converted",
        daysRemaining: null,
      });
    }
  }

  expiringUrgent.sort((a, b) => {
    const aMs = new Date(a.pro_trial_expires_at!).getTime();
    const bMs = new Date(b.pro_trial_expires_at!).getTime();
    return aMs - bMs;
  });
  expiringSoon.sort((a, b) => {
    const aMs = new Date(a.pro_trial_expires_at!).getTime();
    const bMs = new Date(b.pro_trial_expires_at!).getTime();
    return aMs - bMs;
  });
  expired.sort((a, b) => {
    const aMs = new Date(a.pro_trial_expires_at!).getTime();
    const bMs = new Date(b.pro_trial_expires_at!).getTime();
    return bMs - aMs;
  });
  converted.sort((a, b) => {
    const aMs = a.pro_trial_converted_at
      ? new Date(a.pro_trial_converted_at).getTime()
      : a.updated_at
        ? new Date(a.updated_at).getTime()
        : 0;
    const bMs = b.pro_trial_converted_at
      ? new Date(b.pro_trial_converted_at).getTime()
      : b.updated_at
        ? new Date(b.updated_at).getTime()
        : 0;
    return bMs - aMs;
  });

  return {
    expiringUrgent: expiringUrgent.slice(0, TRIAL_USERS_PER_GROUP),
    expiringSoon: expiringSoon.slice(0, TRIAL_USERS_PER_GROUP),
    expired: expired.slice(0, TRIAL_USERS_PER_GROUP),
    converted: converted.slice(0, TRIAL_USERS_PER_GROUP),
  };
}

export async function getProTrialMetrics(): Promise<ProTrialMetrics> {
  await ensureSuperAdmin();
  const supabase = await createClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("subscription_tier, pro_trial_started_at, pro_trial_expires_at, pro_trial_converted_at");

  if (error) {
    return {
      trialsStarted: 0,
      proTrialActive: 0,
      expiringIn7Days: 0,
      expiringIn3Days: 0,
      trialExpired: 0,
      convertedFromTrial: 0,
      trialConversionRate: null,
      avgDaysRemaining: null,
    };
  }

  const now = new Date();
  const nowMs = now.getTime();
  const in7Days = addDays(now, 7).getTime();
  const in3Days = addDays(now, 3).getTime();
  const msPerDay = 24 * 60 * 60 * 1000;

  let trialsStarted = 0;
  let proTrialActive = 0;
  let expiringIn7Days = 0;
  let expiringIn3Days = 0;
  let trialExpired = 0;
  let convertedFromTrial = 0;
  let daysRemainingSum = 0;
  let activeTrialCount = 0;

  for (const p of profiles ?? []) {
    const tier = (p.subscription_tier ?? "free") as string;
    const startedAt = p.pro_trial_started_at;
    const expiresAt = p.pro_trial_expires_at;
    const convertedAt = p.pro_trial_converted_at;

    if (startedAt != null) trialsStarted++;

    if (tier === "free" && startedAt && expiresAt) {
      const expiresMs = new Date(expiresAt).getTime();
      if (Number.isNaN(expiresMs)) continue;

      if (expiresMs > nowMs) {
        proTrialActive++;
        const daysLeft = Math.ceil((expiresMs - nowMs) / msPerDay);
        daysRemainingSum += daysLeft;
        activeTrialCount++;
        if (expiresMs <= in7Days) expiringIn7Days++;
        if (expiresMs <= in3Days) expiringIn3Days++;
      } else {
        trialExpired++;
      }
    } else if (
      (tier === "pro" || tier === "enterprise") &&
      (convertedAt != null || (startedAt != null && convertedAt == null))
    ) {
      convertedFromTrial++;
    }
  }

  const avgDaysRemaining =
    activeTrialCount > 0 ? Math.round((daysRemainingSum / activeTrialCount) * 10) / 10 : null;

  const outcomeDenom = convertedFromTrial + trialExpired;
  const trialConversionRate =
    outcomeDenom > 0 ? Math.round((convertedFromTrial / outcomeDenom) * 1000) / 10 : null;

  return {
    trialsStarted,
    proTrialActive,
    expiringIn7Days,
    expiringIn3Days,
    trialExpired,
    convertedFromTrial,
    trialConversionRate,
    avgDaysRemaining,
  };
}

export type StripeBillingMetrics = {
  paidProCount: number;
  monthlyCount: number;
  annualCount: number;
  cancelAtPeriodEndCount: number;
  liveMRR: number;
  liveARR: number;
};

export async function getStripeBillingMetrics(): Promise<StripeBillingMetrics> {
  await ensureSuperAdmin();
  const supabase = await createClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("billing_source, subscription_status, subscription_tier, billing_interval, cancel_at_period_end");

  if (error) {
    return {
      paidProCount: 0,
      monthlyCount: 0,
      annualCount: 0,
      cancelAtPeriodEndCount: 0,
      liveMRR: 0,
      liveARR: 0,
    };
  }

  const list = profiles ?? [];
  const paidPro = list.filter((p) => {
    const source = p.billing_source ?? null;
    const status = p.subscription_status ?? null;
    const tier = (p.subscription_tier ?? "free") as string;
    return (
      source === "stripe" &&
      (status === "active" || status === "trialing") &&
      tier === "pro"
    );
  });

  const monthlyCount = paidPro.filter((p) => (p.billing_interval ?? "") === "monthly").length;
  const annualCount = paidPro.filter((p) => (p.billing_interval ?? "") === "annual").length;
  const cancelAtPeriodEndCount = paidPro.filter((p) => p.cancel_at_period_end === true).length;

  const liveMRR =
    monthlyCount * STRIPE_PRO_MONTHLY_PRICE_USD +
    annualCount * (STRIPE_PRO_ANNUAL_PRICE_USD / 12);
  const liveARR = liveMRR * 12;

  return {
    paidProCount: paidPro.length,
    monthlyCount,
    annualCount,
    cancelAtPeriodEndCount,
    liveMRR,
    liveARR,
  };
}

export type TenantOverviewRow = {
  tenant: string;
  displayName: string;
  userCount: number;
  freeCount: number;
  proCount: number;
  enterpriseCount: number;
  familyViewEnabledCount: number;
};

export async function getTenantOverview(): Promise<TenantOverviewRow[]> {
  await ensureSuperAdmin();
  const supabase = await createClient();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("tenant, subscription_tier, family_view_enabled");

  if (error) return [];

  const list = profiles ?? [];
  const byTenant = new Map<string, { free: number; pro: number; enterprise: number; familyView: number }>();

  for (const p of list) {
    const t = p.tenant ?? "unknown";
    if (!byTenant.has(t)) {
      byTenant.set(t, { free: 0, pro: 0, enterprise: 0, familyView: 0 });
    }
    const row = byTenant.get(t)!;
    const tier = (p.subscription_tier ?? "free") as string;
    if (tier === "free") row.free++;
    else if (tier === "pro") row.pro++;
    else if (tier === "enterprise") row.enterprise++;
    if (p.family_view_enabled) row.familyView++;
  }

  return Array.from(byTenant.entries()).map(([tenant, counts]) => ({
    tenant,
    displayName: TENANT_CONFIG[tenant]?.displayName ?? tenant,
    userCount: counts.free + counts.pro + counts.enterprise,
    freeCount: counts.free,
    proCount: counts.pro,
    enterpriseCount: counts.enterprise,
    familyViewEnabledCount: counts.familyView,
  }));
}

export type ProductUsageData = {
  scheduleImportsLast30d: number | null;
  aiSearchLast30d: number | null;
  commuteRefreshTotal: number | null;
  familyViewEnabledCount: number;
};

export async function getProductUsage(): Promise<ProductUsageData> {
  await ensureSuperAdmin();
  const userSupabase = await createClient();
  const adminSupabase = createAdminClient();

  const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

  let scheduleImportsLast30d: number | null = null;
  let aiSearchLast30d: number | null = null;
  let commuteRefreshTotal: number | null = null;

  try {
    const { count: scheduleCount } = await adminSupabase
      .from("schedule_events")
      .select("id", { count: "exact", head: true })
      .gte("imported_at", thirtyDaysAgo);
    scheduleImportsLast30d = scheduleCount ?? 0;
  } catch {
    scheduleImportsLast30d = null;
  }

  try {
    const { count: askCount } = await adminSupabase
      .from("ask_qa")
      .select("id", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo);
    aiSearchLast30d = askCount ?? 0;
  } catch {
    aiSearchLast30d = null;
  }

  try {
    const { data: usageRows } = await adminSupabase
      .from("commute_refresh_usage_monthly")
      .select("refresh_count");
    commuteRefreshTotal = usageRows?.reduce((sum, r) => sum + (r.refresh_count ?? 0), 0) ?? 0;
  } catch {
    commuteRefreshTotal = null;
  }

  const { data: profiles } = await userSupabase
    .from("profiles")
    .select("family_view_enabled");
  const familyViewEnabledCount = profiles?.filter((p) => p.family_view_enabled).length ?? 0;

  return {
    scheduleImportsLast30d,
    aiSearchLast30d,
    commuteRefreshTotal,
    familyViewEnabledCount,
  };
}

export type RecentSignup = {
  id: string;
  email: string | null;
  full_name: string | null;
  tenant: string;
  created_at: string;
};

export type RecentImport = {
  user_id: string;
  imported_at: string;
  count: number;
};

export type RecentActivityData = {
  recentSignups: RecentSignup[];
  recentImports: RecentImport[];
};

export async function getRecentActivity(): Promise<RecentActivityData> {
  await ensureSuperAdmin();
  const userSupabase = await createClient();
  const adminSupabase = createAdminClient();

  const { data: signups } = await userSupabase
    .from("profiles")
    .select("id, email, full_name, tenant, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  let recentImports: RecentImport[] = [];
  try {
    const { data: events } = await adminSupabase
      .from("schedule_events")
      .select("user_id, imported_at")
      .order("imported_at", { ascending: false })
      .limit(100);

    const byBatch = new Map<string, { user_id: string; imported_at: string; count: number }>();
    for (const e of events ?? []) {
      const key = `${e.user_id}-${e.imported_at}`;
      if (!byBatch.has(key)) {
        byBatch.set(key, { user_id: e.user_id, imported_at: e.imported_at, count: 0 });
      }
      byBatch.get(key)!.count++;
    }
    recentImports = Array.from(byBatch.values())
      .sort((a, b) => new Date(b.imported_at).getTime() - new Date(a.imported_at).getTime())
      .slice(0, 10);
  } catch {
    // ignore
  }

  return {
    recentSignups: (signups ?? []) as RecentSignup[],
    recentImports,
  };
}
