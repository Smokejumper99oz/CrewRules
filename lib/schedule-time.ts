/**
 * Schedule time formatting utilities.
 * Uses date-fns-tz for IANA timezone support.
 */

import { formatInTimeZone } from "date-fns-tz";

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
