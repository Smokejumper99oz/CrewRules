import { createAdminClient } from "@/lib/supabase/admin";
import { getMentoringOverviewStats } from "@/lib/mentoring/admin-overview-stats";
import { MentoringOverviewCard } from "@/components/admin/mentoring-overview-card";

const TENANT = "frontier";
const PORTAL = "pilots";

export default async function AdminDashboard() {
  const admin = createAdminClient();
  const mentoringOverview = await getMentoringOverviewStats(admin, {
    kind: "tenant",
    tenant: TENANT,
    portal: PORTAL,
  });

  return (
    <div className="space-y-6">
      <MentoringOverviewCard
        stats={mentoringOverview}
        manageHref={`/${TENANT}/${PORTAL}/admin/mentoring`}
        subtitle="Frontier Airlines • Pilots"
        manageCta="People →"
        disableHover
      />
    </div>
  );
}
