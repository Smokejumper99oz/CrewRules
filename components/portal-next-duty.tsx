import Link from "next/link";
import { getNextDuty, getScheduleImportStatus, getScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";
import { getProfile } from "@/lib/profile";
import { ScheduleStatusChip } from "@/components/schedule-status-chip";
import { ScheduleEventCard } from "@/components/schedule-event-card";

export async function PortalNextDuty({ tenant, portal }: { tenant: string; portal: string }) {
  const [{ event, hasSchedule }, statusData, displaySettings, profile] = await Promise.all([
    getNextDuty(),
    getScheduleImportStatus(),
    getScheduleDisplaySettings(),
    getProfile(),
  ]);
  const scheduleHref = `/${tenant}/${portal}/portal/schedule`;

  return (
    <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
        <h2 className="text-xl font-semibold tracking-tight">Next Duty</h2>
        <ScheduleStatusChip status={statusData.status} lastImportedAt={statusData.lastImportedAt} />
      </div>

      {!hasSchedule && (
        <div className="mt-4 space-y-3">
          <p className="text-slate-400">No schedule imported yet.</p>
          <Link
            href={scheduleHref}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#75C043] px-5 py-3 font-semibold text-slate-950 hover:opacity-95 transition"
          >
            Upload FLICA Schedule (.ICS)
          </Link>
        </div>
      )}

      {hasSchedule && event && (
        <div className="mt-4 space-y-2">
          <ScheduleEventCard event={event} displaySettings={displaySettings} position={profile?.position ?? null} compact={false} />
          <Link
            href={scheduleHref}
            className="mt-3 inline-block text-sm font-medium text-[#75C043] hover:underline"
          >
            View full schedule →
          </Link>
        </div>
      )}

      {hasSchedule && !event && (
        <div className="mt-4 space-y-2">
          <p className="text-slate-400">No upcoming duties.</p>
          <Link
            href={scheduleHref}
            className="inline-block text-sm font-medium text-[#75C043] hover:underline"
          >
            View full schedule →
          </Link>
        </div>
      )}
    </div>
  );
}
