"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gateSuperAdmin } from "./gate";
import { upsertMentorAssignmentFromSuperAdmin } from "@/lib/mentoring/super-admin-sync-assignment";
import { subDays, startOfDay, addDays } from "date-fns";
import { TENANT_CONFIG } from "@/lib/tenant-config";
import {
  STRIPE_PRO_MONTHLY_PRICE_USD,
  STRIPE_PRO_ANNUAL_PRICE_USD,
  FLIGHTAWARE_COST_PER_REQUEST_USD,
  AVIATIONSTACK_MONTHLY_LIMIT,
  AVIATIONSTACK_COST_PER_REQUEST_USD,
  AVIATIONSTACK_PERIOD_START_DAY,
  AVIATIONSTACK_PERIOD_LENGTH_DAYS,
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

/** Approximate online users: distinct user_ids from auth.sessions refreshed in last N minutes. */
export async function getOnlineUserCount(minutes = 15): Promise<number> {
  await ensureSuperAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_online_users_count", { p_minutes: minutes });
  if (error) {
    console.error("[SuperAdmin] get_online_users_count RPC failed:", error.message);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}

/** Update and return today's peak online count. Falls back to onlineNow if RPC fails. */
export async function getOnlinePeakToday(onlineNow: number): Promise<number> {
  await ensureSuperAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("update_online_peak_today", { p_online: onlineNow });
  if (error) {
    console.error("[SuperAdmin] update_online_peak_today RPC failed:", error.message);
    return onlineNow;
  }
  return typeof data === "number" ? data : onlineNow;
}

export type SystemEventRow = {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type SystemEventsResult = {
  events: SystemEventRow[];
  dismissedCount: number;
};

export async function getSystemEvents(): Promise<SystemEventsResult> {
  await ensureSuperAdmin();
  const admin = createAdminClient();

  const [eventsRes, dismissedRes] = await Promise.all([
    admin
      .from("system_events")
      .select("id, type, severity, title, message, metadata, created_at")
      .eq("dismissed", false)
      .order("created_at", { ascending: false })
      .limit(20),
    admin.from("system_events").select("id", { count: "exact", head: true }).eq("dismissed", true),
  ]);

  if (eventsRes.error) {
    console.error("[SuperAdmin] getSystemEvents failed:", eventsRes.error.message);
    return { events: [], dismissedCount: 0 };
  }

  const dismissedCount = dismissedRes.count ?? 0;
  return {
    events: (eventsRes.data ?? []) as SystemEventRow[],
    dismissedCount,
  };
}

export async function dismissSystemEvent(eventId: string): Promise<{ error?: string }> {
  await ensureSuperAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("system_events")
    .update({ dismissed: true })
    .eq("id", eventId);

  if (error) {
    console.error("[SuperAdmin] dismissSystemEvent failed:", error.message);
    return { error: error.message };
  }
  return {};
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

export type ChurnRenewalMetrics = {
  cancelAtPeriodEndCount: number;
  renewalsDueIn7Days: number;
  renewalsDueIn30Days: number;
  pastDueCount: number;
};

export async function getChurnRenewalMetrics(): Promise<ChurnRenewalMetrics> {
  await ensureSuperAdmin();
  const supabase = createAdminClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select(
      "billing_source, subscription_status, subscription_tier, billing_interval, current_period_end, cancel_at_period_end"
    );

  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let cancelAtPeriodEndCount = 0;
  let renewalsDueIn7Days = 0;
  let renewalsDueIn30Days = 0;
  let pastDueCount = 0;

  for (const p of profiles ?? []) {
    const isStripePaidPro =
      p.billing_source === "stripe" &&
      p.subscription_tier === "pro" &&
      (p.subscription_status === "active" || p.subscription_status === "trialing");

    if (
      p.billing_source === "stripe" &&
      p.subscription_status === "past_due" &&
      p.subscription_tier === "pro"
    ) {
      pastDueCount++;
    }

    if (!isStripePaidPro) continue;

    if (p.cancel_at_period_end) {
      cancelAtPeriodEndCount++;
    }

    if (!p.current_period_end) continue;

    const periodEnd = new Date(p.current_period_end);

    if (!p.cancel_at_period_end && periodEnd > now && periodEnd <= sevenDays) {
      renewalsDueIn7Days++;
    }

    if (!p.cancel_at_period_end && periodEnd > now && periodEnd <= thirtyDays) {
      renewalsDueIn30Days++;
    }
  }

  return {
    cancelAtPeriodEndCount,
    renewalsDueIn7Days,
    renewalsDueIn30Days,
    pastDueCount,
  };
}

export type FlightAwareUsageMetrics = {
  totalCalls: number;
  estimatedCost: number;
};

export async function getFlightAwareUsageMetrics(): Promise<FlightAwareUsageMetrics> {
  await ensureSuperAdmin();
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("flightaware_usage")
    .select("request_count");

  if (error) {
    return { totalCalls: 0, estimatedCost: 0 };
  }

  const totalCalls = (rows ?? []).reduce((sum, r) => sum + (r.request_count ?? 1), 0);
  const estimatedCost = totalCalls * FLIGHTAWARE_COST_PER_REQUEST_USD;

  return { totalCalls, estimatedCost };
}

export type AviationStackUsageMetrics = {
  requestsUsed: number;
  monthlyLimit: number;
  periodStart: string;
  periodEnd: string;
  totalCostUsd: number;
};

export async function getAviationStackUsageMetrics(): Promise<AviationStackUsageMetrics> {
  await ensureSuperAdmin();
  const admin = createAdminClient();

  const now = new Date();
  const dayOfMonth = now.getUTCDate();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  // Current billing period start: if today >= start day, period started this month; else last month
  const periodStartMonth = dayOfMonth >= AVIATIONSTACK_PERIOD_START_DAY ? month : month - 1;
  const periodStartYear = periodStartMonth >= 0 ? year : year - 1;
  const adjustedMonth = ((periodStartMonth % 12) + 12) % 12;

  const periodStart = new Date(Date.UTC(periodStartYear, adjustedMonth, AVIATIONSTACK_PERIOD_START_DAY));
  const periodEndDate = addDays(periodStart, AVIATIONSTACK_PERIOD_LENGTH_DAYS - 1);
  const periodEnd = new Date(
    Date.UTC(
      periodEndDate.getUTCFullYear(),
      periodEndDate.getUTCMonth(),
      periodEndDate.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
  const periodStartIso = periodStart.toISOString();
  const periodEndIso = periodEnd.toISOString();

  const { data: rows, error } = await admin
    .from("aviationstack_usage")
    .select("request_count")
    .gte("requested_at", periodStartIso)
    .lte("requested_at", periodEndIso);

  if (error) {
    return {
      requestsUsed: 0,
      monthlyLimit: AVIATIONSTACK_MONTHLY_LIMIT,
      periodStart: periodStartIso.slice(0, 10),
      periodEnd: periodEndIso.slice(0, 10),
      totalCostUsd: 0,
    };
  }

  const requestsUsed = (rows ?? []).reduce((sum, r) => sum + (r.request_count ?? 1), 0);
  const totalCostUsd = requestsUsed * AVIATIONSTACK_COST_PER_REQUEST_USD;

  return {
    requestsUsed,
    monthlyLimit: AVIATIONSTACK_MONTHLY_LIMIT,
    periodStart: periodStartIso.slice(0, 10),
    periodEnd: periodEndIso.slice(0, 10),
    totalCostUsd,
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

// ---------------------------------------------------------------------------
// Super Admin Users page
// ---------------------------------------------------------------------------

export type SuperAdminUserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  tenant: string;
  role: string;
  employee_number: string | null;
  phone: string | null;
  is_admin: boolean;
  is_mentor: boolean;
};

export async function getAllUsersForSuperAdmin(): Promise<SuperAdminUserRow[]> {
  await ensureSuperAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, tenant, role, employee_number, phone, is_admin, is_mentor")
    .order("created_at", { ascending: false });

  if (error) return [];

  return (data ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name ?? null,
    email: p.email ?? null,
    tenant: p.tenant ?? "unknown",
    role: p.role ?? "pilot",
    employee_number: p.employee_number ?? null,
    phone: p.phone ?? null,
    is_admin: p.is_admin ?? false,
    is_mentor: p.is_mentor ?? false,
  }));
}

export type UpdateSuperAdminUserAccessInput = {
  role: "pilot" | "flight_attendant";
  is_admin: boolean;
  is_mentor: boolean;
  super_admin?: boolean;
  phone?: string | null;
  employee_number?: string | null;
  /** When is_mentor is true, mentee's employee # (same tenant) to upsert mentor_assignments for the Mentoring page. */
  mentee_employee_number?: string | null;
};

export async function updateSuperAdminUserAccess(
  userId: string,
  data: UpdateSuperAdminUserAccessInput
): Promise<{ error?: string }> {
  const { user } = await gateSuperAdmin();

  if (userId === user.id && data.super_admin === false) {
    return { error: "Cannot remove your own Platform Owner access" };
  }

  const admin = createAdminClient();

  const { data: target, error: fetchErr } = await admin
    .from("profiles")
    .select("role, tenant")
    .eq("id", userId)
    .single();
  if (fetchErr || !target) return { error: "User not found" };

  const mentorTenant = String(target.tenant ?? "frontier").trim() || "frontier";

  const targetIsSuperAdmin = target.role === "super_admin";
  const canChangeSuperAdmin = data.super_admin !== undefined;

  if (canChangeSuperAdmin && data.super_admin === false) {
    const { data: superAdmins } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "super_admin");
    const count = superAdmins?.length ?? 0;
    if (targetIsSuperAdmin && count <= 1) {
      return { error: "Cannot remove the last Platform Owner" };
    }
  }

  const effectiveRole =
    canChangeSuperAdmin && data.super_admin
      ? "super_admin"
      : canChangeSuperAdmin && !data.super_admin
        ? data.role
        : targetIsSuperAdmin
          ? "super_admin"
          : data.role;
  const is_admin = data.is_admin;

  const { error } = await admin
    .from("profiles")
    .update({
      role: effectiveRole,
      is_admin,
      is_mentor: data.is_mentor,
      phone: data.phone ?? null,
      employee_number: data.employee_number ?? null,
    })
    .eq("id", userId);

  if (error) return { error: error.message };

  const menteeEmpTrimmed = data.mentee_employee_number?.trim() ?? "";
  if (data.is_mentor && menteeEmpTrimmed) {
    const syncResult = await upsertMentorAssignmentFromSuperAdmin(admin, {
      mentorUserId: userId,
      menteeEmployeeNumber: menteeEmpTrimmed,
      tenant: mentorTenant,
    });
    if (syncResult.error) return { error: syncResult.error };
  }

  return {};
}
