"use client";

import { useState, useEffect, useRef } from "react";
import {
  importIcsFile,
  clearScheduleImport,
  getScheduleImportStatus,
  getScheduleEvents,
  getScheduleDisplaySettings,
  getIsAdmin,
  getScheduleImportEmail,
  type ScheduleEvent,
  type ScheduleDisplaySettings,
} from "./actions";
import { InboundEmailDisplay } from "@/components/inbound-email-display";
import { FlicaIcsHelperModal } from "@/components/flica-ics-helper-modal";
import { formatLegLine } from "@/lib/trips/detect-trip-changes";
import type { TripChangeSummary } from "@/lib/trips/detect-trip-changes";
import { formatMinutesToHhMm } from "@/lib/schedule-time";
import { ScheduleStatusChip, formatLastImport } from "@/components/schedule-status-chip";
import { formatScheduleTime, formatDayLabel, formatDayRangeLabel, eventOverlapsDay, addDay, isEventOnDay } from "@/lib/schedule-time";
import { getBidPeriodForTimestamp, getAllBidPeriodsForYear, getFrontierBidPeriodTimezone } from "@/lib/frontier-bid-periods";
import { computeLegDates, getTripDateStrings } from "@/lib/leg-dates";
import {
  formatReportNightEeeD,
  getTripReportNightMeta,
  isRdPlaceholderEvent,
  REPORT_NIGHT_TILE_CLASS,
} from "@/lib/schedule-report-night";

const EVENT_STYLES: Record<string, string> = {
  trip: "bg-emerald-500/20 border-emerald-500/40 text-emerald-200",
  pay: "bg-emerald-500/20 border-emerald-500/40 text-emerald-200",
  reserve: "bg-blue-500/20 border-blue-500/40 text-blue-200",
  vacation: "bg-slate-500/20 border-slate-500/40 text-slate-300",
  off: "bg-slate-500/20 border-slate-500/40 text-slate-300",
  other: "bg-slate-500/20 border-slate-500/40 text-slate-300",
};

const MUTED_EVENT_STYLE = "bg-slate-700/20 border-slate-500/30 text-slate-300 opacity-70";
const TRIP_DIM_STYLE = "bg-emerald-500/5 border-emerald-500/15 text-emerald-200/50";

function formatTimeForDisplay(iso: string, opts: ScheduleDisplaySettings): string {
  return formatScheduleTime(iso, {
    timezone: opts.baseTimezone,
    timeFormat: opts.timeFormat,
    showTimezoneLabel: opts.showTimezoneLabel,
    baseAirport: opts.baseAirport,
  });
}

function eventStyle(type: string): string {
  return EVENT_STYLES[type] ?? EVENT_STYLES.other;
}

function eventPillStyle(ev: ScheduleEvent): string {
  return ev.is_muted === true ? MUTED_EVENT_STYLE : eventStyle(ev.event_type);
}

function getCalendarPillLabel(ev: ScheduleEvent, dayEvents: ScheduleEvent[]): string {
  const isPay = ev.title?.trim().toUpperCase() === "PAY" || ev.event_type === "pay";
  if (!isPay) return ev.title || "Untitled";
  const tripOnDay = dayEvents.find((e) => {
    const t = (e.title ?? "").trim().toUpperCase();
    return e.event_type === "trip" && t !== "PAY";
  });
  return tripOnDay ? `PAY for ${tripOnDay.title || "Untitled"}` : ev.title || "Untitled";
}

/** Calendar tile only: dim trip when day has PAY event. */
function getCalendarTileStyle(ev: ScheduleEvent, dayEvents: ScheduleEvent[]): string {
  if (ev.is_muted === true) return MUTED_EVENT_STYLE;
  if (ev.title?.trim().toUpperCase() === "PAY") return eventStyle("pay");
  const hasPayOnDay = dayEvents.some((e) => e.title?.trim().toUpperCase() === "PAY");
  if (ev.event_type === "trip" && hasPayOnDay) return TRIP_DIM_STYLE;
  return eventStyle(ev.event_type);
}

