import { createAdminClient } from "@/lib/supabase/admin";
import { getMentoringOverviewStats } from "@/lib/mentoring/admin-overview-stats";
import { loadFrontierAdminFailedMilestoneAttempts } from "@/lib/mentoring/frontier-admin-failed-milestone-attempts";
import { getMentorActivityList } from "@/lib/mentoring/mentor-activity";
import { getTenantFeatures } from "@/lib/tenant-features";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const dynamic = "force-dynamic";

const TENANT = "frontier";
const PORTAL = "pilots";

export default async function AdminDashboardPage() {
  const admin = createAdminClient();

  const scope = { kind: "tenant" as const, tenant: TENANT, portal: PORTAL };
  const [overview, mentorActivity, tenantFeatures, failedMilestoneAttempts] = await Promise.all([
    getMentoringOverviewStats(admin, scope),
    getMentorActivityList(admin, TENANT, PORTAL),
    getTenantFeatures(TENANT, PORTAL),
    loadFrontierAdminFailedMilestoneAttempts(admin, scope),
  ]);

  return (
    <AdminDashboard
      tenant={TENANT}
      portal={PORTAL}
      overview={overview}
      mentorActivity={mentorActivity}
      tenantFeatures={tenantFeatures}
      failedMilestoneAttempts={failedMilestoneAttempts}
    />
  );
}
