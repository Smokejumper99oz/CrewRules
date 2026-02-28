/**
 * Minimal ICS parser for schedule import.
 * Extracts VEVENT blocks with DTSTART, DTEND, SUMMARY, UID.
 * Supports TZID and treats floating times (no Z, no TZID) as sourceTimezone.
 * Recurring events (RRULE) are skipped for MVP.
 */

import { fromZonedTime } from "date-fns-tz";

export type ParsedEvent = {
  start: Date;
  end: Date;
  title: string;
  uid: string | null;
  reportTime?: string; // "11:15"
  creditHours?: number; // 4.5
  firstLegRoute?: string; // "SJU-BOS" from legs section
};

export type ParseIcsOptions = {
  /** IANA timezone for floating times (no Z, no TZID). Default America/Denver. */
  sourceTimezone?: string;
};

function unfoldLines(ics: string): string[] {
  return ics
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .reduce<string[]>((acc, line) => {
      if (line.startsWith(" ") || line.startsWith("\t")) {
        if (acc.length) acc[acc.length - 1] += line.slice(1);
        return acc;
      }
      acc.push(line);
      return acc;
    }, []);
}

function decodeIcsText(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\\\/g, "\\");
}

/** Parse ICS property with optional params. Returns { value, tzid? }. */
function getPropertyWithParams(block: string, name: string): { value: string; tzid: string | null } | null {
  const regex = new RegExp(`^${name}((?:;[^:]*)*):(.*)$`, "im");
  const match = block.match(regex);
  if (!match) return null;
  const params = match[1] || "";
  const value = decodeIcsText(match[2].trim());
  let tzid: string | null = null;
  const tzidMatch = params.match(/TZID=([^:;]+)/i);
  if (tzidMatch) tzid = tzidMatch[1].trim();
  return { value, tzid };
}

/** Multi-line property: captures full value when it spans lines. Handles \\n in values and continuation lines. */
function getPropertyMultiline(block: string, name: string): string | null {
  const lines = block.split(/\r?\n/);
  let value: string | null = null;
  let collecting = false;
  const propStart = new RegExp(`^${name}((?:;[^:]*)*):(.*)`, "i");
  const knownProp = /^(BEGIN|END|DTSTART|DTEND|SUMMARY|DESCRIPTION|UID|LOCATION|RRULE|CREATED|LAST-MODIFIED|EXDATE|RDATE|TRANSP|SEQUENCE|STATUS)(?:;[^:]*)*:/i;
  for (const line of lines) {
    const startMatch = line.match(propStart);
    if (startMatch) {
      value = decodeIcsText(startMatch[2]);
      collecting = true;
      continue;
    }
    if (collecting) {
      if (knownProp.test(line.trim())) break;
      value += "\n" + decodeIcsText(line);
    }
  }
  return value?.trim() ?? null;
}

function getProperty(block: string, name: string): string | null {
  const r = getPropertyWithParams(block, name);
  return r?.value ?? null;
}

/** Parse ICS datetime to UTC Date. Handles Z (UTC), TZID, or floating (sourceTimezone). */
function parseIcsDateToUtc(
  value: string,
  opts: { tzid: string | null; sourceTimezone: string }
): Date | null {
  const cleaned = value.trim().replace(/\s/g, "");
  if (cleaned.length < 8) return null;

  const isUtc = cleaned.endsWith("Z") || cleaned.endsWith("z");
  const withoutZ = isUtc ? cleaned.slice(0, -1) : cleaned;

  const year = parseInt(withoutZ.slice(0, 4), 10);
  const month = parseInt(withoutZ.slice(4, 6), 10) - 1;
  const day = parseInt(withoutZ.slice(6, 8), 10);
  let hour = 0,
    min = 0,
    sec = 0;
  if (withoutZ.length >= 15 && withoutZ[8] === "T") {
    hour = parseInt(withoutZ.slice(9, 11), 10) || 0;
    min = parseInt(withoutZ.slice(11, 13), 10) || 0;
    sec = parseInt(withoutZ.slice(13, 15), 10) || 0;
  }
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  if (isUtc) {
    return new Date(Date.UTC(year, month, day, hour, min, sec));
  }

  const tz = opts.tzid ?? opts.sourceTimezone;
  const localStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return fromZonedTime(localStr, tz);
}

