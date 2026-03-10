/**
 * Schedule time formatting utilities.
 * Uses date-fns-tz for IANA timezone support.
 */

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export type TimeFormat = "24h" | "12h";
export type DisplayTimezoneMode = "base" | "device" | "toggle";

export type TimeDisplayOptions = {
  timezone: string;
  timeFormat: TimeFormat;
  /** When true, append base airport code (e.g. "2230 SJU"). */
  showTimezoneLabel?: boolean;
  baseAirport?: string | null;
};

/**
 * Format a UTC ISO string for display.
 * With showTimezoneLabel: "2230 SJU" (24h) or "10:30 PM SJU" (12h).
 */
export function formatScheduleTime(isoUtc: string, options: TimeDisplayOptions): string {
  try {
    const date = new Date(isoUtc);
    if (isNaN(date.getTime())) return isoUtc;
    let timePart: string;
    if (options.timeFormat === "24h") {
      timePart = formatInTimeZone(date, options.timezone, options.showTimezoneLabel ? "HHmm" : "HH:mm");
    } else {
      timePart = formatInTimeZone(date, options.timezone, "h:mm a");
    }
    if (options.showTimezoneLabel && options.baseAirport) {
      return `${timePart} ${options.baseAirport}`;
    }
    return timePart;
  } catch {
    return isoUtc;
  }
}

/**
 * Format date + time for schedule display.
 */
export function formatScheduleDateTime(
  isoUtc: string,
  options: TimeDisplayOptions & { dateStyle?: "short" | "medium"; includeTime?: boolean }
): string {
  try {
    const date = new Date(isoUtc);
    if (isNaN(date.getTime())) return isoUtc;
    const timeFmt = options.timeFormat === "24h" ? "HH:mm" : "h:mm a";
    const dateFmt = options.dateStyle === "short" ? "EEE, MMM d" : "EEEE, MMMM d";
    const fmt = options.includeTime !== false ? `${dateFmt} ${timeFmt}` : dateFmt;
    return formatInTimeZone(date, options.timezone, fmt);
  } catch {
    return isoUtc;
  }
}

/** Resolve display timezone: base always uses given tz; device uses undefined (Intl default). */
export function resolveDisplayTimezone(
  mode: DisplayTimezoneMode,
  baseTimezone: string,
  deviceTimezone?: string
): string {
  if (mode === "base") return baseTimezone;
  if (mode === "device" && deviceTimezone) return deviceTimezone;
  return baseTimezone;
}

/** Check if event start is on today's date in the given timezone. */
export function isEventStartToday(isoUtc: string, timezone: string): boolean {
  try {
    const now = new Date();
    const startDateStr = formatInTimeZone(new Date(isoUtc), timezone, "yyyy-MM-dd");
    const todayStr = formatInTimeZone(now, timezone, "yyyy-MM-dd");
    return startDateStr === todayStr;
  } catch {
    return false;
  }
}

/** Check if event start falls on the given calendar day in the given timezone. */
export function isEventOnDay(isoUtc: string, day: Date, timezone: string): boolean {
  try {
    const date = new Date(isoUtc);
    if (isNaN(date.getTime())) return false;
    const eventDateStr = formatInTimeZone(date, timezone, "yyyy-MM-dd");
    const [y, m, d] = eventDateStr.split("-").map(Number);
    return y === day.getFullYear() && m === day.getMonth() + 1 && d === day.getDate();
  } catch {
    return false;
  }
}

