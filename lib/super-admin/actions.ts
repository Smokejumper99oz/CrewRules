"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gateSuperAdmin } from "./gate";
import { upsertMentorAssignmentFromSuperAdmin } from "@/lib/mentoring/super-admin-sync-assignment";
import {
  createMilestonesForAssignment,
  getMilestoneScheduleForHireDate,
  syncMentorshipMilestoneDueDatesFromHireForAssignment,
} from "@/lib/mentoring/create-milestones-for-assignment";
import { fetchMentoringMilestoneIntegrityScan } from "@/lib/mentoring/mentoring-milestone-integrity-scan";
import { getMenteeUserIdsWithMilitaryLeaveWorkspace } from "@/lib/mentoring/mentee-military-leave-workspace";
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
import { buildImportWarningRows, type ImportWarningRow } from "./import-warnings";
import {
  finalizePendingAccountDeletion,
  type FinalizePendingAccountDeletionResult,
} from "@/lib/account-deletion/finalize-pending-account-deletion";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { isValidHireDateYyyyMmDd } from "@/lib/mentoring/mentoring-csv-import";
import { fetchAuthLastSignInAtByUserId } from "@/lib/super-admin/auth-last-sign-in-map";

export type { ImportWarningRow };
export type { FinalizePendingAccountDeletionResult };

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
  /** Profiles with non-null `welcome_modal_version_seen` (same as mentoring roster `active` vs `not_joined`). */
  joinedUserCount: number;
  /** Profiles with null `welcome_modal_version_seen` (same rule as mentee-roster `not_joined`). */
  notJoinedUserCount: number;
  /** Profiles with a non-null `deletion_scheduled_for` (in grace / awaiting finalize). */
  pendingDeletionCount: number;
  /** Latest `profiles.deleted_at` among those pending rows (grace start / click time), ISO string or null. */
  pendingDeletionMostRecentDeletedAt: string | null;
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
    .select(
      "created_at, subscription_tier, tenant, deleted_at, deletion_scheduled_for, welcome_modal_version_seen"
    );

  if (error) {
    return {
      newSignupsToday: 0,
      newSignups7d: 0,
      newSignups30d: 0,
      freeCount: 0,
      proCount: 0,
      enterpriseCount: 0,
      tenantCount: 0,
      joinedUserCount: 0,
      notJoinedUserCount: 0,
      pendingDeletionCount: 0,
      pendingDeletionMostRecentDeletedAt: null,
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

  const pendingRows = list.filter((p) => p.deletion_scheduled_for != null);
  const pendingDeletionCount = pendingRows.length;

  const deletedAtCandidates = pendingRows
    .map((p) => p.deleted_at)
    .filter((d): d is string => d != null && String(d).trim() !== "");
  const pendingDeletionMostRecentDeletedAt =
    deletedAtCandidates.length > 0
      ? deletedAtCandidates.reduce((latest, cur) => (cur > latest ? cur : latest))
      : null;

  const notJoinedUserCount = list.filter(
    (p) => (p.welcome_modal_version_seen ?? null) == null
  ).length;
  const joinedUserCount = list.length - notJoinedUserCount;

  return {
    newSignupsToday,
    newSignups7d,
    newSignups30d,
    freeCount,
    proCount,
    enterpriseCount,
    tenantCount: tenants.size,
    joinedUserCount,
    notJoinedUserCount,
    pendingDeletionCount,
    pendingDeletionMostRecentDeletedAt,
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

/** Update and return all-time peak concurrent users. Same `p_online` source as daily peak. Falls back to onlineNow if RPC fails. */
export async function getOnlinePeakAllTime(onlineNow: number): Promise<number> {
  await ensureSuperAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("update_online_peak_all_time", { p_online: onlineNow });
  if (error) {
    const msg = error.message;
    if (msg.includes("update_online_peak_all_time") && msg.includes("schema cache")) {
      console.warn(
        "[SuperAdmin] All-time peak RPC missing on database. Apply migration `112_online_peak_all_time.sql` (e.g. `supabase link` + `supabase db push`, or paste the file into the Supabase SQL Editor), then wait a few seconds for the API schema cache to refresh."
      );
    } else {
      console.error("[SuperAdmin] update_online_peak_all_time RPC failed:", msg);
    }
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

export type MentoringMilestoneIntegritySignals = {
  typeRatingWithoutOeCompleteCount: number;
  hireDateMissingStandardMilestoneCount: number;
  typeRatingWithoutOeMissingHireDateCount: number;
  hasAny: boolean;
};

/** Platform snapshot for System Status: milestone rows vs hire-date schedule (same rules as backfill diagnostics). */
export async function getMentoringMilestoneIntegritySignals(): Promise<MentoringMilestoneIntegritySignals> {
  await ensureSuperAdmin();
  const admin = createAdminClient();
  const scan = await fetchMentoringMilestoneIntegrityScan(admin);
  if ("error" in scan) {
    console.error("[SuperAdmin] mentoring integrity scan failed:", scan.error);
    return {
      typeRatingWithoutOeCompleteCount: 0,
      hireDateMissingStandardMilestoneCount: 0,
      typeRatingWithoutOeMissingHireDateCount: 0,
      hasAny: false,
    };
  }
  const hasAny =
    scan.typeRatingWithoutOeCompleteAssignmentIds.length > 0 ||
    scan.hireDateMissingAnyStandardMilestoneAssignmentIds.length > 0;
  return {
    typeRatingWithoutOeCompleteCount: scan.typeRatingWithoutOeCompleteAssignmentIds.length,
    hireDateMissingStandardMilestoneCount:
      scan.hireDateMissingAnyStandardMilestoneAssignmentIds.length,
    typeRatingWithoutOeMissingHireDateCount: scan.typeRatingWithoutOeMissingHireDateAssignmentIds.length,
    hasAny,
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

export type FoundingMemberRow = {
  id: string;
  founding_pilot_number: number | null;
  full_name: string | null;
  email: string | null;
  tenant: string;
  role: string;
  founding_pilot_started_at: string | null;
  subscription_tier: string;
};

/** Profiles with permanent Founding Pilot status. Sorted by pilot # ascending (unnumbered last). */
export async function getFoundingMembersForSuperAdmin(): Promise<FoundingMemberRow[]> {
  await ensureSuperAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, founding_pilot_number, full_name, email, tenant, role, founding_pilot_started_at, subscription_tier"
    )
    .eq("is_founding_pilot", true);

  if (error) {
    console.error("[getFoundingMembersForSuperAdmin]", error);
    return [];
  }

  const rows = (data ?? []) as FoundingMemberRow[];
  return [...rows].sort((a, b) => {
    const an = a.founding_pilot_number;
    const bn = b.founding_pilot_number;
    if (an == null && bn == null) return (a.email ?? "").localeCompare(b.email ?? "");
    if (an == null) return 1;
    if (bn == null) return -1;
    if (an !== bn) return an - bn;
    return (a.email ?? "").localeCompare(b.email ?? "");
  });
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
  /** Earliest schedule start in this import batch; null if unknown. */
  earliest_start_time: string | null;
  import_batch_id: string | null;
  user_email: string | null;
  user_full_name: string | null;
};

export type RecentActivityData = {
  recentSignups: RecentSignup[];
  recentImports: RecentImport[];
};

/** All import batches from the latest `schedule_events` window (same query as dashboard), enriched with profiles. Caller must `ensureSuperAdmin` first. */
async function loadAllEnrichedRecentImports(): Promise<RecentImport[]> {
  const userSupabase = await createClient();
  const adminSupabase = createAdminClient();

  try {
    const { data: events } = await adminSupabase
      .from("schedule_events")
      .select("user_id, imported_at, start_time, import_batch_id")
      .order("imported_at", { ascending: false })
      .limit(100);

    const byBatch = new Map<
      string,
      {
        user_id: string;
        imported_at: string;
        count: number;
        earliest_start: string | null;
        import_batch_id: string | null;
      }
    >();
    for (const e of events ?? []) {
      const key = `${e.user_id}-${e.imported_at}`;
      if (!byBatch.has(key)) {
        byBatch.set(key, {
          user_id: e.user_id,
          imported_at: e.imported_at,
          count: 0,
          earliest_start: typeof e.start_time === "string" ? e.start_time : null,
          import_batch_id: typeof e.import_batch_id === "string" ? e.import_batch_id : null,
        });
      }
      const b = byBatch.get(key)!;
      b.count++;
      if (typeof e.start_time === "string") {
        if (
          !b.earliest_start ||
          new Date(e.start_time).getTime() < new Date(b.earliest_start).getTime()
        ) {
          b.earliest_start = e.start_time;
        }
      }
      if (!b.import_batch_id && typeof e.import_batch_id === "string") {
        b.import_batch_id = e.import_batch_id;
      }
    }
    const batchRows = Array.from(byBatch.values()).sort(
      (a, b) => new Date(b.imported_at).getTime() - new Date(a.imported_at).getTime()
    );

    const importUserIds = [...new Set(batchRows.map((r) => r.user_id))];
    const { data: importProfiles } =
      importUserIds.length > 0
        ? await userSupabase
            .from("profiles")
            .select("id, email, full_name")
            .in("id", importUserIds)
        : { data: null };

    const profileById = new Map((importProfiles ?? []).map((p) => [p.id, p]));

    return batchRows.map((r) => {
      const prof = profileById.get(r.user_id);
      return {
        user_id: r.user_id,
        imported_at: r.imported_at,
        count: r.count,
        earliest_start_time: r.earliest_start,
        import_batch_id: r.import_batch_id,
        user_email: prof?.email ?? null,
        user_full_name: prof?.full_name ?? null,
      };
    });
  } catch {
    return [];
  }
}

export async function getRecentActivity(): Promise<RecentActivityData> {
  await ensureSuperAdmin();
  const userSupabase = await createClient();

  const { data: signups } = await userSupabase
    .from("profiles")
    .select("id, email, full_name, tenant, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  const allImports = await loadAllEnrichedRecentImports();

  return {
    recentSignups: (signups ?? []) as RecentSignup[],
    recentImports: allImports.slice(0, 10),
  };
}

/** Import warning heuristics for System Health (recent batches only; same data window as dashboard imports). */
export async function getRecentImportWarningsForSuperAdmin(): Promise<ImportWarningRow[]> {
  await ensureSuperAdmin();
  return buildImportWarningRows(await loadAllEnrichedRecentImports());
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
  mentor_phone: string | null;
  mentor_contact_email: string | null;
  is_admin: boolean;
  is_mentor: boolean;
  /** True when user is mentee_user_id on at least one active mentor_assignments row (computed; no DB column). */
  isMentee: boolean;
  /**
   * Frontier tenant admin roster only: `date_of_hire` within first year (`isWithinFirstYearSinceDateOfHire`).
   * Display semantics only; does not replace assignment-based `isMentee`.
   */
  mentoring_first_year_hire?: boolean;
  /**
   * True when user is an active mentee on an assignment with mentor workspace status Military Leave.
   * Display-only alongside account status (e.g. Not Joined / Active).
   */
  mentoring_military_leave?: boolean;
  /** Set when Frontier tenant loader includes it; used for mentee email privacy until welcome onboarding. */
  welcome_modal_version_seen?: number | null;
  /**
   * From Auth `last_sign_in_at` when listUsers succeeded for the roster load. Omitted if Auth listing failed.
   */
  last_sign_in_at?: string | null;
  deleted_at?: string | null;
  deletion_scheduled_for?: string | null;
};

export async function getAllUsersForSuperAdmin(): Promise<SuperAdminUserRow[]> {
  await ensureSuperAdmin();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, tenant, role, employee_number, phone, is_admin, is_mentor, welcome_modal_version_seen, deleted_at, deletion_scheduled_for"
    )
    .order("created_at", { ascending: false });

  if (error) return [];

  const { data: menteeAssignmentRows } = await admin
    .from("mentor_assignments")
    .select("mentee_user_id")
    .eq("active", true)
    .not("mentee_user_id", "is", null);

  const activeMenteeIds = new Set(
    (menteeAssignmentRows ?? [])
      .map((r) => r.mentee_user_id as string | null)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );

  const militaryLeaveMenteeIds = await getMenteeUserIdsWithMilitaryLeaveWorkspace(admin);

  const authSignInMap = await fetchAuthLastSignInAtByUserId(admin);

  return (data ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name ?? null,
    email: p.email ?? null,
    tenant: p.tenant ?? "unknown",
    role: p.role ?? "pilot",
    employee_number: p.employee_number ?? null,
    phone: p.phone ?? null,
    mentor_phone: null,
    mentor_contact_email: null,
    is_admin: p.is_admin ?? false,
    is_mentor: p.is_mentor ?? false,
    isMentee: activeMenteeIds.has(p.id),
    mentoring_military_leave: militaryLeaveMenteeIds.has(p.id),
    welcome_modal_version_seen:
      (p as { welcome_modal_version_seen?: number | null }).welcome_modal_version_seen ?? null,
    ...(authSignInMap != null ? { last_sign_in_at: authSignInMap.get(p.id) ?? null } : {}),
    deleted_at: p.deleted_at ?? null,
    deletion_scheduled_for: p.deletion_scheduled_for ?? null,
  }));
}

export type UpdateSuperAdminUserAccessInput = {
  role: "pilot" | "flight_attendant";
  is_admin: boolean;
  is_mentor: boolean;
  super_admin?: boolean;
  phone?: string | null;
  mentor_phone?: string | null;
  mentor_contact_email?: string | null;
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
      mentor_phone: data.mentor_phone ?? null,
      mentor_contact_email: data.mentor_contact_email ?? null,
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
    if ("error" in syncResult) return { error: syncResult.error };
  }

  return {};
}

export type UpdateMentorAssignmentHireDateFormState = { error: string | null };

/**
 * Super Admin only: set `mentor_assignments.hire_date` by row id, then recalculate milestone `due_date`
 * values for that assignment via `recalculateSuperAdminMentorshipMilestoneDueDates` (no inserts/deletes,
 * does not change `completed_date`).
 */
export async function updateSuperAdminMentorAssignmentHireDate(
  assignmentId: string,
  hireDateYyyyMmDd: string
): Promise<{ error?: string }> {
  await ensureSuperAdmin();
  const id = assignmentId.trim();
  const raw = hireDateYyyyMmDd.trim();
  if (!id) {
    return { error: "Invalid assignment." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !isValidHireDateYyyyMmDd(raw)) {
    return { error: "Date must be a valid YYYY-MM-DD." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("mentor_assignments").update({ hire_date: raw }).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/super-admin/mentoring");

  const recalc = await recalculateSuperAdminMentorshipMilestoneDueDates(id);
  if (recalc.error) {
    return { error: recalc.error };
  }

  return {};
}

/** Super Admin only: mark one `mentorship_program_requests` row resolved (idempotent for open rows). */
export async function resolveSuperAdminMentorshipProgramRequest(formData: FormData): Promise<void> {
  await ensureSuperAdmin();
  const id = String(formData.get("requestId") ?? "").trim();
  if (!id) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from("mentorship_program_requests")
    .update({ status: "resolved", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "open");

  if (error) {
    return;
  }

  revalidatePath("/super-admin/mentoring");
}

/** `useActionState` adapter for mentoring admin hire date cell. */
export async function updateSuperAdminMentorAssignmentHireDateFormState(
  _prev: UpdateMentorAssignmentHireDateFormState,
  formData: FormData
): Promise<UpdateMentorAssignmentHireDateFormState> {
  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  const hireDate = String(formData.get("hireDate") ?? "").trim();
  const result = await updateSuperAdminMentorAssignmentHireDate(assignmentId, hireDate);
  if (result.error) {
    return { error: result.error };
  }
  return { error: null };
}

/**
 * Super Admin only: sets each existing `mentorship_milestones.due_date` for one assignment from
 * current `mentor_assignments.hire_date`, using `getMilestoneScheduleForHireDate` (same rules as seed).
 * Does not insert/delete rows or change `completed_date`.
 */
export async function recalculateSuperAdminMentorshipMilestoneDueDates(
  assignmentId: string
): Promise<{ error?: string }> {
  await ensureSuperAdmin();
  const id = assignmentId.trim();
  if (!id) {
    return { error: "Invalid assignment." };
  }

  const admin = createAdminClient();
  const result = await syncMentorshipMilestoneDueDatesFromHireForAssignment(admin, id);
  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/super-admin/mentoring");
  return {};
}

export type RefreshAllMentorshipMilestoneDueDatesFromHireResult = {
  assignmentsWithHireDate: number;
  failed: number;
  firstError?: string;
};

/**
 * Super Admin only: for every assignment with a non-null `hire_date`, applies
 * `syncMentorshipMilestoneDueDatesFromHireForAssignment` (updates `due_date` only for milestone
 * types in the current schedule; does not touch completions or notes).
 */
export async function refreshAllSuperAdminMentorshipMilestoneDueDatesFromHire(): Promise<RefreshAllMentorshipMilestoneDueDatesFromHireResult> {
  noStore();
  await ensureSuperAdmin();
  const admin = createAdminClient();

  const { data: assignments, error: fetchErr } = await admin
    .from("mentor_assignments")
    .select("id, hire_date")
    .not("hire_date", "is", null);

  if (fetchErr) {
    return { assignmentsWithHireDate: 0, failed: 0, firstError: fetchErr.message };
  }

  const rows = assignments ?? [];
  let failed = 0;
  let firstError: string | undefined;
  /** TEMP: log one sample schedule per bulk run to verify bundled `getMilestoneScheduleForHireDate` at runtime. */
  let loggedScheduleSample = false;

  for (const row of rows) {
    const id = row.id as string;
    const hireStr = String((row as { hire_date?: string | null }).hire_date ?? "").trim().slice(0, 10);

    if (!loggedScheduleSample && /^\d{4}-\d{2}-\d{2}$/.test(hireStr)) {
      const sched = getMilestoneScheduleForHireDate(hireStr);
      if (sched.ok) {
        const typeRating = sched.entries.find((e) => e.milestone_type === "type_rating");
        const oeComplete = sched.entries.find((e) => e.milestone_type === "oe_complete");
        console.log(
          "[crewrules mentorship refresh] SCHEDULE_MARKER=bundled-getMilestoneScheduleForHireDate-chained-v1",
          JSON.stringify({
            assignmentId: id,
            hireDate: hireStr,
            type_rating_due: typeRating?.due_date,
            oe_complete_due: oeComplete?.due_date,
          })
        );
      } else {
        console.log(
          "[crewrules mentorship refresh] SCHEDULE_MARKER=bundled-getMilestoneScheduleForHireDate-chained-v1",
          "sample schedule error:",
          sched.error,
          "assignmentId:",
          id,
          "hireDate:",
          hireStr
        );
      }
      loggedScheduleSample = true;
    }

    const result = await syncMentorshipMilestoneDueDatesFromHireForAssignment(admin, id);
    if (result.error) {
      failed++;
      if (!firstError) firstError = result.error;
    }
  }

  revalidatePath("/super-admin/mentoring");
  revalidatePath("/frontier/pilots/admin/mentoring");
  revalidatePath("/frontier/pilots/portal/mentoring");
  return { assignmentsWithHireDate: rows.length, failed, firstError };
}

export type BackfillPendingMentorMenteeLinksResult = {
  linked: number;
  error?: string;
};

/**
 * Super Admin only (service role): link pending `mentor_assignments` rows where `mentee_user_id`
 * is null by matching `employee_number` to a non-deleted profile in the **mentor's** tenant.
 * Never overwrites rows that already have `mentee_user_id` set.
 */
export async function backfillPendingMentorMenteeLinks(): Promise<BackfillPendingMentorMenteeLinksResult> {
  await ensureSuperAdmin();
  const admin = createAdminClient();

  const { data: pending, error: fetchErr } = await admin
    .from("mentor_assignments")
    .select("id, mentor_user_id, employee_number")
    .is("mentee_user_id", null);

  if (fetchErr) {
    return { linked: 0, error: fetchErr.message };
  }

  let linked = 0;

  for (const row of pending ?? []) {
    const emp = row.employee_number?.trim();
    if (!emp) continue;

    const { data: mentorProfile, error: mentorErr } = await admin
      .from("profiles")
      .select("tenant")
      .eq("id", row.mentor_user_id)
      .maybeSingle();

    if (mentorErr || !mentorProfile?.tenant) continue;

    const tenant = String(mentorProfile.tenant).trim() || "frontier";

    const { data: mentee, error: menteeErr } = await admin
      .from("profiles")
      .select("id")
      .eq("tenant", tenant)
      .eq("employee_number", emp)
      .is("deleted_at", null)
      .maybeSingle();

    if (menteeErr || !mentee?.id) continue;
    if (mentee.id === row.mentor_user_id) continue;

    const { data: updated, error: updErr } = await admin
      .from("mentor_assignments")
      .update({ mentee_user_id: mentee.id })
      .eq("id", row.id)
      .is("mentee_user_id", null)
      .select("id");

    if (updErr) continue;
    if (updated && updated.length > 0) linked++;
  }

  revalidatePath("/super-admin/mentoring");
  return { linked };
}

export type BackfillMissingMentorshipMilestonesResult = {
  /** Assignments with a non-empty hire_date passed to createMilestonesForAssignment (idempotent inserts only). */
  processedWithHireDate: number;
  seedErrors: string[];
  /** After backfill: assignment IDs that still have type_rating but no oe_complete row. */
  stillMissingOeComplete: string[];
  /** Subset of stillMissingOeComplete: assignment has no hire_date, so schedule seed cannot run. */
  missingHireDateBlockingRepair: string[];
  error?: string;
};

/**
 * Super Admin only: idempotently insert any missing standard milestone rows for assignments
 * that have a hire_date (same helper as CSV import). Does not change completed_date or existing rows.
 * Then report assignments that still have type_rating without oe_complete (unrepairable without hire_date, etc.).
 */
export async function backfillMissingMentorshipMilestones(): Promise<BackfillMissingMentorshipMilestonesResult> {
  await ensureSuperAdmin();
  const admin = createAdminClient();

  const { data: assignments, error: fetchErr } = await admin.from("mentor_assignments").select("id, hire_date");

  if (fetchErr) {
    return {
      processedWithHireDate: 0,
      seedErrors: [],
      stillMissingOeComplete: [],
      missingHireDateBlockingRepair: [],
      error: fetchErr.message,
    };
  }

  const seedErrors: string[] = [];
  let processedWithHireDate = 0;
  const hireDatePresent = new Map<string, boolean>();

  for (const row of assignments ?? []) {
    const id = row.id as string;
    const hireRaw = (row.hire_date as string | null) ?? "";
    const hireTrim = hireRaw.trim();
    hireDatePresent.set(id, hireTrim.length > 0);
    if (!hireTrim) continue;

    processedWithHireDate++;
    const hireDate = hireTrim.slice(0, 10);
    const result = await createMilestonesForAssignment(id, hireDate);
    if (result.error) {
      seedErrors.push(`${id}: ${result.error}`);
    }
  }

  const { data: msRows, error: msErr } = await admin
    .from("mentorship_milestones")
    .select("assignment_id, milestone_type");

  if (msErr) {
    seedErrors.push(`milestone scan: ${msErr.message}`);
    revalidatePath("/super-admin/mentoring");
    revalidatePath("/frontier/pilots/portal/mentoring");
    return { processedWithHireDate, seedErrors, stillMissingOeComplete: [], missingHireDateBlockingRepair: [] };
  }

  const byAid = new Map<string, Set<string>>();
  for (const r of msRows ?? []) {
    const rec = r as { assignment_id: string; milestone_type: string };
    const aid = String(rec.assignment_id);
    const mt = String(rec.milestone_type);
    if (!byAid.has(aid)) byAid.set(aid, new Set());
    byAid.get(aid)!.add(mt);
  }

  const stillMissingOeComplete: string[] = [];
  const missingHireDateBlockingRepair: string[] = [];

  for (const [aid, types] of byAid) {
    if (!types.has("type_rating") || types.has("oe_complete")) continue;
    stillMissingOeComplete.push(aid);
    if (!hireDatePresent.get(aid)) {
      missingHireDateBlockingRepair.push(aid);
    }
  }

  revalidatePath("/super-admin/mentoring");
  revalidatePath("/frontier/pilots/portal/mentoring");
  return { processedWithHireDate, seedErrors, stillMissingOeComplete, missingHireDateBlockingRepair };
}

/**
 * **Internal / destructive:** permanently finalizes a purge-eligible account (single user).
 * Double-gated: `ensureSuperAdmin()` then `finalizePendingAccountDeletion`.
 */
export async function runFinalizePendingAccountDeletionSuperAdmin(
  userId: string
): Promise<FinalizePendingAccountDeletionResult> {
  await ensureSuperAdmin();
  return finalizePendingAccountDeletion(userId);
}

export type PendingDeletionProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  tenant: string;
  portal: string;
  deleted_at: string | null;
  deletion_scheduled_for: string | null;
  deletion_reason: string | null;
};

export type AccountDeletionLogAdminRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  deletion_reason: string | null;
  scheduled_for: string | null;
  started_at: string;
  completed_at: string | null;
  status: string;
  deleted_auth_user: boolean;
  error: string | null;
};

/** Profiles with a scheduled purge date (still have a row). */
export async function getPendingDeletionsForSuperAdmin(): Promise<PendingDeletionProfileRow[]> {
  await ensureSuperAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, email, full_name, tenant, portal, deleted_at, deletion_scheduled_for, deletion_reason"
    )
    .not("deletion_scheduled_for", "is", null)
    .order("deletion_scheduled_for", { ascending: true });

  if (error) {
    console.error("[SuperAdmin] getPendingDeletionsForSuperAdmin:", error.message);
    return [];
  }
  return (data ?? []) as PendingDeletionProfileRow[];
}

/** Recent finalize attempts (audit; includes successes and failures). */
export async function getRecentAccountDeletionLogsForSuperAdmin(
  limit = 75
): Promise<AccountDeletionLogAdminRow[]> {
  await ensureSuperAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("account_deletion_log")
    .select(
      "id, user_id, email, deletion_reason, scheduled_for, started_at, completed_at, status, deleted_auth_user, error"
    )
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[SuperAdmin] getRecentAccountDeletionLogsForSuperAdmin:", error.message);
    return [];
  }
  return (data ?? []) as AccountDeletionLogAdminRow[];
}