function hasRrule(block: string): boolean {
  return /^RRULE(?:;[^:]*)?:/im.test(block);
}

/** Parse DESCRIPTION for Report time, Credit hours, and first leg route. FLICA/airline ICS may include these. */
function parseDescription(desc: string): {
  reportTime?: string;
  creditHours?: number;
  firstLegRoute?: string;
} {
  const result: { reportTime?: string; creditHours?: number; firstLegRoute?: string } = {};
  const raw = desc.replace(/\\n/g, "\n").replace(/\\,/g, ",");
  const normalized = raw.toLowerCase();

  // Report: 11:15, Report 11:15, Report 1115
  const reportMatch = normalized.match(/report\s*:?\s*(\d{1,2}):?(\d{2})/i);
  if (reportMatch) {
    result.reportTime = `${reportMatch[1].padStart(2, "0")}:${reportMatch[2]}`;
  }

  // Pay/Credit patterns: FLICA uses PAY. Also Credit, Total Credit.
  const payHhMm = normalized.match(/\bpay\s*:?\s*(\d{1,2}):?(\d{2})/i);
  const payDecimal = normalized.match(/\bpay\s*:?\s*(\d+(?:[.,]\d+)?)/i);
  const creditHhMm =
    normalized.match(/(?:total\s+)?(?:trip\s+)?credit\s*:?\s*(\d{1,2}):?(\d{2})/i) ??
    normalized.match(/credit\s*:?\s*(\d{1,2}):?(\d{2})/i) ??
    normalized.match(/(\d{1,2}):(\d{2})\s*(?:hrs?|hours?)?\s*credit/i);
  const creditDecimal =
    normalized.match(/(?:total\s+)?(?:trip\s+)?credit\s*:?\s*(\d+(?:[.,]\d+)?)/i) ??
    normalized.match(/credit\s*:?\s*(\d+(?:[.,]\d+)?)/i) ??
    normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:hrs?|hours?)?\s*credit/i) ??
    normalized.match(/(\d+(?:[.,]\d+)?)\s*credit/i);
  if (payHhMm) {
    const h = parseInt(payHhMm[1], 10);
    const m = parseInt(payHhMm[2], 10);
    result.creditHours = h + m / 60;
  } else if (payDecimal) {
    const numStr = payDecimal[1].replace(",", ".");
    const val = parseFloat(numStr);
    result.creditHours = !isNaN(val) && val > 0 ? val : undefined;
  } else if (creditHhMm) {
    const h = parseInt(creditHhMm[1], 10);
    const m = parseInt(creditHhMm[2], 10);
    result.creditHours = h + m / 60;
  } else if (creditDecimal) {
    const numStr = creditDecimal[1].replace(",", ".");
    const val = parseFloat(numStr);
    result.creditHours = !isNaN(val) && val > 0 ? val : undefined;
  }

  // First leg route: scan Dy Flt flight leg lines only (day + flight number, e.g. "Th 3546 Sju-Jfk").
  // Do NOT match header text like "Dy Flt". Pattern: ([A-Za-z]{3})\s*[-→]\s*([A-Za-z]{3})
  const flightLegLine = /^(?:Mo|Tu|We|Th|Fr|Sa|Su)\s+\d{3,5}\b/i;
  const airportPair = /([A-Za-z]{3})\s*[-→–—\/\u2010\u2011]\s*([A-Za-z]{3})/;
  const tryExtractRoute = (text: string): boolean => {
    const m = text.match(airportPair);
    if (m && m[1] && m[2]) {
      const origin = m[1].toUpperCase();
      const dest = m[2].toUpperCase();
      if (origin !== dest && /^[A-Za-z]{3}$/.test(origin) && /^[A-Za-z]{3}$/.test(dest)) {
        result.firstLegRoute = `${origin} → ${dest}`;
        return true;
      }
    }
    return false;
  };
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!flightLegLine.test(trimmed)) continue;
    if (tryExtractRoute(line)) break;
  }
  // Fallback: if DESCRIPTION is one unfolded line (e.g. "Dy Flt Th 3546 Sju-Jfk …"), match day+num+pair
  if (!result.firstLegRoute) {
    const m = raw.match(/(?:Mo|Tu|We|Th|Fr|Sa|Su)\s+\d{3,5}\s+([A-Za-z]{3})\s*[-→–—\/\u2010\u2011]\s*([A-Za-z]{3})/i);
    if (m && m[1] && m[2]) {
      const origin = m[1].toUpperCase();
      const dest = m[2].toUpperCase();
      if (origin !== dest && /^[A-Za-z]{3}$/.test(origin) && /^[A-Za-z]{3}$/.test(dest)) {
        result.firstLegRoute = `${origin} → ${dest}`;
      }
    }
  }

  return result;
}

