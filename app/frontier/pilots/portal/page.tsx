import { getProfile, getDashboardGreeting } from "@/lib/profile";
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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[0.9375rem] text-slate-500">{greetingPart}</p>
        <p className="text-lg font-semibold text-slate-100">{namePart}</p>
      </div>

      {/* Next Duty */}
      <PortalNextDuty tenant={TENANT} portal={PORTAL} />

      {/* Upcoming + Month Stats (when schedule exists) */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex-1 min-w-0">
          <PortalScheduleUpcoming tenant={TENANT} portal={PORTAL} />
        </div>
        <div className="flex-1 min-w-0">
          <PortalMonthStats tenant={TENANT} portal={PORTAL} />
        </div>
      </div>

      {/* Ask - matches Ask page design */}
      <DashboardAskBox askHref={ASK_HREF} />

      <PortalRecentQA tenant={TENANT} portal={PORTAL} userId={profile?.id ?? null} />
    </div>
  );
}
