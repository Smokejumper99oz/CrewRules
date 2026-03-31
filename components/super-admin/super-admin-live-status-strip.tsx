"use client";

import { Activity, ClipboardList, Plane, Users } from "lucide-react";

// Temporary approximation: treat all online as active until real presence exists
const idleNow = 0;

type SuperAdminLiveStatusStripProps = {
  totalUsers: number;
  /** `welcome_modal_version_seen == null` (same as KPI / mentoring roster not_joined). */
  notJoinedUserCount: number;
  usersTodayDelta: number;
  onlineNow: number;
  peakToday: number;
  peakAllTime: number;
  waitlistTotal?: number;
  waitlistNewToday?: number;
  waitlistAirlines?: number;
  showWaitlistKpi?: boolean;
};

export function SuperAdminLiveStatusStrip({
  totalUsers,
  notJoinedUserCount,
  usersTodayDelta,
  onlineNow,
  peakToday,
  peakAllTime,
  waitlistTotal = 0,
  waitlistNewToday = 0,
  waitlistAirlines = 0,
  showWaitlistKpi = false,
}: SuperAdminLiveStatusStripProps) {
  const usersTodayLabel =
    usersTodayDelta > 0
      ? `+${usersTodayDelta} today`
      : usersTodayDelta === 0
        ? "0 today"
        : `${usersTodayDelta} today`;

  const usersTodayClassName =
    usersTodayDelta > 0
      ? "font-medium text-[#75C043]"
      : usersTodayDelta < 0
        ? "font-medium text-red-400/90"
        : "text-slate-500";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Online chip — elevated, dark green/emerald tint */}
      <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-800/60 bg-emerald-950/50 px-2.5 py-1 text-xs">
        <Activity className="size-4 text-emerald-400 shrink-0" />
        <span className="font-medium text-[#75C043]">{onlineNow} Online</span>
        <span className="text-slate-500">({onlineNow} active, {idleNow} idle)</span>
        <span className="mx-1.5 inline-block h-3 w-px bg-slate-600/60 shrink-0 align-middle" aria-hidden />
        <span className="text-slate-600">
          Peak: {peakToday} · All-time: {peakAllTime}
        </span>
      </div>

      {/* Tenant chip — matches Users pill styling */}
      <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/40 bg-slate-800/40 px-2.5 py-1 text-xs">
        <Plane className="size-4 text-slate-400 shrink-0" />
        <span className="text-slate-200">1 Tenant</span>
      </div>

      {/* Users chip — darker neutral, subtle border (compact sizing like other chips) */}
      <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/40 bg-slate-800/40 px-2.5 py-1 text-xs whitespace-nowrap">
        <Users className="size-4 text-slate-400 shrink-0" />
        <span className="font-medium text-slate-200 tabular-nums">{totalUsers} Users</span>
        <span className="text-slate-600 select-none" aria-hidden>
          ·
        </span>
        <span className={usersTodayClassName}>{usersTodayLabel}</span>
        <span className="text-slate-600 select-none" aria-hidden>
          ·
        </span>
        <span className="inline-flex items-center gap-1">
          <Users
            className={`size-4 shrink-0 ${notJoinedUserCount > 0 ? "text-amber-200" : "text-slate-400"}`}
            aria-hidden
          />
          <span
            className={`tabular-nums ${notJoinedUserCount > 0 ? "font-semibold text-amber-200" : "font-medium text-slate-400"}`}
          >
            {notJoinedUserCount} Not Joined
          </span>
        </span>
      </div>

      {showWaitlistKpi ? (
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/40 bg-slate-800/40 px-2.5 py-1 text-xs whitespace-nowrap">
          <ClipboardList className="size-4 text-slate-400 shrink-0" aria-hidden />
          <span className="text-slate-200 tabular-nums">
            {waitlistTotal} Waitlist · {waitlistNewToday} New Today · {waitlistAirlines} Airlines
          </span>
        </div>
      ) : null}
    </div>
  );
}
