"use client";

import { Activity, Plane, Users } from "lucide-react";

// Temporary approximation: treat all online as active until real presence exists
const idleNow = 0;

type SuperAdminLiveStatusStripProps = {
  totalUsers: number;
  usersTodayDelta: number;
  onlineNow: number;
  peakToday: number;
};

export function SuperAdminLiveStatusStrip({ totalUsers, usersTodayDelta, onlineNow, peakToday }: SuperAdminLiveStatusStripProps) {
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
        <span className="text-slate-600">Peak: {peakToday}</span>
      </div>

      {/* Tenant chip — matches Users pill styling */}
      <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/40 bg-slate-800/40 px-2.5 py-1 text-xs">
        <Plane className="size-4 text-slate-400 shrink-0" />
        <span className="text-slate-200">1 Tenant</span>
      </div>

      {/* Users chip — darker neutral, subtle border */}
      <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/40 bg-slate-800/40 px-2.5 py-1 text-xs">
        <Users className="size-4 text-slate-400 shrink-0" />
        <span className="text-slate-200">{totalUsers} Users</span>
        <span className={usersTodayClassName}>{usersTodayLabel}</span>
      </div>
    </div>
  );
}
