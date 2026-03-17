import { SuperAdminLiveStatusStrip } from "./super-admin-live-status-strip";

type SuperAdminHeaderProps = {
  lastRefresh: string;
  totalUsers: number;
  usersTodayDelta: number;
  onlineNow: number;
  peakToday: number;
};

export function SuperAdminHeader({ lastRefresh, totalUsers, usersTodayDelta, onlineNow, peakToday }: SuperAdminHeaderProps) {
  return (
    <div className="pb-4 border-b border-slate-700/50">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SuperAdminLiveStatusStrip totalUsers={totalUsers} usersTodayDelta={usersTodayDelta} onlineNow={onlineNow} peakToday={peakToday} />
        <div className="text-xs text-slate-500">
          <span>Last Refresh: {lastRefresh}</span>
        </div>
      </div>
    </div>
  );
}