function getMonthStart(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function getMonthEnd(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

function getCalendarDays(year: number, month: number): (Date | null)[] {
  const start = getMonthStart(year, month);
  const end = getMonthEnd(year, month);
  const startDay = start.getDay();
  const days: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let d = 1; d <= end.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

function eventsForDay(events: ScheduleEvent[], day: Date, baseTimezone: string): ScheduleEvent[] {
  const overlapping = events.filter((e) => eventOverlapsDay(e.start_time, e.end_time, day, baseTimezone));
  const workEvents = overlapping.filter((e) => e.event_type === "trip" || e.event_type === "reserve");
  const vacationOffEvents = overlapping.filter((e) => e.event_type === "vacation" || e.event_type === "off");
  const toReturn = workEvents.length > 0 && vacationOffEvents.length > 0 ? workEvents : overlapping;
  return [...toReturn].sort((a, b) => {
    const aMuted = a.is_muted === true ? 1 : 0;
    const bMuted = b.is_muted === true ? 1 : 0;
    if (aMuted !== bMuted) return aMuted - bMuted;
    const aCarryover = !isEventOnDay(a.start_time, day, baseTimezone) ? 1 : 0;
    const bCarryover = !isEventOnDay(b.start_time, day, baseTimezone) ? 1 : 0;
    if (aCarryover !== bCarryover) return aCarryover - bCarryover;
    return (a.start_time ?? "").localeCompare(b.start_time ?? "");
  });
}

const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

/** Temporary UI dedupe: keep first-seen per title|start_time|end_time. Remove once import-level dedupe is fixed. */
function dedupeEventsByTitleStartEnd(events: ScheduleEvent[]): ScheduleEvent[] {
  const seen = new Set<string>();
  return events.filter((ev) => {
    const key = `${ev.title ?? ""}|${ev.start_time}|${ev.end_time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Returns YYYY-bidMonthIndex (zero-padded) for an event's start_time, or null if no bid period. */
function getEventBidPeriodKey(ev: ScheduleEvent, tz: string): string | null {
  const period = getBidPeriodForTimestamp(ev.start_time, tz);
  return period ? `${period.startStr.slice(0, 4)}-${String(period.bidMonthIndex).padStart(2, "0")}` : null;
}

type ScheduleEventLeg = {
  day?: string;
  flightNumber?: string;
  origin: string;
  destination: string;
  depTime?: string;
  arrTime?: string;
  blockMinutes?: number;
  raw?: string;
};

function toYyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export type SelectedPopoverState = {
  event: ScheduleEvent;
  clickedDate: string | null; // YYYY-MM-DD, null when from Upcoming list
};

function EventDetailPopover({
  event,
  clickedDate,
  clickedDayEvents,
  displaySettings,
  eventStyle,
  formatDayLabel,
  formatDayRangeLabel,
  formatTimeForDisplay,
  position,
}: {
  event: ScheduleEvent;
  clickedDate: string | null;
  clickedDayEvents: ScheduleEvent[];
  displaySettings: ScheduleDisplaySettings;
  eventStyle: (type: string) => string;
  formatDayLabel: (iso: string, tz: string) => string;
  formatDayRangeLabel: (start: string, end: string, tz: string) => string;
  formatTimeForDisplay: (iso: string, opts: ScheduleDisplaySettings) => string;
  position: { x: number; y: number };
}) {
  const hasPayOnClickedDay = clickedDayEvents.some((e) => e.title?.trim().toUpperCase() === "PAY");
  const dateLabel =
    event.event_type === "vacation" || event.event_type === "off"
      ? formatDayRangeLabel(event.start_time, event.end_time, displaySettings.baseTimezone)
      : clickedDate
        ? formatDayLabel(`${clickedDate}T12:00:00.000Z`, displaySettings.baseTimezone)
        : formatDayLabel(event.start_time, displaySettings.baseTimezone);

  const legsToShow =
    event.event_type === "trip" && event.legs && event.legs.length > 0
      ? clickedDate
        ? (() => {
            const tz = displaySettings.baseTimezone;
            const tripDateStrs = getTripDateStrings(event.start_time, event.end_time, tz);
            const legDates = computeLegDates(event.legs!, tripDateStrs, tz);
            return legDates
              .filter(
                ({ departureDate, arrivalDate }) =>
                  departureDate === clickedDate || arrivalDate === clickedDate
              )
              .map(({ leg }) => leg);
          })()
        : event.legs!
      : null;

  const reportNightMeta = getTripReportNightMeta(event, {
    timezone: displaySettings.baseTimezone,
    timeFormat: displaySettings.timeFormat,
    showTimezoneLabel: displaySettings.showTimezoneLabel,
    baseAirport: displaySettings.baseAirport,
  });

  const timeRange =
    legsToShow && legsToShow.length > 0 && legsToShow[0].depTime != null && legsToShow[legsToShow.length - 1].arrTime != null
      ? `${legsToShow[0].depTime} – ${legsToShow[legsToShow.length - 1].arrTime}`
      : `${formatTimeForDisplay(event.start_time, displaySettings)} – ${formatTimeForDisplay(event.end_time, displaySettings)}`;

  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.log("[EventDetailPopover] render", {
      eventId: event.id,
      title: event.title,
      clickedDate,
      legsCount: event.legs?.length ?? 0,
      legsToShowCount: legsToShow?.length ?? 0,
    });
  }

  return (
    <div
      className="fixed z-50 min-w-[200px] max-w-[320px] rounded-xl border border-white/10 bg-slate-900 shadow-xl p-4"
      style={{ left: Math.min(position.x, window.innerWidth - 340), top: position.y + 8 }}
    >
      <p className="font-medium text-white">{event.title || "Untitled"}</p>
      <p className="mt-2 text-sm text-slate-400">
        {dateLabel}
        {" • "}
        {timeRange}
      </p>
      {event.event_type === "trip" &&
        (legsToShow && legsToShow.length > 0 ? (
          <div className="mt-2 space-y-1">
            {legsToShow.map((l, i) => (
              <p key={i} className="text-sm text-slate-400 font-mono">
                {l.flightNumber ? `${(displaySettings.carrierCode?.trim() || "FLT")}${l.flightNumber.trim()} ` : ""}
                {l.origin} → {l.destination}
                {l.depTime && l.arrTime ? ` ${l.depTime}–${l.arrTime}` : ""}
              </p>
            ))}
          </div>
        ) : event.legs && event.legs.length > 0 && clickedDate ? (
          reportNightMeta.isReportNight &&
          clickedDate === reportNightMeta.reportLocalDate &&
          reportNightMeta.reportDisplay ? (
            <p className="mt-2 text-sm text-amber-300">
              Report {reportNightMeta.reportDisplay} — Flight Departs after Midnight
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-500 italic">Layover day — no flights</p>
          )
        ) : (event.legs == null || event.legs.length === 0) && event.route?.trim() ? (
          <p className="mt-2 text-sm text-slate-400">{event.route}</p>
        ) : null)}
      {(event.credit_minutes != null || event.baseline_credit_minutes != null || event.block_minutes != null) && (
        <div className="mt-2 border-t border-white/10 pt-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pay & Credit</p>
          <div className="mt-1 space-y-0.5 text-sm text-slate-400">
            {event.credit_minutes != null && (
              <p>Credit: {formatMinutesToHhMm(event.credit_minutes)}</p>
            )}
            {event.baseline_credit_minutes != null &&
              event.baseline_credit_minutes !== event.credit_minutes && (
                <p>Original Credit: {formatMinutesToHhMm(event.baseline_credit_minutes)}</p>
              )}
            {event.block_minutes != null && (
              <p>Block: {formatMinutesToHhMm(event.block_minutes)}</p>
            )}
            {!event.is_muted &&
              event.block_minutes != null &&
              event.credit_minutes != null &&
              event.block_minutes < event.credit_minutes &&
              hasPayOnClickedDay && (
                <p className="text-xs text-amber-400 mt-1">
                  Credit protected — Trip not fully flown
                </p>
              )}
            {event.is_muted === true && (
              <p className="text-xs text-slate-500 italic mt-1">Previous schedule version</p>
            )}
          </div>
        </div>
      )}
      <span className={`mt-2 inline-block rounded px-2 py-0.5 text-xs ${eventPillStyle(event)}`}>
        {event.event_type}
      </span>
    </div>
  );
}

export default function SchedulePage() {
  const today = new Date();
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importTechnicalError, setImportTechnicalError] = useState<string | null>(null);
  const [tripChangeSummaries, setTripChangeSummaries] = useState<TripChangeSummary[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [status, setStatus] = useState<{ count: number; lastImportedAt: string | null; status: "no_schedule" | "up_to_date" | "outdated" } | null>(null);
  const [importEmail, setImportEmail] = useState<string | null>(null);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [displaySettings, setDisplaySettings] = useState<ScheduleDisplaySettings>({
    baseTimezone: getFrontierBidPeriodTimezone(),
    baseAirport: null,
    displayTimezoneMode: "base",
    timeFormat: "24h",
    showTimezoneLabel: false,
  });
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [showFlicaIcsGuide, setShowFlicaIcsGuide] = useState(false);
  const [selectedPopover, setSelectedPopover] = useState<SelectedPopoverState | null>(null);
  const [detailPosition, setDetailPosition] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedPopover) return;
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        closeDetail();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [selectedPopover]);

  async function loadData() {
    const [s, settings, admin, email] = await Promise.all([
      getScheduleImportStatus(),
      getScheduleDisplaySettings(),
      getIsAdmin(),
      getScheduleImportEmail(),
    ]);
    setStatus({ count: s.count, lastImportedAt: s.lastImportedAt, status: s.status });
    setDisplaySettings(settings);
    setIsAdmin(admin);
    setImportEmail(email);

    const year = calendarMonth.getFullYear();
    const periods = getAllBidPeriodsForYear(year);
    let startStr: string;
    let endStr: string;
    if (periods.length > 0) {
      startStr = periods[0].startStr + "T00:00:00.000Z";
      endStr = periods[periods.length - 1].endStr + "T23:59:59.999Z";
    } else {
      const monthStart = getMonthStart(year, calendarMonth.getMonth());
      const monthEnd = getMonthEnd(year, calendarMonth.getMonth());
      const upcomingEndDate = new Date();
      upcomingEndDate.setDate(upcomingEndDate.getDate() + 14);
      const fetchEnd = monthEnd > upcomingEndDate ? monthEnd : upcomingEndDate;
      startStr = monthStart.toISOString().slice(0, 10) + "T00:00:00.000Z";
      endStr = fetchEnd.toISOString().slice(0, 10) + "T23:59:59.999Z";
    }
    const { events: evts } = await getScheduleEvents(startStr, endStr);
    setEvents(evts);
  }

  useEffect(() => {
    loadData();
  }, [calendarMonth.getFullYear(), calendarMonth.getMonth()]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || importing) return;
    e.target.value = "";

    setImportError(null);
    setImportTechnicalError(null);
    setTripChangeSummaries(null);
    setImporting(true);
    const formData = new FormData();
    formData.set("file", file);
    const result = await importIcsFile(formData);
    setImporting(false);

    if ("error" in result) {
      setImportError(result.error);
      setImportTechnicalError(result.technicalError ?? null);
      return;
    }
    if (result.tripChangeSummaries.length > 0) {
      setTripChangeSummaries(result.tripChangeSummaries);
      if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
        console.log("[Trip change UI]", { rendered: result.tripChangeSummaries.length, pairings: result.tripChangeSummaries.map((s) => s.pairing) });
      }
    }
    await loadData();
  }

  function handleClearClick() {
    if (!status?.count) return;
    setShowClearConfirm(true);
  }

  async function handleClearConfirm() {
    if (clearing || !status?.count) return;
    setShowClearConfirm(false);
    setImportError(null);
    setTripChangeSummaries(null);
    setClearing(true);
    const result = await clearScheduleImport();
    setClearing(false);
    if (!result.success) {
      setImportError(result.error ?? "Failed to clear schedule");
      return;
    }
    await loadData();
  }

  function handleEventClick(ev: ScheduleEvent, clientX: number, clientY: number, clickedDay?: Date | null) {
    const clickedDate = clickedDay ? toYyyyMmDd(clickedDay) : null;
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      console.log("[Schedule] handleEventClick", {
        eventId: ev.id,
        title: ev.title,
        clickedDate,
        legsCount: ev.legs?.length ?? 0,
        legs: ev.legs,
      });
    }
    setSelectedPopover({ event: ev, clickedDate });
    setDetailPosition({ x: clientX, y: clientY });
  }

  function closeDetail() {
    setSelectedPopover(null);
    setDetailPosition(null);
  }

  const baseTimezone = displaySettings.baseTimezone ?? getFrontierBidPeriodTimezone();
  const periodKeysWithEvents = new Set<string>();
  for (const ev of events) {
    const key = getEventBidPeriodKey(ev, baseTimezone);
    if (key) periodKeysWithEvents.add(key);
  }
  const sortedPeriodKeys = [...periodKeysWithEvents].sort();
  const visiblePeriodKeys = new Set(sortedPeriodKeys.slice(-2));
  const eventsToShow = dedupeEventsByTitleStartEnd(
    events.filter((ev) => {
      const key = getEventBidPeriodKey(ev, baseTimezone);
      return !key || visiblePeriodKeys.has(key);
    })
  );

  const calendarDays = getCalendarDays(calendarMonth.getFullYear(), calendarMonth.getMonth());
  const monthLabel = calendarMonth.toLocaleString(undefined, { month: "long", year: "numeric" });
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">My Schedule</h1>
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/40">BETA</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ics,.vcs,text/calendar"
            className="hidden"
            onChange={handleFileChange}
            disabled={importing}
          />
          <div className="flex flex-wrap items-center gap-2">
              {status != null && (
                <ScheduleStatusChip status={status.status} lastImportedAt={status.lastImportedAt} showLastImport={false} />
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="rounded-lg bg-[#75C043] px-4 py-1.5 text-sm font-semibold text-slate-950 hover:opacity-95 transition disabled:opacity-50"
              >
                {importing ? "Uploading…" : "Upload FLICA Schedule (.ICS)"}
              </button>
              {status != null && status.count > 0 && (
                <button
                  type="button"
                  onClick={handleClearClick}
                  disabled={clearing}
                  className="rounded-lg border border-white/20 px-4 py-1.5 text-sm font-medium text-slate-300 hover:bg-white/5 transition disabled:opacity-50"
                >
                  {clearing ? "Clearing…" : "Clear schedule"}
                </button>
              )}
            </div>
        </div>
        {status != null && status.lastImportedAt && status.status !== "no_schedule" && (
          <p className="mt-2 text-right text-xs text-slate-400">Last Import: {formatLastImport(status.lastImportedAt)}</p>
        )}
        <p className="mt-1 text-sm text-slate-400">
          Import your schedule into CrewRules™ using one of these methods:
        </p>
        <ul className="mt-1 text-sm text-slate-400 list-disc list-inside space-y-0.5">
          <li>Automatic updates — Add your CrewRules™ import email to ELP</li>
          <li>Email import — Send your schedule from FLICA to your CrewRules™ import email</li>
          <li>
            Manual upload — Upload your FLICA .ics file{" "}
            <button
              type="button"
              onClick={() => setShowFlicaIcsGuide(true)}
              className="inline-flex items-center px-2 py-0.5 ml-2 text-xs font-medium rounded-full border border-[#75C043]/40 text-[#75C043] bg-[#75C043]/10 hover:bg-[#75C043]/20 transition align-baseline"
            >
              View guide
            </button>
          </li>
        </ul>
      </div>

      {importEmail && (
        <div className="px-4 sm:px-6">
          <InboundEmailDisplay email={importEmail} variant="schedule" />
        </div>
      )}

      {tripChangeSummaries && tripChangeSummaries.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">Trip updated</h3>
          {tripChangeSummaries.map((s, i) => (
            <div key={i} className="space-y-2 text-xs">
              <p className="font-mono text-slate-300">{s.pairing}</p>
              {s.removedLegs.length > 0 && (
                <p className="text-slate-400">
                  Removed: {s.removedLegs.map((l) => formatLegLine(l, false)).join("; ")}
                </p>
              )}
              {s.addedLegs.length > 0 && (
                <p className="text-slate-400">
                  Added: {s.addedLegs.map((l) => formatLegLine(l, true)).join("; ")}
                </p>
              )}
              {s.reportChanged && (
                <p className="text-slate-400">
                  Report: {s.reportChanged.before} → {s.reportChanged.after}
                </p>
              )}
              {s.creditChanged && (
                <p className="text-slate-400">
                  Credit: {formatMinutesToHhMm(s.creditChanged.before)} → {formatMinutesToHhMm(s.creditChanged.after)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {importError && (
        <div className="space-y-2">
          <p className="text-sm text-red-400">{importError}</p>
          {isAdmin && importTechnicalError && (
            <details
              open={detailsOpen}
              onToggle={(e) => setDetailsOpen((e.target as HTMLDetailsElement).open)}
              className="group"
            >
              <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-400 list-none flex items-center gap-1 [&::-webkit-details-marker]:hidden">
                <span className="select-none">{detailsOpen ? "▼" : "▶"} Details</span>
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-white/10 bg-slate-950/60 p-3 text-xs text-slate-400">
                {importTechnicalError}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Empty state */}
      {status != null && status.count === 0 && (
        <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 p-6 sm:p-8 text-center">
          <p className="font-medium text-slate-300">No schedule imported yet.</p>
          <p className="mt-1.5 text-sm text-slate-500">
            Import your schedule using one of the methods above.
          </p>
        </div>
      )}

      {/* Main content: calendar */}
      {status != null && status.count > 0 && (
        <div className="space-y-6">
          <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{monthLabel}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date())}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5"
                >
                  →
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400 mb-2">
              {weekDays.map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, i) => (
                <div
                  key={i}
                  className={`min-h-[72px] rounded-lg border p-1 ${
                    !day
                      ? "border-transparent"
                      : isSameDay(day, today)
                        ? "border-amber-500/60 bg-amber-500/15 ring-2 ring-amber-500/30"
                        : "border-white/10 bg-slate-950/40"
                  }`}
                >
                  {day &&
                    (() => {
                      const dayEvents = eventsForDay(eventsToShow, day, displaySettings.baseTimezone);
                      const visibleDayEvents = dayEvents.filter((e) => !isRdPlaceholderEvent(e));
                      const timeOpts = {
                        timezone: displaySettings.baseTimezone,
                        timeFormat: displaySettings.timeFormat,
                        showTimezoneLabel: displaySettings.showTimezoneLabel,
                        baseAirport: displaySettings.baseAirport,
                      };
                      const dayStr = toYyyyMmDd(day);
                      return (
                        <>
                          <div className="text-xs text-slate-500 mb-1">{day.getDate()}</div>
                          <div className="space-y-0.5">
                            {visibleDayEvents.slice(0, 3).map((ev) => {
                              const rn = getTripReportNightMeta(ev, timeOpts);
                              const isReportNightTile =
                                rn.isReportNight &&
                                dayStr === rn.reportLocalDate &&
                                ev.is_muted !== true;
                              return (
                                <button
                                  key={`${ev.id}-${toYyyyMmDd(day)}`}
                                  type="button"
                                  onClick={(e) => handleEventClick(ev, e.clientX, e.clientY, day)}
                                  className={`flex w-full rounded border px-1.5 py-0.5 text-left text-xs ${
                                    isReportNightTile
                                      ? `flex-col items-stretch gap-0.5 ${REPORT_NIGHT_TILE_CLASS}`
                                      : `items-center ${getCalendarTileStyle(ev, visibleDayEvents)}`
                                  }`}
                                >
                                  {isReportNightTile ? (
                                    <>
                                      <span className="min-w-0 truncate font-medium">{ev.title || "Untitled"}</span>
                                      {rn.reportDisplay && rn.reportLocalDate && (
                                        <span className="text-[10px] leading-tight">
                                          <span className="font-semibold">REPORT</span> {rn.reportDisplay} •{" "}
                                          {formatReportNightEeeD(rn.reportLocalDate, displaySettings.baseTimezone)}
                                        </span>
                                      )}
                                      {rn.firstDepDisplay && rn.firstDepartureLocalDate && (
                                        <span className="text-[10px] leading-tight">
                                          DEPARTURE {rn.firstDepDisplay} •{" "}
                                          {formatReportNightEeeD(
                                            rn.firstDepartureLocalDate,
                                            displaySettings.baseTimezone
                                          )}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="min-w-0 truncate">{getCalendarPillLabel(ev, visibleDayEvents)}</span>
                                  )}
                                  {ev.is_muted === true && (
                                    <span className="ml-1 shrink-0 text-[10px] px-1 rounded bg-slate-500/20 text-slate-300 self-end">
                                      Previous
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                            {visibleDayEvents.length > 3 && (
                              <span className="text-xs text-slate-500">+{visibleDayEvents.length - 3}</span>
                            )}
                          </div>
                        </>
                      );
                    })()}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Clear schedule confirmation */}
      {showClearConfirm && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60"
            aria-hidden
            onClick={() => setShowClearConfirm(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-xl"
            role="dialog"
            aria-labelledby="clear-schedule-title"
            aria-modal="true"
          >
            <h2 id="clear-schedule-title" className="text-lg font-semibold text-white">
              Clear schedule?
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              This will remove all imported schedule events. You can upload a new schedule anytime.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearConfirm}
                disabled={clearing}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 transition disabled:opacity-50"
              >
                {clearing ? "Clearing…" : "Yes, clear schedule"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Event detail popover */}
      {selectedPopover && detailPosition && (
        <>
          <div className="fixed inset-0 z-40 pointer-events-none" aria-hidden />
          <div ref={popoverRef} className="relative z-50">
            <EventDetailPopover
              event={selectedPopover.event}
              clickedDate={selectedPopover.clickedDate}
              clickedDayEvents={
                selectedPopover.clickedDate
                  ? eventsForDay(
                      eventsToShow,
                      new Date(selectedPopover.clickedDate + "T12:00:00.000Z"),
                      baseTimezone
                    ).filter((e) => !isRdPlaceholderEvent(e))
                  : []
              }
              displaySettings={displaySettings}
              eventStyle={eventStyle}
              formatDayLabel={formatDayLabel}
              formatDayRangeLabel={formatDayRangeLabel}
              formatTimeForDisplay={formatTimeForDisplay}
              position={detailPosition}
            />
          </div>
        </>
      )}

      <FlicaIcsHelperModal open={showFlicaIcsGuide} onClose={() => setShowFlicaIcsGuide(false)} />
    </div>
  );
}