/** Format credit hours as "4:30" (4.5 -> 4:30). */
export function formatCreditHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${h}:00`;
}

/** Format minutes as "2:20" (140 -> "2:20"). */
export function formatMinutesToHhMm(minutes: number): string {
  const m = Math.round(minutes);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm > 0 ? `${h}:${String(mm).padStart(2, "0")}` : `${h}:00`;
}

/** Compute trip credit: min 5 hrs/day, credit = max(block, min_credit), extra = credit - block. */
export function computeTripCredit(
  pairingDays: number | null | undefined,
  blockMinutes: number | null | undefined
): {
  blockMinutes: number;
  creditMinutes: number;
  extraCreditMinutes: number;
} {
  const block = blockMinutes ?? 0;
  const minCredit = (pairingDays ?? 1) * 300;
  const credit = Math.max(block, minCredit);
  const extra = Math.max(0, credit - block);
  return { blockMinutes: block, creditMinutes: credit, extraCreditMinutes: extra };
}

/** Day label for schedule: e.g. "Tue • Feb 27", "Wed • Feb 28". Always includes weekday and date to avoid confusion. */
export function formatDayLabel(isoUtc: string, timezone: string): string {
  try {
    const date = new Date(isoUtc);
    if (isNaN(date.getTime())) return isoUtc;
    return formatInTimeZone(date, timezone, "EEE • MMM d");
  } catch {
    return isoUtc;
  }
}

/** Day range label for multi-day events: e.g. "Tue • Mar 17 – Sat • Mar 21". Returns single day if start and end are same day. */
export function formatDayRangeLabel(startIso: string, endIso: string, timezone: string): string {
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return formatDayLabel(startIso, timezone);
    const startStr = formatInTimeZone(start, timezone, "yyyy-MM-dd");
    const endStr = formatInTimeZone(end, timezone, "yyyy-MM-dd");
    if (startStr === endStr) return formatDayLabel(startIso, timezone);
    return `${formatDayLabel(startIso, timezone)} – ${formatDayLabel(endIso, timezone)}`;
  } catch {
    return formatDayLabel(startIso, timezone);
  }
}

/**
 * Expand a schedule event (start_time/end_time) into the list of local calendar dates it overlaps,
 * clipped to the selected month boundaries. Each segment includes isStart/isMiddle/isEnd for through-bar styling.
 */
export type DaySegment = {
  dateStr: string; // YYYY-MM-DD in timezone
  isStart: boolean;
  isMiddle: boolean;
  isEnd: boolean;
};

/** Add one day to YYYY-MM-DD (timezone-safe). */
export function addDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

/** Extract pairing/trip key from title for merging. Handles "S3059", "Trip S3059", "S3059 BOS-SJU", etc. */
export function extractPairingKey(title: string | null): string {
  const s = (title ?? "").trim();
  const match = s.match(/([A-Z]?\d{4,}[A-Z]?)/i);
  if (match) return match[1].toUpperCase();
  return s || "unknown";
}

/**
 * One continuous bar per weekly segment. No daily instances.
 * Merges same-pairing events (FLICA exports one per day).
 */
export type WeeklyBarSpan<T = unknown> = {
  event: T;
  rowIndex: number;
  startCol: number;
  endCol: number;
  showLabel: boolean;
  leftChevron: boolean;
  rightChevron: boolean;
};

export function computeWeeklyBarSpans<T extends { id: string; start_time: string; end_time: string; title: string | null }>(
  events: T[],
  calendarDays: (Date | null)[],
  year: number,
  month: number,
  timezone: string
): WeeklyBarSpan[] {
  const dateToCell = new Map<string, { row: number; col: number }>();
  for (let i = 0; i < calendarDays.length; i++) {
    const day = calendarDays[i];
    if (!day) continue;
    const row = Math.floor(i / 7);
    const col = i % 7;
    const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    dateToCell.set(dateStr, { row, col });
  }

  const byPairingKey = new Map<string, { event: T; dateStrs: string[] }[]>();
  for (const event of events) {
    const segments = expandEventToDaySegments(event.start_time, event.end_time, year, month, timezone);
    if (segments.length === 0) continue;
    const dateStrs = [...new Set(segments.map((s) => s.dateStr))].sort();
    const key = extractPairingKey(event.title);
    if (!byPairingKey.has(key)) byPairingKey.set(key, []);
    byPairingKey.get(key)!.push({ event, dateStrs });
  }

  const mergedRuns: { event: T; dateStrs: string[] }[] = [];
  for (const [, pairs] of byPairingKey) {
    const allDateStrs = [...new Set(pairs.flatMap((p) => p.dateStrs))].sort();
    const runs: string[][] = [];
    let run: string[] = [allDateStrs[0]];
    for (let i = 1; i < allDateStrs.length; i++) {
      if (addDay(allDateStrs[i - 1]) === allDateStrs[i]) {
        run.push(allDateStrs[i]);
      } else {
        runs.push(run);
        run = [allDateStrs[i]];
      }
    }
    runs.push(run);
    for (const runDateStrs of runs) {
      const ev = pairs.find((p) => p.dateStrs.includes(runDateStrs[0]))!.event;
      mergedRuns.push({ event: ev, dateStrs: runDateStrs });
    }
  }

  const result: WeeklyBarSpan[] = [];
  for (const { event, dateStrs } of mergedRuns) {
    const byRow = new Map<number, number[]>();
    for (const ds of dateStrs) {
      const cell = dateToCell.get(ds);
      if (cell) {
        if (!byRow.has(cell.row)) byRow.set(cell.row, []);
        byRow.get(cell.row)!.push(cell.col);
      }
    }
    const sortedRows = [...byRow.keys()].sort((a, b) => a - b);

    for (let i = 0; i < sortedRows.length; i++) {
      const rowIndex = sortedRows[i];
      const cols = byRow.get(rowIndex)!.sort((a, b) => a - b);
      const minCol = cols[0];
      const maxCol = cols[cols.length - 1];
      const isFirstSegment = i === 0;
      const isLastSegment = i === sortedRows.length - 1;

      result.push({
        event,
        rowIndex,
        startCol: minCol,
        endCol: maxCol + 1,
        showLabel: isFirstSegment,
        leftChevron: !isFirstSegment,
        rightChevron: !isLastSegment,
      });
    }
  }

  return result;
}

/** DTEND is exclusive in iCal; use overlap check to get days. */
export function expandEventToDaySegments(
  startTime: string,
  endTime: string,
  year: number,
  month: number,
  timezone: string
): DaySegment[] {
  const segments: DaySegment[] = [];
  try {
    const eventStart = new Date(startTime);
    const eventEnd = new Date(endTime);
    if (isNaN(eventStart.getTime()) || isNaN(eventEnd.getTime())) return [];

    const lastDay = new Date(year, month + 1, 0).getDate();

    const overlapping: string[] = [];
    for (let d = 1; d <= lastDay; d++) {
      const day = new Date(year, month, d);
      if (eventOverlapsDay(startTime, endTime, day, timezone)) {
        overlapping.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
      }
    }

    for (let i = 0; i < overlapping.length; i++) {
      const dateStr = overlapping[i];
      segments.push({
        dateStr,
        isStart: i === 0,
        isMiddle: i > 0 && i < overlapping.length - 1,
        isEnd: i === overlapping.length - 1,
      });
    }

    return segments;
  } catch {
    return [];
  }
}

/**
 * Expand a schedule event into day segments within an arbitrary date range.
 * Iterates day by day from rangeStartStr through rangeEndStr; includes a segment
 * only if the event overlaps that day. Return shape matches expandEventToDaySegments.
 */
export function expandEventToDaySegmentsInRange(
  startTime: string,
  endTime: string,
  rangeStartStr: string,
  rangeEndStr: string,
  timezone: string
): DaySegment[] {
  const segments: DaySegment[] = [];
  try {
    const eventStart = new Date(startTime);
    const eventEnd = new Date(endTime);
    if (isNaN(eventStart.getTime()) || isNaN(eventEnd.getTime())) return [];
    if (rangeStartStr > rangeEndStr) return [];

    const overlapping: string[] = [];
    let cur = rangeStartStr;
    while (cur <= rangeEndStr) {
      const day = new Date(cur + "T12:00:00.000Z");
      if (eventOverlapsDay(startTime, endTime, day, timezone)) {
        overlapping.push(cur);
      }
      cur = addDay(cur);
    }

    for (let i = 0; i < overlapping.length; i++) {
      const dateStr = overlapping[i];
      segments.push({
        dateStr,
        isStart: i === 0,
        isMiddle: i > 0 && i < overlapping.length - 1,
        isEnd: i === overlapping.length - 1,
      });
    }

    return segments;
  } catch {
    return [];
  }
}

/** Get start and end of calendar day in timezone as UTC Dates. */
function getDayBounds(day: Date, timezone: string): { start: Date; end: Date } {
  const y = day.getFullYear();
  const m = String(day.getMonth() + 1).padStart(2, "0");
  const d = String(day.getDate()).padStart(2, "0");
  const start = fromZonedTime(`${y}-${m}-${d}T00:00:00.000`, timezone);
  const end = fromZonedTime(`${y}-${m}-${d}T23:59:59.999`, timezone);
  return { start, end };
}

/**
 * Check if event overlaps the given calendar day.
 * Overlap: event.start_time < end_of_day AND event.end_time > start_of_day
 */
export function eventOverlapsDay(
  startTime: string,
  endTime: string,
  day: Date,
  timezone: string
): boolean {
  try {
    const eventStart = new Date(startTime);
    const eventEnd = new Date(endTime);
    if (isNaN(eventStart.getTime()) || isNaN(eventEnd.getTime())) return false;
    const { start: dayStart, end: dayEnd } = getDayBounds(day, timezone);
    return eventStart.getTime() < dayEnd.getTime() && eventEnd.getTime() > dayStart.getTime();
  } catch {
    return false;
  }
}
