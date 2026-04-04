import { formatScheduleTime, formatDayLabel, formatDayRangeLabel, computeTripCredit, formatMinutesToHhMm } from "@/lib/schedule-time";
import type { ScheduleEvent, ScheduleEventLeg } from "@/app/frontier/pilots/portal/schedule/actions";
import type { ScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";
import {
  formatReportNightEeeD,
  getTripReportNightMeta,
  isRdPlaceholderEvent,
} from "@/lib/schedule-report-night";

/** Prefix flight number for display: carrierCode + number, or FLT + number. Does not change stored data. */
function formatFlightDisplay(flightNumber: string, carrierCode?: string | null): string {
  const num = (flightNumber ?? "").trim();
  if (!num) return "";
  const prefix = carrierCode?.trim() || "FLT";
  return `${prefix}${num}`;
}

function pairingLengthLabel(pairingDays: number | null | undefined): string | null {
  if (pairingDays == null) return null;
  const n = Math.round(Number(pairingDays));
  if (!Number.isFinite(n) || n < 1) return null;
  if (n === 1) return "TURN";
  if (n === 2) return "2-DAY TRIP";
  if (n === 3) return "3-DAY TRIP";
  return `${n}-DAY TRIP`;
}

const EVENT_STYLES: Record<string, string> = {
  trip: "border-emerald-500/40 text-emerald-200",
  reserve: "border-blue-500/40 text-blue-200",
  vacation: "border-slate-500/40 text-slate-300",
  off: "border-slate-500/40 text-slate-300",
  sick: "border-amber-500/40 text-amber-100",
  training: "border-violet-500/40 text-violet-100",
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
  /** When set, replaces the built header line (e.g. duty-day continuation titles). */
  headerTitleOverride?: string | null;
  /** Compact only: replaces the "Report" prefix before reportPart (e.g. FIRST LEG for continuation days). */
  compactTimeLabelOverride?: string | null;
  /** Next-duty post-release: compact summary instead of full leg list. */
  postDutyRelease?: boolean;
};

export function ScheduleEventCard({
  event,
  displaySettings,
  position,
  compact,
  legsToShow,
  displayDateStr,
  reportTimeOverride,
  headerTitleOverride,
  compactTimeLabelOverride,
  postDutyRelease,
}: Props) {
  if (isRdPlaceholderEvent(event)) return null;

  const timeOpts = {
    timezone: displaySettings.baseTimezone,
    timeFormat: displaySettings.timeFormat,
    showTimezoneLabel: displaySettings.showTimezoneLabel,
    baseAirport: displaySettings.baseAirport,
  };

  const reportNightMeta = getTripReportNightMeta(event, timeOpts);

  const pos = positionLabel(position);
  const rawTitle = event.title?.trim() || "Untitled";
  const displayTitle = event.event_type === "training" ? `${rawTitle} - Recurrent` : rawTitle;
  const titlePart =
    event.event_type === "reserve" ? displayTitle.replace(/^Trip\s+/i, "") : displayTitle;
  const typePrefix =
    event.event_type === "reserve" || event.event_type === "training"
      ? ""
      : `${typeLabel(event.event_type)} `;
  const headerLine = pos ? `${typePrefix}${titlePart} • ${pos}` : `${typePrefix}${titlePart}`;
  const displayHeader = (headerTitleOverride?.trim() ? headerTitleOverride.trim() : null) ?? headerLine;
  const effectiveLegs = legsToShow ?? event.legs;
  const hasLegs = event.event_type === "trip" && effectiveLegs && effectiveLegs.length > 0;
  const firstLeg = effectiveLegs?.[0];
  /** Report-night UI only on the calendar day that is the report night (or whole card when displayDateStr omitted). */
  const reportNightAppliesToThisCard =
    reportNightMeta.isReportNight &&
    reportNightMeta.reportLocalDate != null &&
    (displayDateStr == null || displayDateStr === reportNightMeta.reportLocalDate);
  const isTripReportNightUi =
    event.event_type === "trip" &&
    reportNightAppliesToThisCard &&
    reportNightMeta.firstDepartureLocalDate != null &&
    reportNightMeta.reportDisplay != null;

  const reportNightClass =
    isTripReportNightUi && event.is_muted !== true
      ? "border-amber-400/40 text-amber-200 bg-amber-500/10"
      : null;

  const hasExplicitLegsInput = legsToShow !== undefined;

  const showRoute =
    event.event_type === "trip" &&
    !isTripReportNightUi &&
    (
      hasLegs ||
      (!hasExplicitLegsInput && (event.route?.trim() ?? false))
    );

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

  const borderStyle =
    reportNightClass ?? (EVENT_STYLES[event.event_type] ?? EVENT_STYLES.other);
  const showDateRange = event.event_type === "vacation" || event.event_type === "off";
  const dateLabel = showDateRange
    ? formatDayRangeLabel(event.start_time, event.end_time, displaySettings.baseTimezone)
    : displayDateStr
      ? formatDayLabel(`${displayDateStr}T12:00:00.000Z`, displaySettings.baseTimezone)
      : formatDayLabel(event.start_time, displaySettings.baseTimezone);

  if (postDutyRelease) {
    const lastDestFromLegs = (legs: ScheduleEventLeg[] | null | undefined): string | null => {
      const list = legs ?? [];
      for (let i = list.length - 1; i >= 0; i--) {
        const d = list[i]?.destination?.trim();
        if (d) return d;
      }
      return null;
    };
    const destFromEventLegs = lastDestFromLegs(event.legs);
    const destFromSlice = lastDestFromLegs(legsToShow ?? []);
    const routeFinalAirport = (() => {
      const r = event.route?.trim();
      if (!r) return null;
      const codes = r.toUpperCase().match(/[A-Z]{3}/g);
      if (!codes?.length) return null;
      return codes[codes.length - 1] ?? null;
    })();
    const arrivalAirport = destFromEventLegs || destFromSlice || routeFinalAirport || "—";
    const dutyEndFormatted = formatScheduleTime(event.end_time, timeOpts);
    const releaseBorderStyle = EVENT_STYLES[event.event_type] ?? EVENT_STYLES.other;
    const summaryClass = compact ? "text-xs text-slate-400" : "text-sm text-slate-400";
    if (compact) {
      return (
        <div className={`flex flex-col gap-1 rounded-xl border px-3 py-2 ${releaseBorderStyle} bg-white dark:bg-slate-950/40`}>
          <span className="text-xs font-medium text-slate-500">{dateLabel}</span>
          <span className="font-medium text-white">{displayHeader}</span>
          <span className={summaryClass}>Duty end {dutyEndFormatted}</span>
          <span className={summaryClass}>Trip completed in {arrivalAirport}</span>
        </div>
      );
    }
    return (
      <div className={`flex flex-col gap-1 rounded-xl border px-4 py-3 ${releaseBorderStyle} bg-white dark:bg-slate-950/40`}>
        <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{dateLabel}</span>
        <span className="text-lg font-medium text-white">{displayHeader}</span>
        <span className={summaryClass}>Duty end {dutyEndFormatted}</span>
        <span className={summaryClass}>Trip completed in {arrivalAirport}</span>
      </div>
    );
  }

  const tz = displaySettings.baseTimezone;
  const tripPairingLabel =
    event.event_type === "trip" ? pairingLengthLabel(event.pairing_days) : null;
  const pairingLabelClass = compact ? "text-xs text-slate-500" : "text-sm text-slate-500";

  const reportNightBlock = isTripReportNightUi ? (
    <div className={`flex flex-col gap-0.5 ${compact ? "text-xs" : "text-sm"} text-amber-200/90`}>
      <span>
        <span className="font-semibold">REPORT</span> {reportNightMeta.reportDisplay} •{" "}
        {formatReportNightEeeD(reportNightMeta.reportLocalDate!, tz)}
      </span>
      {firstLeg != null && (
        <span>
          DEPARTURE {firstLeg.origin} {firstLeg.depTime ?? "—"} → {firstLeg.destination} {firstLeg.arrTime ?? "—"} •{" "}
          {formatReportNightEeeD(reportNightMeta.firstDepartureLocalDate!, tz)}
        </span>
      )}
    </div>
  ) : null;

  const hideLegacyReportLine =
    showReportCredit && event.event_type === "trip" && isTripReportNightUi;
  const hideDutyRangeFallback =
    event.event_type === "trip" && isTripReportNightUi;

  if (compact) {
    return (
      <div className={`flex flex-col gap-0.5 rounded-xl border px-3 py-2 ${borderStyle} bg-white dark:bg-slate-950/40`}>
        <span className="text-xs font-medium text-slate-500">{dateLabel}</span>
        <span className="font-medium text-white">{displayHeader}</span>
        {tripPairingLabel != null && !headerTitleOverride?.trim() && (
          <span className={pairingLabelClass}>{tripPairingLabel}</span>
        )}
        {reportNightBlock}
        {showRoute && !headerTitleOverride?.trim() && (
          <span className="text-xs text-slate-500">{event.route}   {dutyRange}</span>
        )}
        {showReportCredit && (
          <>
            {!hideLegacyReportLine && (
              <span className="text-xs text-slate-400">
                {event.event_type === "reserve" ? (
                  timeLine
                ) : compactTimeLabelOverride?.trim() ? (
                  `${compactTimeLabelOverride.trim()}: ${reportPart}`
                ) : (
                  `Report: ${reportPart}`
                )}
              </span>
            )}
            <span className="text-xs text-slate-400">Credit {creditDisplay}</span>
          </>
        )}
        {!showReportCredit && !hideDutyRangeFallback && <span className="text-xs text-slate-400">{dutyRange}</span>}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-0.5 rounded-xl border px-4 py-3 ${borderStyle} bg-white dark:bg-slate-950/40`}>
      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{dateLabel}</span>
      <span className="text-lg font-medium text-white">{displayHeader}</span>
      {tripPairingLabel != null && !headerTitleOverride?.trim() && (
        <span className={pairingLabelClass}>{tripPairingLabel}</span>
      )}
      {reportNightBlock}
      {showRoute && (
        <div className="text-sm space-y-0.5">
          {hasLegs ? (
            effectiveLegs!.map((l, i) => (
              <div key={i} className="font-normal text-slate-300 whitespace-nowrap">
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
        <>
          {!hideLegacyReportLine && <span className="text-sm text-slate-400">Report: {reportPart}</span>}
          <span className="text-sm text-slate-400">Credit {creditDisplay}</span>
        </>
      )}
      {!showReportCredit && !hideDutyRangeFallback && <span className="text-sm text-slate-400">{dutyRange}</span>}
    </div>
  );
}
