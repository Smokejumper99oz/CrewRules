import type { SuperAdminWaitlistKpiData } from "@/lib/super-admin/actions";
import { SuperAdminLiveStatusStrip } from "./super-admin-live-status-strip";

type SuperAdminHeaderProps = {
  lastRefresh: string;
  totalUsers: number;
  notJoinedUserCount: number;
  usersTodayDelta: number;
  onlineNow: number;
  peakToday: number;
  peakAllTime: number;
  waitlistKpis: SuperAdminWaitlistKpiData;
};

export function SuperAdminHeader({
  lastRefresh,
  totalUsers,
  notJoinedUserCount,
  usersTodayDelta,
  onlineNow,
  peakToday,
  peakAllTime,
  waitlistKpis,
}: SuperAdminHeaderProps) {
  return (
    <div className="pb-4 border-b border-slate-700/50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SuperAdminLiveStatusStrip
          totalUsers={totalUsers}
          notJoinedUserCount={notJoinedUserCount}
          usersTodayDelta={usersTodayDelta}
          onlineNow={onlineNow}
          peakToday={peakToday}
          peakAllTime={peakAllTime}
          waitlistTotal={waitlistKpis.total}
          waitlistNewToday={waitlistKpis.newToday}
          waitlistAirlines={waitlistKpis.airlines}
          showWaitlistKpi
        />
        <div className="text-xs text-slate-500">
          <span>Last Refresh: {lastRefresh}</span>
        </div>
      </div>
    </div>
  );
}
