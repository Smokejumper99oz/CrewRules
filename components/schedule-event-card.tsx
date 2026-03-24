import { formatScheduleTime, formatDayLabel, formatDayRangeLabel, computeTripCredit, formatMinutesToHhMm } from "@/lib/schedule-time";
import type { ScheduleEvent, ScheduleEventLeg } from "@/app/frontier/pilots/portal/schedule/actions";
import type { ScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";

/** Prefix flight number for display: carrierCode + number, or FLT + number. Does not change stored data. */
function formatFlightDisplay(flightNumber: string, carrierCode?: string | null): string {
  const num = (flightNumber ?? "").trim();
  if (!num) return "";
  const prefix = carrierCode?.trim() || "FLT";
  return `${prefix}${num}`;
}

function formatLeg(leg: ScheduleEventLeg, carrierCode?: string | null): string {
  const route = `${leg.origin} → ${leg.destination}`;
  const time = leg.depTime && leg.arrTime ? ` ${leg.depTime}–${leg.arrTime}` : "";
  return leg.flightNumber ? `${formatFlightDisplay(leg.flightNumber, carrierCode)} ${route}${time}` : `${route}${time}`;
}

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
  /** When set, show only these legs instead of all event.legs (dashboard next-duty). */
  legsToShow?: ScheduleEventLeg[] | null;
  /** When set with legsToShow, use this date for the date label (e.g. tomorrow). */
  displayDateStr?: string | null;
  /** When set (e.g. 05:15 when out of base = first leg dep - 45 min), use for Report display. */
  reportTimeOverride?: string | null;
};

export function ScheduleEventCard({ event, displaySettings, position, compact, legsToShow, displayDateStr, reportTimeOverride }: Props) {
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
  const effectiveLegs = legsToShow ?? event.legs;
  const hasLegs = event.event_type === "trip" && effectiveLegs && effectiveLegs.length > 0;
  const showRoute = event.event_type === "trip" && (hasLegs || (event.route?.trim() ?? false));

  const showReportCredit = event.event_type === "trip" || event.event_type === "reserve";
  const reportPart =
    reportTimeOverride ??
    event.report_time ??
    (event.event_type === "reserve"
      ? formatScheduleTime(event.start_time, timeOpts)
      : "—");
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
  const departureTime = formatScheduleTime(event.start_time, timeOpts);
  const arrivalTime = formatScheduleTime(event.end_time, timeOpts);
  const dutyRange = `${departureTime}–${arrivalTime}`;
  const timeLine =
    event.event_type === "reserve"
      ? `On Call • ${dutyRange}`
      : `Report ${reportPart} • ${dutyRange}`;

  const borderStyle = EVENT_STYLES[event.event_type] ?? EVENT_STYLES.other;
  const showDateRange = event.event_type === "vacation" || event.event_type === "off";
  const dateLabel = showDateRange
    ? formatDayRangeLabel(event.start_time, event.end_time, displaySettings.baseTimezone)
    : displayDateStr
      ? formatDayLabel(`${displayDateStr}T12:00:00.000Z`, displaySettings.baseTimezone)
      : formatDayLabel(event.start_time, displaySettings.baseTimezone);

  if (compact) {
    return (
      <div className={`flex flex-col gap-0.5 rounded-xl border px-3 py-2 ${borderStyle} bg-white dark:bg-slate-950/40`}>
        <span className="text-xs font-medium text-slate-500">{dateLabel}</span>
        <span className="font-medium text-white">{headerLine}</span>
        {showRoute && <span className="text-xs text-slate-500">{event.route}   {dutyRange}</span>}
        {showReportCredit && (
          <>
            <span className="text-xs text-slate-400">
              {event.event_type === "reserve" ? timeLine : `Report: ${reportPart}`}
            </span>
            <span className="text-xs text-slate-400">Credit {creditDisplay}</span>
          </>
        )}
        {!showReportCredit && <span className="text-xs text-slate-400">{dutyRange}</span>}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-0.5 rounded-xl border px-4 py-3 ${borderStyle} bg-white dark:bg-slate-950/40`}>
      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{dateLabel}</span>
      <span className="text-lg font-medium text-white">{headerLine}</span>
      {showRoute && (
        <div className="text-sm space-y-0.5">
          {hasLegs ? (
            effectiveLegs!.map((l, i) => (
              <div key={i} className="font-medium text-slate-200 whitespace-nowrap">
                {l.flightNumber ? `${formatFlightDisplay(l.flightNumber, displaySettings.carrierCode)} ` : ""}
                {l.origin} → {l.destination}   {l.depTime ?? "—"} – {l.arrTime ?? "—"}
              </div>
            ))
          ) : (
            <span className="text-slate-500 whitespace-nowrap">{event.route}   {dutyRange}</span>
          )}
        </div>
      )}
      {showReportCredit && (
        <span className="text-sm text-slate-400">Report: {reportPart}</span>
      )}
      {showReportCredit && (
        <span className="text-sm text-slate-400">Credit {creditDisplay}</span>
      )}
      {!showReportCredit && <span className="text-sm text-slate-400">{dutyRange}</span>}
    </div>
  );
}
