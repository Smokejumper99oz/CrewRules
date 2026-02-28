import { formatScheduleTime, formatDayLabel, formatCreditHours } from "@/lib/schedule-time";
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

  const showReportCredit = event.event_type === "trip" || event.event_type === "reserve";
  const reportPart = event.report_time ?? "—";
  const creditPart = event.credit_hours != null && event.credit_hours > 0 ? formatCreditHours(event.credit_hours) : "—";
  const reportCreditLine = `Report ${reportPart} • ${creditPart} Credit`;
  const dutyRange = `${formatScheduleTime(event.start_time, timeOpts)}–${formatScheduleTime(event.end_time, timeOpts)}`;

  const borderStyle = EVENT_STYLES[event.event_type] ?? EVENT_STYLES.other;

  if (compact) {
    return (
      <div className={`flex flex-col gap-0.5 rounded-xl border px-3 py-2 ${borderStyle} bg-slate-950/40`}>
        <span className="text-xs font-medium text-slate-500">{formatDayLabel(event.start_time, displaySettings.baseTimezone)}</span>
        <span className="font-medium text-white">{headerLine}</span>
        {showReportCredit && (
          <span className="text-xs text-slate-400">{reportCreditLine}</span>
        )}
        <span className="text-xs text-slate-400">{dutyRange}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-0.5 rounded-xl border px-4 py-3 ${borderStyle} bg-slate-950/40`}>
      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{formatDayLabel(event.start_time, displaySettings.baseTimezone)}</span>
      <span className="text-lg font-medium text-white">{headerLine}</span>
      {showReportCredit && (
        <span className="text-sm text-slate-400">{reportCreditLine}</span>
      )}
      <span className="text-sm text-slate-400">{dutyRange}</span>
    </div>
  );
}
