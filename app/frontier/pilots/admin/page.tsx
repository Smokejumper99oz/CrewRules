import { createAdminClient } from "@/lib/supabase/admin";
import { getMentoringOverviewStats } from "@/lib/mentoring/admin-overview-stats";
import { getMentorActivityList } from "@/lib/mentoring/mentor-activity";
import { getTenantFeatures } from "@/lib/tenant-features";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const dynamic = "force-dynamic";

const TENANT = "frontier";
const PORTAL = "pilots";

export default async function AdminDashboardPage() {
  const admin = createAdminClient();

  const [overview, mentorActivity, tenantFeatures] = await Promise.all([
    getMentoringOverviewStats(admin, { kind: "tenant", tenant: TENANT, portal: PORTAL }),
    getMentorActivityList(admin, TENANT, PORTAL),
    getTenantFeatures(TENANT, PORTAL),
  ]);

  return (
    <AdminDashboard
      tenant={TENANT}
      portal={PORTAL}
      overview={overview}
      mentorActivity={mentorActivity}
      tenantFeatures={tenantFeatures}
    />
  );
}
