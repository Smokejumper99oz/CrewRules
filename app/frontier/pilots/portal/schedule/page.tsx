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
import { formatLegLine } from "@/lib/trips/detect-trip-changes";
import type { TripChangeSummary } from "@/lib/trips/detect-trip-changes";
import { formatMinutesToHhMm } from "@/lib/schedule-time";
import { formatInTimeZone } from "date-fns-tz";
import { ScheduleStatusChip } from "@/components/schedule-status-chip";
import { formatScheduleTime, formatDayLabel, formatDayRangeLabel, eventOverlapsDay, addDay } from "@/lib/schedule-time";

const EVENT_STYLES: Record<string, string> = {
  trip: "bg-emerald-500/20 border-emerald-500/40 text-emerald-200",
  reserve: "bg-blue-500/20 border-blue-500/40 text-blue-200",
  vacation: "bg-slate-500/20 border-slate-500/40 text-slate-300",
  off: "bg-slate-500/20 border-slate-500/40 text-slate-300",
  other: "bg-slate-500/20 border-slate-500/40 text-slate-300",
};

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
  if (workEvents.length > 0 && vacationOffEvents.length > 0) {
    return workEvents;
  }
  return overlapping;
}

const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const DAY_ABBREVS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** Parse HH:MM or HHMM to minutes. Returns null if invalid. */
function timeToMinutes(t: string | undefined): number | null {
  if (!t?.trim()) return null;
  const s = t.trim().replace(":", "");
  if (!/^\d{3,4}$/.test(s)) return null;
  const h = parseInt(s.slice(0, -2) || "0", 10);
  const m = parseInt(s.slice(-2), 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** True if leg is overnight (arrives next calendar day). */
function isOvernightLeg(leg: { depTime?: string; arrTime?: string }): boolean {
  const dep = timeToMinutes(leg.depTime);
  const arr = timeToMinutes(leg.arrTime);
  if (dep == null || arr == null) return false;
  return arr < dep;
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

/** Get weekday abbreviation (Mo, Tu, etc.) for a YYYY-MM-DD date in the given timezone. */
function getWeekdayAbbrev(dateStr: string, timezone: string): string {
  const d = new Date(dateStr + "T12:00:00.000Z");
  const dayIdx = parseInt(formatInTimeZone(d, timezone, "i"), 10) % 7; // ISO 1=Mon -> 0=Sun
  return DAY_ABBREVS[dayIdx];
}

/** Get all YYYY-MM-DD dates from event start to end (inclusive) in the given timezone. */
function getTripDateStrings(startTime: string, endTime: string, timezone: string): string[] {
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
  const dates: string[] = [];
  let cur = formatInTimeZone(start, timezone, "yyyy-MM-dd");
  const endStr = formatInTimeZone(end, timezone, "yyyy-MM-dd");
  while (cur <= endStr) {
    dates.push(cur);
    cur = addDay(cur);
  }
  return dates;
}

/**
 * Derive departure and arrival dates for each leg relative to the trip.
 * If arrTime < depTime, treat as overnight and arrival is next calendar day.
 * Uses leg order to handle multiple legs on the same weekday (e.g. two Sunday legs).
 */
function computeLegDates(
  legs: ScheduleEventLeg[],
  tripDateStrs: string[],
  timezone: string
): { leg: ScheduleEventLeg; departureDate: string | null; arrivalDate: string | null }[] {
  const usedCountByWeekday = new Map<string, number>();
  return legs.map((leg) => {
    if (!leg.day) return { leg, departureDate: null, arrivalDate: null };
    const legDayNorm = leg.day.slice(0, 2).toLowerCase();
    const datesForWeekday = tripDateStrs.filter(
      (d) => getWeekdayAbbrev(d, timezone).toLowerCase() === legDayNorm
    );
    const usedCount = usedCountByWeekday.get(legDayNorm) ?? 0;
    const departureDate = datesForWeekday[usedCount] ?? null;
    if (departureDate) usedCountByWeekday.set(legDayNorm, usedCount + 1);
    if (!departureDate) return { leg, departureDate: null, arrivalDate: null };
    const arrivalDate = isOvernightLeg(leg) ? addDay(departureDate) : departureDate;
    return { leg, departureDate, arrivalDate };
  });
}

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
  displaySettings,
  eventStyle,
  formatDayLabel,
  formatDayRangeLabel,
  formatTimeForDisplay,
  position,
}: {
  event: ScheduleEvent;
  clickedDate: string | null;
  displaySettings: ScheduleDisplaySettings;
  eventStyle: (type: string) => string;
  formatDayLabel: (iso: string, tz: string) => string;
  formatDayRangeLabel: (start: string, end: string, tz: string) => string;
  formatTimeForDisplay: (iso: string, opts: ScheduleDisplaySettings) => string;
  position: { x: number; y: number };
}) {
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

  const timeRange =
    legsToShow && legsToShow.length > 0 && clickedDate
      ? (() => {
          const tz = displaySettings.baseTimezone;
          const tripDateStrs = getTripDateStrings(event.start_time, event.end_time, tz);
          const legDates = computeLegDates(event.legs!, tripDateStrs, tz);
          const timesOnDate: string[] = [];
          for (const { leg, departureDate, arrivalDate } of legDates) {
            if (departureDate === clickedDate && leg.depTime) timesOnDate.push(leg.depTime);
            if (arrivalDate === clickedDate && leg.arrTime) timesOnDate.push(leg.arrTime);
          }
          if (timesOnDate.length > 0) {
            timesOnDate.sort();
            return `${timesOnDate[0]} – ${timesOnDate[timesOnDate.length - 1]}`;
          }
          return `${legsToShow[0].depTime ?? "—"} – ${legsToShow[legsToShow.length - 1].arrTime ?? "—"}`;
        })()
      : legsToShow && legsToShow.length > 0 && legsToShow[0].depTime && legsToShow[legsToShow.length - 1].arrTime
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
                {l.flightNumber ? `${l.flightNumber} ` : ""}
                {l.origin} → {l.destination}
                {l.depTime && l.arrTime ? ` ${l.depTime}–${l.arrTime}` : ""}
              </p>
            ))}
          </div>
        ) : event.legs && event.legs.length > 0 && clickedDate ? (
          <p className="mt-2 text-sm text-slate-500 italic">Layover day — no flights</p>
        ) : (event.legs == null || event.legs.length === 0) && event.route?.trim() ? (
          <p className="mt-2 text-sm text-slate-400">{event.route}</p>
        ) : null)}
      <span className={`mt-2 inline-block rounded px-2 py-0.5 text-xs ${eventStyle(event.event_type)}`}>
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
    baseTimezone: "America/Denver",
    baseAirport: null,
    displayTimezoneMode: "base",
    timeFormat: "24h",
    showTimezoneLabel: false,
  });
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
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

    const monthStart = getMonthStart(calendarMonth.getFullYear(), calendarMonth.getMonth());
    const monthEnd = getMonthEnd(calendarMonth.getFullYear(), calendarMonth.getMonth());
    const upcomingEndDate = new Date();
    upcomingEndDate.setDate(upcomingEndDate.getDate() + 14);
    const fetchEnd = monthEnd > upcomingEndDate ? monthEnd : upcomingEndDate;
    const startStr = monthStart.toISOString().slice(0, 10) + "T00:00:00.000Z";
    const endStr = fetchEnd.toISOString().slice(0, 10) + "T23:59:59.999Z";
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

  const now = new Date();
  const upcomingStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const upcomingEnd = new Date(upcomingStart);
  upcomingEnd.setDate(upcomingEnd.getDate() + 14);
  const upcomingEvents = events
    .filter((e) => {
      const start = new Date(e.start_time);
      return start >= upcomingStart && start < upcomingEnd;
    })
    .slice(0, 3);

  const calendarDays = getCalendarDays(calendarMonth.getFullYear(), calendarMonth.getMonth());
  const monthLabel = calendarMonth.toLocaleString(undefined, { month: "long", year: "numeric" });
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">My Schedule</h1>
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
              <ScheduleStatusChip status={status.status} lastImportedAt={status.lastImportedAt} />
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="rounded-xl bg-[#75C043] px-4 py-2.5 text-sm font-semibold text-slate-950 hover:opacity-95 transition disabled:opacity-50"
            >
              {importing ? "Uploading…" : "Upload FLICA Schedule (.ICS)"}
            </button>
            {status != null && status.count > 0 && (
              <button
                type="button"
                onClick={handleClearClick}
                disabled={clearing}
                className="rounded-xl border border-white/20 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 transition disabled:opacity-50"
              >
                {clearing ? "Clearing…" : "Clear schedule"}
              </button>
            )}
          </div>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          Import your Frontier FLICA schedule by uploading an .ics file or forwarding it to your CrewRules™ import email.
        </p>
      </div>

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
            Upload your FLICA .ics file above to get started.
          </p>
        </div>
      )}

      {/* Main content: calendar + upcoming */}
      {status != null && status.count > 0 && (
        <div className="space-y-6">
          {/* Month calendar */}
          <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{monthLabel}</h2>
              <div className="flex gap-2">
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
                  {day && (
                    <>
                      <div className="text-xs text-slate-500 mb-1">{day.getDate()}</div>
                      <div className="space-y-0.5">
                        {eventsForDay(events, day, displaySettings.baseTimezone).slice(0, 3).map((ev) => (
                          <button
                            key={`${ev.id}-${toYyyyMmDd(day)}`}
                            type="button"
                            onClick={(e) => handleEventClick(ev, e.clientX, e.clientY, day)}
                            className={`block w-full truncate rounded border px-1.5 py-0.5 text-left text-xs ${eventStyle(ev.event_type)}`}
                          >
                            {ev.title || "Untitled"}
                          </button>
                        ))}
                        {eventsForDay(events, day, displaySettings.baseTimezone).length > 3 && (
                          <span className="text-xs text-slate-500">+{eventsForDay(events, day, displaySettings.baseTimezone).length - 3}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming (next 14 days) */}
          <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 p-6">
            <h2 className="text-lg font-semibold mb-4">Upcoming</h2>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-slate-400">No events in the next 14 days.</p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={(e) => handleEventClick(ev, e.clientX, e.clientY)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition hover:opacity-90 ${eventStyle(ev.event_type)}`}
                  >
                    <span className="font-medium truncate">{ev.title || "Untitled"}</span>
                    <span className="text-xs shrink-0 ml-2">
                      {(ev.event_type === "vacation" || ev.event_type === "off")
                        ? formatDayRangeLabel(ev.start_time, ev.end_time, displaySettings.baseTimezone)
                        : formatDayLabel(ev.start_time, displaySettings.baseTimezone)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import section - below schedule card (email, copy) */}
      {importEmail && (
        <div className="px-4 sm:px-6 pt-6 border-t border-white/5">
          <InboundEmailDisplay email={importEmail} variant="schedule" />
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
    </div>
  );
}
