import { formatScheduleTime, formatDayLabel, computeTripCredit, formatMinutesToHhMm } from "@/lib/schedule-time";
import type { ScheduleEvent } from "@/app/frontier/pilots/portal/schedule/actions";
import type { ScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";

const EVENT_STYLES: Record<string, string> = {
  trip: "border-emerald-500/40 text-emerald-200",
  reserve: "border-blue-500/40 text-blue-200",
  vacation: "border-slate-500/40 text-slate-300",
  off: "border-slate-500/40 text-slate-300",
  other: "border-slate-500/40 text-slate-300",
};

function typeLabel(type: string): string {
  if (type === "vacation" || type === "off") return "Vacation";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function positionLabel(position: "captain" | "first_officer" | "flight_attendant" | null | undefined): string {
  if (position === "captain") return "CA";
  if (position === "first_officer") return "FO";
  return "";
}

type Props = {
  event: ScheduleEvent;
  displaySettings: ScheduleDisplaySettings;
  position?: "captain" | "first_officer" | "flight_attendant" | null;
  compact?: boolean;
};

export function ScheduleEventCard({ event, displaySettings, position, compact }: Props) {
  const timeOpts = {
    timezone: displaySettings.baseTimezone,
    timeFormat: displaySettings.timeFormat,
    showTimezoneLabel: displaySettings.showTimezoneLabel,
    baseAirport: displaySettings.baseAirport,
  };

  const pos = positionLabel(position);
  const rawTitle = event.title?.trim() || "Untitled";
  const titlePart = event.event_type === "reserve" ? rawTitle.replace(/^Trip\s+/i, "") : rawTitle;
  const typePrefix = event.event_type === "reserve" ? "" : `${typeLabel(event.event_type)} `;
  const headerLine = pos ? `${typePrefix}${titlePart} • ${pos}` : `${typePrefix}${titlePart}`;
  const showRoute = event.event_type === "trip" && event.route?.trim();

  const showReportCredit = event.event_type === "trip" || event.event_type === "reserve";
  const reportPart = event.report_time ?? "—";
  const tripCredit =
    event.event_type === "trip" && (event.pairing_days != null || event.block_minutes != null)
      ? computeTripCredit(event.pairing_days, event.block_minutes)
      : null;
  const creditMinutes =
    event.event_type === "trip"
      ? event.credit_minutes ?? (tripCredit ? tripCredit.creditMinutes : null)
      : event.credit_minutes ?? (event.credit_hours != null ? Math.round(event.credit_hours * 60) : null);
  const creditDisplay =
    creditMinutes != null && creditMinutes > 0
      ? formatMinutesToHhMm(creditMinutes)
      : "—";
  const dutyRange = `${formatScheduleTime(event.start_time, timeOpts)}–${formatScheduleTime(event.end_time, timeOpts)}`;
  const timeLine =
    event.event_type === "reserve"
      ? `On Call • ${dutyRange}`
      : `Report ${reportPart} • ${dutyRange}`;

  const borderStyle = EVENT_STYLES[event.event_type] ?? EVENT_STYLES.other;

  if (compact) {
    return (
      <div className={`flex flex-col gap-0.5 rounded-xl border px-3 py-2 ${borderStyle} bg-slate-950/40`}>
        <span className="text-xs font-medium text-slate-500">{formatDayLabel(event.start_time, displaySettings.baseTimezone)}</span>
        <span className="font-medium text-white">{headerLine}</span>
        {showRoute && <span className="text-xs text-slate-500">{event.route}</span>}
        {showReportCredit && (
          <>
            <span className="text-xs text-slate-400">{timeLine}</span>
            <span className="text-xs text-slate-400">Credit {creditDisplay}</span>
          </>
        )}
        {!showReportCredit && <span className="text-xs text-slate-400">{dutyRange}</span>}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-0.5 rounded-xl border px-4 py-3 ${borderStyle} bg-slate-950/40`}>
      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{formatDayLabel(event.start_time, displaySettings.baseTimezone)}</span>
      <span className="text-lg font-medium text-white">{headerLine}</span>
      {showRoute && <span className="text-sm text-slate-500">{event.route}</span>}
      {showReportCredit && (
        <>
          <span className="text-sm text-slate-400">{timeLine}</span>
          <span className="text-sm text-slate-400">Credit {creditDisplay}</span>
        </>
      )}
      {!showReportCredit && <span className="text-sm text-slate-400">{dutyRange}</span>}
    </div>
  );
}
