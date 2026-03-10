/**
 * Parse FLICA HTML calendar export into schedule events.
 * FLICA sends HTML calendar (not .ics) for some exports.
 */

import { fromZonedTime } from "date-fns-tz";

export type ParsedFlicaDay = {
  dateStr: string; // YYYY-MM-DD
  dayOfMonth: number;
  pairingCode: string | null; // S3019, S3126, etc.
  reportTime: string | null; // "19:59" or "PHL Rpt @ 19:59"
  reportCity: string | null; // PHL
  content: string; // raw cell text
  eventType: "trip" | "reserve" | "vacation" | "off";
};

export type ParsedFlicaEvent = {
  start: Date;
  end: Date;
  title: string;
  uid: string | null;
  reportTime?: string;
  creditMinutes?: number;
  firstLegRoute?: string;
  firstLegDepartureTime?: string;
  pairingDays?: number;
  blockMinutes?: number;
  legs?: Array<{ day?: string; flightNumber?: string; origin: string; destination: string; depTime?: string; arrTime?: string; blockMinutes?: number; raw?: string }>;
};

/** Detect if HTML looks like FLICA calendar export. */
export function isFlicaHtml(html: string): boolean {
  const normalized = html.replace(/\s+/g, " ").toLowerCase();
  if (/flica\.net\s*-\s*calendar/i.test(html)) return true;
  if (/flica\s*calendar/i.test(normalized)) return true;
  if (/flica\.net/i.test(html) && /calendar/i.test(normalized)) return true;
  return false;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract month/year from FLICA HTML header. (exported for debug logging) */
export function extractMonthYear(html: string): { year: number; month: number } | null {
  const match = html.match(/(\w+)\s+(\d{4})/i);
  if (match) {
    const monthNames = "january,february,march,april,may,june,july,august,september,october,november,december".split(",");
    const monthStr = match[1].toLowerCase();
    const year = parseInt(match[2], 10);
    const monthIdx = monthNames.findIndex((m) => monthStr.startsWith(m));
    if (monthIdx >= 0 && year >= 2020 && year <= 2030) {
      return { year, month: monthIdx + 1 };
    }
  }
  const alt = html.match(/(\d{1,2})\/(\d{4})/);
  if (alt) {
    const month = parseInt(alt[1], 10);
    const year = parseInt(alt[2], 10);
    if (month >= 1 && month <= 12 && year >= 2020) return { year, month };
  }
  return null;
}

/** Parse report line like "PHL Rpt @ 19:59" or "Rpt @ 19:59". */
function parseReportLine(text: string): { city: string | null; time: string | null } {
  const rptMatch = text.match(/([A-Z]{3})\s+Rpt\s*@\s*(\d{1,2}:\d{2})/i);
  if (rptMatch) return { city: rptMatch[1].toUpperCase(), time: rptMatch[2] };
  const simpleMatch = text.match(/Rpt\s*@\s*(\d{1,2}:\d{2})/i);
  if (simpleMatch) return { city: null, time: simpleMatch[1] };
  return { city: null, time: null };
}

/** Infer event type from cell content. */
function inferDayEventType(content: string): "trip" | "reserve" | "vacation" | "off" {
  const c = content.toUpperCase();
  if (/\bVAC\b|VACATION|\bV\d+\b/.test(c)) return "vacation";
  if (/\bOFF\b|OFF DUTY|DAY OFF/.test(c)) return "off";
  if (/\b(RSA|RSB|RSC|RSD|RSE|RSL|RES)\b|RESERVE/.test(c)) return "reserve";
  if (/\bS\d{4}\b/.test(c)) return "trip";
  return "trip";
}

/** Extract pairing code (S3019, S3126, etc.). */
function extractPairingCode(text: string): string | null {
  const m = text.match(/\b([A-Z]?\d{4,}[A-Z]?)\b/i);
  return m ? m[1].toUpperCase() : null;
}

/** Parse FLICA HTML calendar into day-level entries. */
export function parseFlicaHtmlDays(html: string): ParsedFlicaDay[] {
  const days: ParsedFlicaDay[] = [];
  const my = extractMonthYear(html);
  if (!my) return days;

  const { year, month } = my;
  const daysInMonth = new Date(year, month, 0).getDate();

  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let match;
  let cellIndex = 0;
  while ((match = tdRegex.exec(html)) !== null) {
    const raw = match[1];
    const content = stripHtml(raw);
    if (!content.trim()) continue;

    const dayNumMatch = content.match(/^\s*(\d{1,2})\s*$/m) || content.match(/\b(\d{1,2})\b/);
    const dayOfMonth = dayNumMatch ? parseInt(dayNumMatch[1], 10) : cellIndex % 31;
    if (dayOfMonth < 1 || dayOfMonth > daysInMonth) continue;

    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(dayOfMonth).padStart(2, "0")}`;
    const pairingCode = extractPairingCode(content);
    const { city: reportCity, time: reportTime } = parseReportLine(content);
    const eventType = inferDayEventType(content);

    days.push({
      dateStr,
      dayOfMonth,
      pairingCode,
      reportTime,
      reportCity,
      content,
      eventType,
    });
    cellIndex++;
  }

  return days;
}

/** Group days into events (trips span multiple days, reserve/vacation/off are single-day). */
export function parseFlicaHtml(
  html: string,
  options: { sourceTimezone?: string } = {}
): ParsedFlicaEvent[] {
  const sourceTimezone = options.sourceTimezone ?? "America/Denver";
  const days = parseFlicaHtmlDays(html);
  if (days.length === 0) return [];

  const events: ParsedFlicaEvent[] = [];
  const seen = new Set<string>();

  for (const day of days) {
    const key = `${day.dateStr}-${day.pairingCode ?? day.eventType}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const startDate = fromZonedTime(`${day.dateStr}T06:00:00`, sourceTimezone);
    const endDate = fromZonedTime(`${day.dateStr}T23:59:59`, sourceTimezone);

    let title = day.pairingCode ?? day.content.slice(0, 80);
    if (day.eventType === "reserve") title = day.content.match(/\b(RSA|RSB|RSC|RSD|RSE|RSL|RES)\b/i)?.[0] ?? day.content.slice(0, 40) ?? "Reserve";
    if (day.eventType === "vacation") title = day.content.match(/\b(V\d+|VAC)\b/i)?.[0] ?? day.content.slice(0, 40) ?? "Vacation";
    if (day.eventType === "off") title = "Off";

    const uid = `flica-html-${day.dateStr}-${(day.pairingCode ?? day.eventType).replace(/\s/g, "-")}`;
    const reportTime = day.reportTime ?? undefined;
    const firstLegRoute = day.reportCity ? `${day.reportCity} Rpt` : undefined;

    events.push({
      start: startDate,
      end: endDate,
      title,
      uid,
      reportTime,
      firstLegRoute,
      pairingDays: day.eventType === "trip" && day.pairingCode ? 1 : undefined,
    });
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}
