"use client";

import { useState, useEffect, useRef } from "react";
import {
  importIcsFile,
  clearScheduleImport,
  getScheduleImportStatus,
  getScheduleEvents,
  getScheduleDisplaySettings,
  getIsAdmin,
  type ScheduleEvent,
  type ScheduleDisplaySettings,
} from "./actions";
import { ScheduleStatusChip } from "@/components/schedule-status-chip";
import { formatScheduleTime, formatDayLabel, eventOverlapsDay } from "@/lib/schedule-time";

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
  return events.filter((e) => eventOverlapsDay(e.start_time, e.end_time, day, baseTimezone));
}

const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

export default function SchedulePage() {
  const today = new Date();
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importTechnicalError, setImportTechnicalError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [status, setStatus] = useState<{ count: number; lastImportedAt: string | null; status: "no_schedule" | "up_to_date" | "outdated" } | null>(null);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [displaySettings, setDisplaySettings] = useState<ScheduleDisplaySettings>({
    baseTimezone: "America/Denver",
    baseAirport: null,
    displayTimezoneMode: "base",
    timeFormat: "24h",
    showTimezoneLabel: false,
  });
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [detailPosition, setDetailPosition] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadData() {
    const [s, settings, admin] = await Promise.all([
      getScheduleImportStatus(),
      getScheduleDisplaySettings(),
      getIsAdmin(),
    ]);
    setStatus({ count: s.count, lastImportedAt: s.lastImportedAt, status: s.status });
    setDisplaySettings(settings);
    setIsAdmin(admin);

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
    setClearing(true);
    const result = await clearScheduleImport();
    setClearing(false);
    if (!result.success) {
      setImportError(result.error ?? "Failed to clear schedule");
      return;
    }
    await loadData();
  }

  function handleEventClick(ev: ScheduleEvent, clientX: number, clientY: number) {
    setSelectedEvent(ev);
    setDetailPosition({ x: clientX, y: clientY });
  }

  function closeDetail() {
    setSelectedEvent(null);
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
      <div className="bg-slate-900/50 backdrop-blur-sm border-b border-white/5 md:bg-transparent md:backdrop-blur-none md:border-b-0">
        <div className="px-4 py-4 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">My Schedule</h1>
              <p className="mt-1 text-sm text-slate-400">
                In FLICA: Export Schedule → iCalendar (.ICS) → Upload here.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {status != null && (
                <ScheduleStatusChip status={status.status} lastImportedAt={status.lastImportedAt} />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".ics,.vcs,text/calendar"
                className="hidden"
                onChange={handleFileChange}
                disabled={importing}
              />
              <div className="flex flex-wrap gap-2">
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
          </div>
        </div>
      </div>

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
        <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 p-12 text-center">
          <p className="text-slate-400">No schedule imported yet.</p>
          <p className="mt-2 text-sm text-slate-500">
            Use the upload button above to import your schedule.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            This uploads a file from your computer — it does not connect CrewRules™ to FLICA.
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
                            key={ev.id}
                            type="button"
                            onClick={(e) => handleEventClick(ev, e.clientX, e.clientY)}
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
                    <span className="text-xs shrink-0 ml-2">{formatDayLabel(ev.start_time, displaySettings.baseTimezone)}</span>
                  </button>
                ))}
              </div>
            )}
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
      {selectedEvent && detailPosition && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={closeDetail} />
          <div
            className="fixed z-50 min-w-[200px] max-w-[320px] rounded-xl border border-white/10 bg-slate-900 shadow-xl p-4"
            style={{ left: Math.min(detailPosition.x, window.innerWidth - 340), top: detailPosition.y + 8 }}
          >
            <p className="font-medium text-white">{selectedEvent.title || "Untitled"}</p>
            <p className="mt-2 text-sm text-slate-400">
              {formatDayLabel(selectedEvent.start_time, displaySettings.baseTimezone)} •{" "}
              {formatTimeForDisplay(selectedEvent.start_time, displaySettings)} –{" "}
              {formatTimeForDisplay(selectedEvent.end_time, displaySettings)}
            </p>
            <span className={`mt-2 inline-block rounded px-2 py-0.5 text-xs ${eventStyle(selectedEvent.event_type)}`}>
              {selectedEvent.event_type}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
