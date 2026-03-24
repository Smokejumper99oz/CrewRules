import { format } from "date-fns";
import { gateSuperAdmin } from "@/lib/super-admin/gate";
import {
  getSuperAdminKpis,
  getOnlineUserCount,
  getOnlinePeakToday,
  getSystemEvents,
  getTenantOverview,
  getProductUsage,
  getRecentActivity,
  getProTrialMetrics,
  getProTrialUsers,
  getStripeBillingMetrics,
  getChurnRenewalMetrics,
  getFlightAwareUsageMetrics,
  getAviationStackUsageMetrics,
} from "@/lib/super-admin/actions";
import { SuperAdminHeader } from "@/components/super-admin/super-admin-header";
import { SuperAdminNeedsAttention } from "@/components/super-admin/super-admin-needs-attention";
import { SuperAdminKpiCards } from "@/components/super-admin/super-admin-kpi-cards";
import { SuperAdminTrialMetrics } from "@/components/super-admin/super-admin-trial-metrics";
import { SuperAdminCostMonetization } from "@/components/super-admin/super-admin-cost-monetization";
import { SuperAdminTenantOverview } from "@/components/super-admin/super-admin-tenant-overview";
import { SuperAdminProductUsage } from "@/components/super-admin/super-admin-product-usage";
import { SuperAdminProviders } from "@/components/super-admin/super-admin-providers";
import { SuperAdminRecentActivity } from "@/components/super-admin/super-admin-recent-activity";
import { SuperAdminRefreshTrigger } from "@/components/super-admin/super-admin-refresh-trigger";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  await gateSuperAdmin();

  const [kpis, onlineNow, systemEventsResult, tenants, productUsage, recentActivity, trialMetrics, trialUsers, stripeBilling, churnRenewal, flightAwareMetrics, aviationStackMetrics] =
    await Promise.all([
      getSuperAdminKpis(),
      getOnlineUserCount(),
      getSystemEvents(),
      getTenantOverview(),
      getProductUsage(),
      getRecentActivity(),
      getProTrialMetrics(),
      getProTrialUsers(),
      getStripeBillingMetrics(),
      getChurnRenewalMetrics(),
      getFlightAwareUsageMetrics(),
      getAviationStackUsageMetrics(),
    ]);

  const peakToday = await getOnlinePeakToday(onlineNow);

  const lastRefresh = format(new Date(), "MMMM d, yyyy") + " • " + format(new Date(), "HH:mm");
  const totalUsers = kpis.freeCount + kpis.proCount + kpis.enterpriseCount;

  const totalPlatformCostUsd =
    (flightAwareMetrics?.estimatedCost ?? 0) + (aviationStackMetrics?.totalCostUsd ?? 0);

  return (
    <>
      <SuperAdminRefreshTrigger />
      <div className="space-y-12">
        <SuperAdminHeader lastRefresh={lastRefresh} totalUsers={totalUsers} usersTodayDelta={kpis.newSignupsToday} onlineNow={onlineNow} peakToday={peakToday} />

      <section>
        <SuperAdminNeedsAttention events={systemEventsResult.events} dismissedCount={systemEventsResult.dismissedCount} />
      </section>

      <section>
        <SuperAdminKpiCards kpis={kpis} onlineNow={onlineNow} peakToday={peakToday} />
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
