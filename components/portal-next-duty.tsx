import Link from "next/link";
import { getNextDuty, getScheduleImportStatus, getScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";
import { getProfile } from "@/lib/profile";
import { ScheduleStatusChip } from "@/components/schedule-status-chip";
import { ScheduleEventCard } from "@/components/schedule-event-card";

const DUTY_LABELS: Record<string, string> = {
  on_duty: "On duty",
  later_today: "Later today",
  next_duty: "Next duty",
};

export async function PortalNextDuty({ tenant, portal }: { tenant: string; portal: string }) {
  const [{ event, label, hasSchedule }, statusData, displaySettings, profile] = await Promise.all([
    getNextDuty(),
    getScheduleImportStatus(),
    getScheduleDisplaySettings(),
    getProfile(),
  ]);
  const scheduleHref = `/${tenant}/${portal}/portal/schedule`;
  const heading = label ? DUTY_LABELS[label] : "Next Duty";

  return (
    <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
        <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
        <ScheduleStatusChip status={statusData.status} lastImportedAt={statusData.lastImportedAt} />
      </div>

      {!hasSchedule && (
        <div className="mt-4 space-y-2">
          <p className="text-slate-400">No schedule imported yet.</p>
          <p className="text-xs text-slate-500">
            This uploads a file from your computer — it does not connect CrewRules™ to FLICA.
          </p>
          <Link
            href={scheduleHref}
            className="inline-block text-sm font-medium text-[#75C043] hover:underline"
          >
            View schedule to upload →
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
