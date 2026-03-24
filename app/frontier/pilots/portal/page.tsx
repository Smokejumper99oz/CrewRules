import { getProfile, getDashboardGreeting } from "@/lib/profile";
import { getActiveTrip } from "@/lib/trips/get-active-trip";
import { getTripChangeSummariesForUser } from "@/app/frontier/pilots/portal/schedule/actions";
import { PortalRecentQA } from "@/components/portal-recent-qa";
import { PortalNextDuty } from "@/components/portal-next-duty";
import { PortalScheduleUpcoming } from "@/components/portal-schedule-upcoming";
import { PortalMonthStats } from "@/components/portal-month-stats-wrapper";
import { DashboardAskBox } from "@/components/dashboard-ask-box";

export const dynamic = "force-dynamic";

const TENANT = "frontier";
const PORTAL = "pilots";
const ASK_HREF = `/${TENANT}/${PORTAL}/portal/ask`;

export default async function PortalDashboard() {
  const profile = await getProfile();
  const { greetingPart, namePart } = getDashboardGreeting(profile ?? null);

  const activeTrip = profile?.id ? await getActiveTrip(profile.id) : null;
  const tripChangeSummaries = profile?.id ? await getTripChangeSummariesForUser(profile.id) : [];
  console.log("[CurrentTrip wired]", { loaded: !!profile?.id, hasActiveTrip: !!activeTrip, pairing: activeTrip?.pairing ?? null });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.9375rem] text-slate-500">{greetingPart}</p>
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{namePart}</p>
      </div>

      {/* Next Duty */}
      <PortalNextDuty tenant={TENANT} portal={PORTAL} activeTrip={activeTrip} tripChangeSummaries={tripChangeSummaries} />

      {/* Upcoming + Month Stats (when schedule exists) */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 lg:max-w-[260px] lg:flex-[0.7] xl:max-w-none xl:flex-1">
          <PortalScheduleUpcoming tenant={TENANT} portal={PORTAL} />
        </div>
        <div className="min-w-0 flex-1 lg:flex-[1.3] xl:flex-1">
          <PortalMonthStats tenant={TENANT} portal={PORTAL} profile={profile} />
        </div>
      </div>

      {/* Ask - matches Ask page design */}
      <DashboardAskBox askHref={ASK_HREF} />

      <PortalRecentQA tenant={TENANT} portal={PORTAL} userId={profile?.id ?? null} />
    </div>
  );
}
