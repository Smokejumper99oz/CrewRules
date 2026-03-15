import { format } from "date-fns";
import { gateSuperAdmin } from "@/lib/super-admin/gate";
import {
  getSuperAdminKpis,
  getTenantOverview,
  getProductUsage,
  getRecentActivity,
  getProTrialMetrics,
  getProTrialUsers,
  getStripeBillingMetrics,
} from "@/lib/super-admin/actions";
import { SuperAdminHeader } from "@/components/super-admin/super-admin-header";
import { SuperAdminAtAGlance } from "@/components/super-admin/super-admin-at-a-glance";
import { SuperAdminNeedsAttention } from "@/components/super-admin/super-admin-needs-attention";
import { SuperAdminKpiCards } from "@/components/super-admin/super-admin-kpi-cards";
import { SuperAdminTrialMetrics } from "@/components/super-admin/super-admin-trial-metrics";
import { SuperAdminCostMonetization } from "@/components/super-admin/super-admin-cost-monetization";
import { SuperAdminTenantOverview } from "@/components/super-admin/super-admin-tenant-overview";
import { SuperAdminProductUsage } from "@/components/super-admin/super-admin-product-usage";
import { SuperAdminProviders } from "@/components/super-admin/super-admin-providers";
import { SuperAdminRecentActivity } from "@/components/super-admin/super-admin-recent-activity";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  await gateSuperAdmin();

  const [kpis, tenants, productUsage, recentActivity, trialMetrics, trialUsers, stripeBilling] =
    await Promise.all([
      getSuperAdminKpis(),
      getTenantOverview(),
      getProductUsage(),
      getRecentActivity(),
      getProTrialMetrics(),
      getProTrialUsers(),
      getStripeBillingMetrics(),
    ]);

  const lastRefresh = format(new Date(), "PPpp");

  return (
    <div className="space-y-12">
      <SuperAdminHeader lastRefresh={lastRefresh} />

      <section className="space-y-2">
        <SuperAdminAtAGlance kpis={kpis} />
      </section>

      <section>
        <SuperAdminNeedsAttention />
      </section>

      <section>
        <SuperAdminKpiCards kpis={kpis} />
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
  );
}
