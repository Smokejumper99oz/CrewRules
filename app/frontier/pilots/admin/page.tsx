import { createAdminClient } from "@/lib/supabase/admin";
import { getMentoringOverviewStats } from "@/lib/mentoring/admin-overview-stats";
import { buildFrontierClassOverviewFromRoster } from "@/lib/mentoring/frontier-admin-class-overview";
import { loadFrontierAdminFailedMilestoneAttempts } from "@/lib/mentoring/frontier-admin-failed-milestone-attempts";
import { loadFrontierPilotMenteeRosterPageData } from "@/lib/mentoring/frontier-mentee-roster-load";
import { getMentorActivityList } from "@/lib/mentoring/mentor-activity";
import { getTenantFeatures } from "@/lib/tenant-features";
import { getMentorEmailAcknowledgementStats } from "@/lib/mentoring/mentor-email-acknowledgement-stats";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const dynamic = "force-dynamic";

const TENANT = "frontier";
const PORTAL = "pilots";

export default async function AdminDashboardPage() {
  const admin = createAdminClient();

  const scope = { kind: "tenant" as const, tenant: TENANT, portal: PORTAL };
  const rosterPromise = loadFrontierPilotMenteeRosterPageData({
    collectDohAudit: false,
    emitDohAuditToConsole: false,
  });

  const [rosterPack, overview, mentorActivity, tenantFeatures, failedMilestoneAttempts, emailAcknowledgementStats] =
    await Promise.all([
      rosterPromise,
      getMentoringOverviewStats(admin, scope, { frontierMenteeRosterPreloadPromise: rosterPromise }),
      getMentorActivityList(admin, TENANT, PORTAL),
      getTenantFeatures(TENANT, PORTAL),
      loadFrontierAdminFailedMilestoneAttempts(admin, scope),
      getMentorEmailAcknowledgementStats(),
    ]);

  const classOverview = buildFrontierClassOverviewFromRoster(rosterPack.roster);

  return (
    <AdminDashboard
      tenant={TENANT}
      portal={PORTAL}
      overview={overview}
      mentorActivity={mentorActivity}
      tenantFeatures={tenantFeatures}
      failedMilestoneAttempts={failedMilestoneAttempts}
      classOverview={classOverview}
      programProgress={rosterPack.programProgress}
      emailAcknowledgementStats={emailAcknowledgementStats}
    />
  );
}
