import { format } from "date-fns";
import { redirect } from "next/navigation";
import { gateSuperAdmin } from "@/lib/super-admin/gate";
import {
  getSuperAdminKpis,
  getOnlineUserCount,
  getOnlinePeakToday,
  getOnlinePeakAllTime,
  getSystemEvents,
  getTenantOverview,
  getProductUsage,
  getRecentActivity,
  getProTrialMetrics,
  getProTrialUsers,
  getStripeBillingMetrics,
  getStripeSubscriptionCashMetrics,
  getChurnRenewalMetrics,
  getFlightAwareUsageMetrics,
  getAviationStackUsageMetrics,
  getMentoringMilestoneIntegritySignals,
  getSuperAdminWaitlistKpis,
  getSuperAdminNewFeedbackCount,
} from "@/lib/super-admin/actions";
import { SuperAdminHeader } from "@/components/super-admin/super-admin-header";
import { SuperAdminNeedsAttention } from "@/components/super-admin/super-admin-needs-attention";
import { SuperAdminNewFeedbackAlert } from "@/components/super-admin/super-admin-new-feedback-alert";
import { SuperAdminKpiCards } from "@/components/super-admin/super-admin-kpi-cards";
import { SuperAdminTrialMetrics } from "@/components/super-admin/super-admin-trial-metrics";
import { SuperAdminCostMonetization } from "@/components/super-admin/super-admin-cost-monetization";
import { SuperAdminTenantOverview } from "@/components/super-admin/super-admin-tenant-overview";
import { SuperAdminProductUsage } from "@/components/super-admin/super-admin-product-usage";
import { SuperAdminProviders } from "@/components/super-admin/super-admin-providers";
import { SuperAdminRecentActivity } from "@/components/super-admin/super-admin-recent-activity";
import { SuperAdminRefreshTrigger } from "@/components/super-admin/super-admin-refresh-trigger";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMentoringOverviewStats } from "@/lib/mentoring/admin-overview-stats";
import { MentoringOverviewCard } from "@/components/admin/mentoring-overview-card";

export const dynamic = "force-dynamic";

const EVENTS_PAGE_SIZE = 5;

type SuperAdminPageProps = {
  searchParams: Promise<{ eventsPage?: string | string[] }>;
};

export default async function SuperAdminPage({ searchParams }: SuperAdminPageProps) {
  await gateSuperAdmin();

  const sp = await searchParams;
  const raw = sp.eventsPage;
  const first = Array.isArray(raw) ? raw[0] : raw;
  const parsed = first != null && first !== "" ? parseInt(String(first), 10) : NaN;
  const requestedEventsPage = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;

  const [
    kpis,
    onlineNow,
    systemEventsResult,
    mentoringIntegrity,
    tenants,
    productUsage,
    recentActivity,
    trialMetrics,
    trialUsers,
    stripeBilling,
    stripeCash,
    churnRenewal,
    flightAwareMetrics,
    aviationStackMetrics,
    waitlistKpis,
    newFeedbackCount,
  ] = await Promise.all([
    getSuperAdminKpis(),
    getOnlineUserCount(),
    getSystemEvents({ page: requestedEventsPage, pageSize: EVENTS_PAGE_SIZE }),
    getMentoringMilestoneIntegritySignals(),
    getTenantOverview(),
    getProductUsage(),
    getRecentActivity(),
    getProTrialMetrics(),
    getProTrialUsers(),
    getStripeBillingMetrics(),
    getStripeSubscriptionCashMetrics(),
    getChurnRenewalMetrics(),
    getFlightAwareUsageMetrics(),
    getAviationStackUsageMetrics(),
    getSuperAdminWaitlistKpis(),
    getSuperAdminNewFeedbackCount(),
  ]);

  if (systemEventsResult.page !== requestedEventsPage) {
    redirect(`/super-admin?eventsPage=${systemEventsResult.page}`);
  }

  const [peakToday, peakAllTime] = await Promise.all([
    getOnlinePeakToday(onlineNow),
    getOnlinePeakAllTime(onlineNow),
  ]);

  const admin = createAdminClient();
  const mentoringOverview = await getMentoringOverviewStats(admin, { kind: "platform" });

  const lastRefresh = format(new Date(), "MMMM d, yyyy") + " • " + format(new Date(), "HH:mm");
  const totalUsers = kpis.freeCount + kpis.proCount + kpis.enterpriseCount;

  const totalPlatformCostUsd =
    (flightAwareMetrics?.estimatedCost ?? 0) + (aviationStackMetrics?.totalCostUsd ?? 0);

  return (
    <>
      <SuperAdminRefreshTrigger />
      <div className="space-y-12">
        <SuperAdminHeader
          lastRefresh={lastRefresh}
          totalUsers={totalUsers}
          notJoinedUserCount={kpis.notJoinedUserCount}
          usersTodayDelta={kpis.newSignupsToday}
          onlineNow={onlineNow}
          peakToday={peakToday}
          peakAllTime={peakAllTime}
          waitlistKpis={waitlistKpis}
        />

        <SuperAdminNewFeedbackAlert count={newFeedbackCount} />

      <section>
        <SuperAdminNeedsAttention
          events={systemEventsResult.events}
          activeTotal={systemEventsResult.activeTotal}
          eventsPage={systemEventsResult.page}
          pageSize={EVENTS_PAGE_SIZE}
          mentoringIntegrity={mentoringIntegrity}
        />
      </section>

      <section>
        <MentoringOverviewCard
          stats={mentoringOverview}
          manageHref="/super-admin/users"
          subtitle="Platform-wide"
          disableHover
        />
      </section>

      <section>
        <SuperAdminKpiCards kpis={kpis} onlineNow={onlineNow} peakToday={peakToday} peakAllTime={peakAllTime} />
      </section>

      <section>
        <SuperAdminTrialMetrics metrics={trialMetrics} trialUsers={trialUsers} />
      </section>

      <section>
        <SuperAdminCostMonetization
          kpis={kpis}
          trialMetrics={trialMetrics}
          tenants={tenants}
          stripeBilling={stripeBilling}
          stripeCash={stripeCash}
          churnRenewal={churnRenewal}
          flightAwareMetrics={flightAwareMetrics}
          aviationStackMetrics={aviationStackMetrics}
          totalPlatformCostUsd={totalPlatformCostUsd}
        />
      </section>

      <section>
        <SuperAdminTenantOverview tenants={tenants} />
      </section>

      <section>
        <SuperAdminProductUsage data={productUsage} />
      </section>

      <section>
        <SuperAdminProviders />
      </section>

      <section>
        <SuperAdminRecentActivity data={recentActivity} />
      </section>
    </div>
    </>
  );
}
