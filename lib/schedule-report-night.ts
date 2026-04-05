/**
 * Report-night (RD / evening report, dep after midnight) — pure UI helpers.
 * Does not modify schedule data or leg-date algorithms.
 */

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { ScheduleEvent } from "@/app/frontier/pilots/portal/schedule/actions";
import { addDay, formatScheduleTime, type TimeDisplayOptions } from "@/lib/schedule-time";
import { computeLegDates, getTripDateStrings } from "@/lib/leg-dates";

export const REPORT_NIGHT_TILE_CLASS =
  "bg-amber-500/20 text-amber-300 border border-amber-400/40";

export function isRdPlaceholderEvent(event: ScheduleEvent): boolean {
  return (event.title?.trim().toUpperCase() ?? "") === "RD";
}

/** Weekday + day-of-month in base timezone, no month (e.g. "Sun 5"). */
export function formatReportNightEeeD(dateYyyyMmDd: string, baseTimezone: string): string {
  const instant = fromZonedTime(`${dateYyyyMmDd}T12:00:00`, baseTimezone);
  return formatInTimeZone(instant, baseTimezone, "EEE d");
}

function normalizeLegDepToHhMm(depTime: string | undefined | null): string | null {
  if (!depTime?.trim()) return null;
  const s = depTime.trim().replace(":", "");
  if (!/^\d{3,4}$/.test(s)) return null;
  const padded = s.padStart(4, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

/** report_time as HH:MM / HHMM / HMM, not full ISO. */
function parseWallClockHm(reportTime: string): { hh: number; mm: number } | null {
  const t = reportTime.trim();
  const isoish = new Date(t);
  if (!isNaN(isoish.getTime()) && (t.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(t))) return null;
  const noColon = t.replace(":", "");
  if (/^\d{3,4}$/.test(noColon)) {
    const padded = noColon.padStart(4, "0");
    const hh = parseInt(padded.slice(0, 2), 10);
    const mm = parseInt(padded.slice(2), 10);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return { hh, mm };
  }
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
}

function zonedInstantToDisplay(dateStr: string, hh: number, mm: number, tz: string, timeOpts: TimeDisplayOptions): string {
  const iso = fromZonedTime(
    `${dateStr}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`,
    tz
  ).toISOString();
  return formatScheduleTime(iso, timeOpts);
}

export type TripReportNightMeta = {
  isReportNight: boolean;
  reportLocalDate: string | null;
  /** First leg departure calendar date (yyyy-MM-dd) in base tz; for display only. */
  firstDepartureLocalDate: string | null;
  reportDisplay: string | null;
  firstDepDisplay: string | null;
};

export function getTripReportNightMeta(event: ScheduleEvent, timeOpts: TimeDisplayOptions): TripReportNightMeta {
  const empty: TripReportNightMeta = {
    isReportNight: false,
    reportLocalDate: null,
    firstDepartureLocalDate: null,
    reportDisplay: null,
    firstDepDisplay: null,
  };

  if (event.event_type !== "trip" || !event.report_time?.trim()) return empty;

  const tz = timeOpts.timezone;
  const rtRaw = event.report_time.trim();
  const asIsoDate = new Date(rtRaw);

  let reportLocalDate: string | null = null;
  let reportDisplay: string | null = null;

  if (!isNaN(asIsoDate.getTime()) && (rtRaw.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(rtRaw))) {
    reportLocalDate = formatInTimeZone(asIsoDate, tz, "yyyy-MM-dd");
    reportDisplay = formatScheduleTime(asIsoDate.toISOString(), timeOpts);
  } else {
    const hm = parseWallClockHm(rtRaw);
    if (!hm) return empty;
    reportLocalDate = formatInTimeZone(new Date(event.start_time), tz, "yyyy-MM-dd");
    reportDisplay = zonedInstantToDisplay(reportLocalDate, hm.hh, hm.mm, tz, timeOpts);
  }

  let firstDepartureLocalDate: string | null = null;
  let firstDepDisplay: string | null = null;

  if (event.legs && event.legs.length > 0) {
    const tripDateStrs = getTripDateStrings(event.start_time, event.end_time, tz);
    const legDates = computeLegDates(event.legs, tripDateStrs, tz);
    const first = legDates.find((x) => x.departureDate != null);
    if (first?.departureDate) {
      firstDepartureLocalDate = first.departureDate;
      const legHm = normalizeLegDepToHhMm(first.leg.depTime);
      if (legHm) {
        const [h, m] = legHm.split(":").map((x) => parseInt(x, 10));
        firstDepDisplay = zonedInstantToDisplay(first.departureDate, h, m, tz, timeOpts);
      }
    }
  }

  if (!firstDepartureLocalDate) {
    firstDepartureLocalDate = formatInTimeZone(new Date(event.start_time), tz, "yyyy-MM-dd");
  }
  if (!firstDepDisplay) {
    firstDepDisplay = formatScheduleTime(event.start_time, timeOpts);
  }

  const isReportNight =
    reportLocalDate != null &&
    firstDepartureLocalDate != null &&
    reportLocalDate !== firstDepartureLocalDate;

  if (!isReportNight) return empty;

  return {
    isReportNight: true,
    reportLocalDate,
    firstDepartureLocalDate,
    reportDisplay,
    firstDepDisplay,
  };
}

export type LaterTodayRedEyeCardInfo = {
  /** Report local calendar line (EEEE MMMM d, base TZ) — pairs with card `reportPart` for inline REPORT row. */
  reportDateLong: string;
};

/**
 * Later today big-card warning: late wall-clock report (≥18:00) and first leg departs the *next* calendar day (base TZ).
 * Reuses the same report / first-leg date logic as `getTripReportNightMeta` and schedule tiles — do not key off progressive `displayDateStr`.
 */
export function getLaterTodayRedEyeCardInfo(
  event: ScheduleEvent,
  timeOpts: TimeDisplayOptions
): LaterTodayRedEyeCardInfo | null {
  const meta = getTripReportNightMeta(event, timeOpts);
  if (!meta.isReportNight || !meta.reportLocalDate || !meta.firstDepartureLocalDate) return null;
  if (meta.firstDepartureLocalDate !== addDay(meta.reportLocalDate)) return null;

  const tz = timeOpts.timezone;
  const rtRaw = event.report_time!.trim();
  const asIsoDate = new Date(rtRaw);

  let hour24: number;
  let minute: number;
  if (!isNaN(asIsoDate.getTime()) && (rtRaw.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(rtRaw))) {
    hour24 = parseInt(formatInTimeZone(asIsoDate, tz, "H"), 10);
    minute = parseInt(formatInTimeZone(asIsoDate, tz, "m"), 10);
  } else {
    const hm = parseWallClockHm(rtRaw);
    if (!hm) return null;
    hour24 = hm.hh;
    minute = hm.mm;
  }

  if (Number.isNaN(hour24) || hour24 < 18) return null;

  const reportNoon = fromZonedTime(`${meta.reportLocalDate}T12:00:00`, tz);
  const reportDateLong = formatInTimeZone(reportNoon, tz, "EEEE MMMM d");
  return { reportDateLong };
}
