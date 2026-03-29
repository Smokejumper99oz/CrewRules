import type { SuperAdminKpiData } from "@/lib/super-admin/actions";
import Link from "next/link";
import { CalendarClock, CreditCard, Plane, UserPlus, Users, Briefcase } from "lucide-react";
import { SuperAdminLiveStatusStrip } from "./super-admin-live-status-strip";

type SuperAdminKpiCardsProps = {
  kpis: SuperAdminKpiData;
  onlineNow: number;
  peakToday: number;
  peakAllTime: number;
};

const cardBase =
  "rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 transition-all duration-200";

/** Subtle danger treatment when `pendingDeletionCount > 0` (link target unchanged). */
const pendingDeletionTileDangerClass = `${cardBase} block border-red-900/35 bg-red-950/15 hover:border-red-800/45 hover:bg-red-950/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/25`;

/** Neutral KPI link tile when there are no pending deletions (matches standard card hover/focus). */
const pendingDeletionTileNeutralClass = `${cardBase} block hover:border-slate-600/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75C043]/35`;

function formatPendingDeletionSubtext(
  count: number,
  deletedAtIso: string | null
): string {
  if (count === 0) return "No pending requests";
  if (!deletedAtIso) return "Most recent: —";
  const d = new Date(deletedAtIso);
  if (Number.isNaN(d.getTime())) return "Most recent: —";
  const formatted = d.toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
  return `Most recent: ${formatted}`;
}

export function SuperAdminKpiCards({ kpis, onlineNow, peakToday, peakAllTime }: SuperAdminKpiCardsProps) {
  const totalUsers = kpis.freeCount + kpis.proCount + kpis.enterpriseCount;
  const pendingDeletionHighlight = kpis.pendingDeletionCount > 0;

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
        <Briefcase className="size-4 text-slate-400 shrink-0" />
        Business
      </h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className={cardBase}>
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Plane className="size-4 text-slate-400 shrink-0" />
            Tenants
          </div>
          <div className="text-2xl font-semibold text-slate-200">{kpis.tenantCount}</div>
        </div>
        <div className={cardBase}>
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Users className="size-4 text-slate-400 shrink-0" />
            Total Users
          </div>
          <div className="text-2xl font-semibold text-slate-200">{totalUsers}</div>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500 tabular-nums">
            Joined {kpis.joinedUserCount} · Not Joined {kpis.notJoinedUserCount}
          </p>
        </div>
        <div className={`${cardBase} border-[#75C043]/30`}>
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <UserPlus className="size-3.5" />
            Sign-Ups Last 30 days
          </div>
          <div className="text-2xl font-semibold text-slate-200">{kpis.newSignups30d}</div>
        </div>
        <div className={`${cardBase} border-amber-600/30`}>
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <CreditCard className="size-3.5" />
            Pro
          </div>
          <div className="text-2xl font-semibold text-amber-400">{kpis.proCount}</div>
        </div>
        <div className={`${cardBase} border-[#75C043]/30`}>
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <CreditCard className="size-3.5" />
            Enterprise
          </div>
          <div className="text-2xl font-semibold text-[#75C043]">{kpis.enterpriseCount}</div>
        </div>
        <Link
          href="/super-admin/pending-deletions"
          className={pendingDeletionHighlight ? pendingDeletionTileDangerClass : pendingDeletionTileNeutralClass}
          aria-label="View pending account deletions and finalize log"
        >
          <div
            className={`flex items-center gap-2 text-xs mb-1 ${pendingDeletionHighlight ? "text-rose-200/85" : "text-slate-400"}`}
          >
            <CalendarClock
              className={`size-4 shrink-0 ${pendingDeletionHighlight ? "text-rose-400/75" : "text-slate-400"}`}
            />
            Pending Deletions
          </div>
          <div
            className={`text-2xl font-semibold tabular-nums ${pendingDeletionHighlight ? "text-rose-50" : "text-slate-200"}`}
          >
            {kpis.pendingDeletionCount}
          </div>
          <p
            className={`mt-1.5 text-[11px] leading-snug ${pendingDeletionHighlight ? "text-rose-200/65" : "text-slate-500"}`}
          >
            {formatPendingDeletionSubtext(
              kpis.pendingDeletionCount,
              kpis.pendingDeletionMostRecentDeletedAt
            )}
          </p>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-500">Secondary:</span>
          <span className="rounded-md bg-slate-800/50 px-2 py-0.5 text-xs text-slate-400">
            {kpis.newSignupsToday} today
          </span>
          <span className="rounded-md bg-slate-800/50 px-2 py-0.5 text-xs text-slate-400">
            {kpis.newSignups7d} in 7d
          </span>
          <span className="rounded-md bg-slate-800/50 px-2 py-0.5 text-xs text-slate-400">
            {kpis.freeCount} Free
          </span>
        </div>
        <div className="h-px flex-1 min-w-[80px] bg-slate-700/50" />
        <SuperAdminLiveStatusStrip
          totalUsers={totalUsers}
          notJoinedUserCount={kpis.notJoinedUserCount}
          usersTodayDelta={kpis.newSignupsToday}
          onlineNow={onlineNow}
          peakToday={peakToday}
          peakAllTime={peakAllTime}
        />
      </div>
    </div>
  );
}