/** Extract first-leg route (e.g. "SJU → JFK") from text. Used as fallback when DESCRIPTION has none. */
function parseRouteFromText(text: string): string | null {
  const m = text.match(/\b([A-Za-z]{3})\s*[-→–—\/\u2010\u2011]\s*([A-Za-z]{3})\b/i);
  if (m && m[1] && m[2]) {
    const origin = m[1].toUpperCase();
    const dest = m[2].toUpperCase();
    if (origin !== dest && /^[A-Za-z]{3}$/.test(origin) && /^[A-Za-z]{3}$/.test(dest)) {
      return `${origin} → ${dest}`;
    }
  }
  return null;
}

export function parseIcs(icsText: string, options: ParseIcsOptions = {}): ParsedEvent[] {
  const sourceTimezone = options.sourceTimezone ?? "America/Denver";
  const lines = unfoldLines(icsText);
  const events: ParsedEvent[] = [];
  let inEvent = false;
  let currentBlock: string[] = [];

  for (const line of lines) {
    if (/^BEGIN:VEVENT$/i.test(line)) {
      inEvent = true;
      currentBlock = [line];
    } else if (inEvent) {
      currentBlock.push(line);
      if (/^END:VEVENT$/i.test(line)) {
        inEvent = false;
        const block = currentBlock.join("\n");
        if (hasRrule(block)) continue;

        const dtstartRaw = getPropertyWithParams(block, "DTSTART");
        const dtendRaw = getPropertyWithParams(block, "DTEND");
        const summary = getProperty(block, "SUMMARY");
        const description = getPropertyMultiline(block, "DESCRIPTION");
        const location = getProperty(block, "LOCATION");
        const uid = getProperty(block, "UID");

        if (!dtstartRaw?.value) continue;

        const { reportTime, creditHours, firstLegRoute } = parseDescription(description ?? "");
        const routeFromSummary = !firstLegRoute ? parseRouteFromText(summary ?? "") : null;
        const routeFromLocation =
          !firstLegRoute && !routeFromSummary ? parseRouteFromText(location ?? "") : null;
        const start = parseIcsDateToUtc(dtstartRaw.value, {
          tzid: dtstartRaw.tzid,
          sourceTimezone,
        });
        if (!start || isNaN(start.getTime())) continue;

        const end =
          dtendRaw?.value ?
            parseIcsDateToUtc(dtendRaw.value, { tzid: dtendRaw.tzid, sourceTimezone })
          : null;
        const endDate =
          end && !isNaN(end.getTime()) ? end : new Date(start.getTime() + 60 * 60 * 1000);

        events.push({
          start,
          end: endDate,
          title: (summary ?? "").trim() || "Untitled",
          uid: uid?.trim() || null,
          reportTime: reportTime || undefined,
          creditHours: creditHours ?? undefined,
          firstLegRoute: firstLegRoute || routeFromSummary || routeFromLocation || undefined,
        });
      }
    }
  }

  return events;
}
