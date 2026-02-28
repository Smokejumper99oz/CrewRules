import Link from "next/link";
import { getNextDuty, getScheduleImportStatus, getScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";
import { getProfile } from "@/lib/profile";
import { ScheduleStatusChip } from "@/components/schedule-status-chip";
import { ScheduleEventCard } from "@/components/schedule-event-card";
import { OnDutyTimer } from "@/components/on-duty-timer";

const DUTY_LABELS: Record<string, string> = {
  on_duty: "On Duty",
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
  const isOnDuty = label === "on_duty";

  return (
    <div
      className={`rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 p-6 transition-all duration-200 hover:-translate-y-0.5 ${
        isOnDuty
          ? "border-l-2 border-l-emerald-500 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_0_24px_rgba(16,185,129,0.08)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_0_28px_rgba(16,185,129,0.1),0_10px_30px_rgba(0,0,0,0.4)]"
          : "shadow-[0_0_0_1px_rgba(255,255,255,0.03)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
        {isOnDuty ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-950/80 px-4 py-2 text-base font-bold text-emerald-200">
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
              aria-hidden
            />
            {heading}
          </span>
        ) : (
          <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
        )}
        <ScheduleStatusChip status={statusData.status} lastImportedAt={statusData.lastImportedAt} />
      </div>

      {!hasSchedule && (
        <div className="mt-4 space-y-2">
          <p className="text-slate-400">No schedule imported yet.</p>
          <p className="text-xs text-slate-500">
            This uploads a file from your computer — it does not connect CrewRules™ to FLICA.
          </p>
          <div className="flex justify-end">
            <Link
              href={scheduleHref}
              className="text-sm font-medium text-[#75C043] hover:underline"
            >
              View schedule to upload →
            </Link>
          </div>
        </div>
      )}

      {hasSchedule && event && (
        <div className="mt-4 space-y-2">
          <ScheduleEventCard event={event} displaySettings={displaySettings} position={profile?.position ?? null} compact={false} />
          {isOnDuty && (
            <OnDutyTimer startTime={event.start_time} endTime={event.end_time} timezone={displaySettings.baseTimezone} />
          )}
          <div className="flex justify-end">
            <Link
              href={scheduleHref}
              className="mt-3 text-sm font-medium text-[#75C043] hover:underline"
            >
              View full schedule →
            </Link>
          </div>
        </div>
      )}

      {hasSchedule && !event && (
        <div className="mt-4 space-y-2">
          <p className="text-slate-400">No upcoming duties.</p>
          <div className="flex justify-end">
            <Link
              href={scheduleHref}
              className="text-sm font-medium text-[#75C043] hover:underline"
            >
              View full schedule →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
