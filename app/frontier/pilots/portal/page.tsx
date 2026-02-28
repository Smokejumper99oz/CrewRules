import { getProfile, getDisplayName } from "@/lib/profile";
import { PortalRecentQA } from "@/components/portal-recent-qa";
import { PortalNextDuty } from "@/components/portal-next-duty";
import { PortalScheduleUpcoming } from "@/components/portal-schedule-upcoming";
import { PortalMonthStats } from "@/components/portal-month-stats-wrapper";
import { DashboardAskBox } from "@/components/dashboard-ask-box";

const TENANT = "frontier";
const PORTAL = "pilots";
const ASK_HREF = `/${TENANT}/${PORTAL}/portal/ask`;

export default async function PortalDashboard() {
  const profile = await getProfile();
  const displayName = getDisplayName(profile ?? null);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        Welcome back, <span className="font-medium text-slate-200">{displayName}</span>
      </p>

      {/* Next Duty */}
      <PortalNextDuty tenant={TENANT} portal={PORTAL} />

      {/* Upcoming + Month Stats (when schedule exists) */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-stretch">
        <div className="flex-1 min-w-0">
          <PortalScheduleUpcoming tenant={TENANT} portal={PORTAL} />
        </div>
        <div className="flex-1 min-w-0">
          <PortalMonthStats tenant={TENANT} portal={PORTAL} />
        </div>
      </div>

      {/* Ask - matches Ask page design */}
      <DashboardAskBox askHref={ASK_HREF} />

      <PortalRecentQA tenant={TENANT} portal={PORTAL} />

      {/* Saved (3 items) */}
      <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20">
        <h2 className="text-xl font-semibold tracking-tight border-b border-white/5">Saved</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          {["Bookmark…", "Note…", "Item…"].map((item, i) => (
            <li key={i} className="rounded-lg px-3 py-2 hover:bg-white/5">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
