import Link from "next/link";
import { getNextDuty, getScheduleImportStatus, getScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";
import { getProfile, isProActive } from "@/lib/profile";
import { ScheduleStatusChip } from "@/components/schedule-status-chip";
import { CommuteAssistProContent } from "@/components/commute-assist-pro-content";
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
  const proActive = isProActive(profile);

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

          {/* Commute Assist — layout scaffold with mock data */}
          <div className="mt-3 rounded-2xl border border-white/5 bg-slate-950/30 p-4">
            <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
              <h3 className="text-sm font-semibold text-slate-200">
                Crew<span className="text-[#75C043]">Rules</span><span className="align-super text-[10px]">™</span> Commute Assist<span className="align-super text-[10px]">™</span>
              </h3>
              <span className="text-xs text-slate-500">
                {!profile?.home_airport?.trim() ? "Preview" : proActive ? "Pro" : "Locked"}
              </span>
            </div>
            {!profile?.home_airport?.trim() ? (
              <p className="mt-3 text-sm text-slate-400">
                Set your Home airport in{" "}
                <Link
                  href={`/${tenant}/${portal}/portal/profile`}
                  className="font-medium text-[#75C043] hover:underline"
                >
                  Profile
                </Link>{" "}
                to see commute options.
              </p>
            ) : !proActive ? (
              <div className="mt-3 space-y-2">
                <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                  Commute Assist is a Pro feature
                </span>
                <p className="text-xs text-slate-500">Start a 14-day Pro trial in Profile.</p>
                <Link
                  href={`/${tenant}/${portal}/portal/profile`}
                  className="inline-block text-sm font-medium text-[#75C043] hover:underline"
                >
                  Go to Profile →
                </Link>
              </div>
            ) : (
              <CommuteAssistProContent
                event={event}
                profile={profile!}
                displaySettings={displaySettings}
                tenant={tenant}
                portal={portal}
              />
            )}
          </div>

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
