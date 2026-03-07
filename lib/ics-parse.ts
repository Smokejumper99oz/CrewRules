/**
 * Minimal ICS parser for schedule import.
 * Extracts VEVENT blocks with DTSTART, DTEND, SUMMARY, UID.
 * Supports TZID and treats floating times (no Z, no TZID) as sourceTimezone.
 * Recurring events (RRULE) are skipped for MVP.
 */

import { fromZonedTime } from "date-fns-tz";

export type ParsedLeg = {
  day?: string;
  flightNumber?: string;
  origin: string;
  destination: string;
  depTime?: string;
  arrTime?: string;
  blockMinutes?: number;
  raw?: string;
};

export type ParsedEvent = {
  start: Date;
  end: Date;
  title: string;
  uid: string | null;
  reportTime?: string;
  /** Credit/pay in minutes (HHMM→minutes, e.g. 0812→492). Stored, not decimal. */
  creditMinutes?: number;
  firstLegRoute?: string;
  firstLegDepartureTime?: string;
  pairingDays?: number;
  blockMinutes?: number;
  legs?: ParsedLeg[];
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

/** Parse DESCRIPTION for Report time, Credit, route, pairing_days, block, legs. FLICA/airline ICS. */
function parseDescription(desc: string): {
  reportTime?: string;
  creditMinutes?: number;
  firstLegRoute?: string;
  firstLegDepartureTime?: string;
  pairingDays?: number;
  blockMinutes?: number;
  legs?: ParsedLeg[];
} {
  const result: {
    reportTime?: string;
    creditMinutes?: number;
    firstLegRoute?: string;
    firstLegDepartureTime?: string;
    pairingDays?: number;
    blockMinutes?: number;
    legs?: ParsedLeg[];
  } = {};
  const raw = desc.replace(/\\n/g, "\n").replace(/\\,/g, ",");
  const normalized = raw.toLowerCase();

  // Report: 11:15, Report 11:15, Report 1115, Check In: 07:50
  const reportMatch = normalized.match(/(?:report|check\s+in)\s*:?\s*(\d{1,2}):?(\d{2})/i);
  if (reportMatch) {
    result.reportTime = `${reportMatch[1].padStart(2, "0")}:${reportMatch[2]}`;
  }

  // HHMM → minutes (0812 → 8*60+12, 2114 → 21*60+14). Store minutes, not decimal hours.
  const hhmmToMinutes = (n: number) => Math.floor(n / 100) * 60 + (n % 100);

  // FLICA totals line: "Blk: 2114 TAFB: 8102 Pay: 2309"
  // Blk = block time (21:14), Pay = credit (23:09). Ignore TAFB (Total Away From Base).
  const blkMatch = raw.match(/\bblk\s*:?\s*(\d{3,4})\b/i);
  const payMatch = raw.match(/\bpay\s*:?\s*(\d{3,4})\b/i);
  if (payMatch) {
    const v = parseInt(payMatch[1], 10);
    const min = hhmmToMinutes(v);
    if (min > 0 && min < 60000) result.creditMinutes = min;
  }
  if (blkMatch) {
    const v = parseInt(blkMatch[1], 10);
    const min = hhmmToMinutes(v);
    if (min >= 0 && min < 60000) result.blockMinutes = min;
  }

  // FLICA TBLK/TCRD (multi-day): 2114 → 21*60+14, 2309 → 23*60+9
  const tcrdMatch = !result.creditMinutes && raw.match(/\btcrd\s*:?\s*(\d{3,5})\b/i);
  const tblkMatch = !result.blockMinutes && raw.match(/\btblk\s*:?\s*(\d{3,5})\b/i);
  const totalBlockMatch = !result.blockMinutes && raw.match(/(?:total\s+)?block\s*:?\s*(\d{3,5})\b/i);
  if (tcrdMatch) {
    const v = parseInt(tcrdMatch[1], 10);
    const min = hhmmToMinutes(v);
    if (min > 0 && min < 60000) result.creditMinutes = min;
  }
  if (tblkMatch || totalBlockMatch) {
    const m = tblkMatch ?? totalBlockMatch;
    if (m) {
      const v = parseInt(m[1], 10);
      const min = hhmmToMinutes(v);
      if (min >= 0 && min < 60000) result.blockMinutes = min;
    }
  }

  // Pay/Credit fallbacks (when no Blk/Pay/TCRD HHMM): H:MM or decimal → creditMinutes
  const payHhMm = !result.creditMinutes && normalized.match(/\bpay\s*:?\s*(\d{1,2}):?(\d{2})/i);
  const payDecimal = !result.creditMinutes && normalized.match(/\bpay\s*:?\s*(\d+(?:[.,]\d+)?)/i);
  const creditHhMm = !result.creditMinutes
    ? (normalized.match(/(?:total\s+)?(?:trip\s+)?credit\s*:?\s*(\d{1,2}):?(\d{2})/i) ??
        normalized.match(/credit\s*:?\s*(\d{1,2}):?(\d{2})/i) ??
        normalized.match(/(\d{1,2}):(\d{2})\s*(?:hrs?|hours?)?\s*credit/i))
    : null;
  const creditDecimal =
    !result.creditMinutes &&
    (normalized.match(/(?:total\s+)?(?:trip\s+)?credit\s*:?\s*(\d+(?:[.,]\d+)?)/i) ??
      normalized.match(/credit\s*:?\s*(\d+(?:[.,]\d+)?)/i) ??
      normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:hrs?|hours?)?\s*credit/i) ??
      normalized.match(/(\d+(?:[.,]\d+)?)\s*credit/i));
  if (payHhMm) {
    const h = parseInt(payHhMm[1], 10);
    const m = parseInt(payHhMm[2], 10);
    result.creditMinutes = h * 60 + m;
  } else if (payDecimal) {
    const numStr = payDecimal[1].replace(",", ".");
    const val = parseFloat(numStr);
    if (!isNaN(val) && val > 0 && val < 999) result.creditMinutes = Math.round(val * 60);
  } else if (creditHhMm) {
    const h = parseInt(creditHhMm[1], 10);
    const m = parseInt(creditHhMm[2], 10);
    result.creditMinutes = h * 60 + m;
  } else if (creditDecimal) {
    const numStr = creditDecimal[1].replace(",", ".");
    const val = parseFloat(numStr);
    if (!isNaN(val) && val > 0 && val < 999) result.creditMinutes = Math.round(val * 60);
  }

  // First leg route and pairing_days: scan Dy Flt flight leg lines only (day + flight number).
  const flightLegLine = /^(?:Mo|Tu|We|Th|Fr|Sa|Su)\s+\d{3,5}\b/i;
  const airportPair = /([A-Za-z]{3})\s*[-→–—\/\u2010\u2011]\s*([A-Za-z]{3})/;
  const legLines: string[] = [];
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
  const dutyDays = new Set<string>();
  // Split by newlines or tabs (FLICA folds DESCRIPTION; tabs or double-tabs separate leg lines)
  for (const line of raw.split(/\r?\n|\t+/)) {
    const trimmed = line.trim();
    if (!flightLegLine.test(trimmed)) continue;
    legLines.push(line);
    if (!result.firstLegRoute) tryExtractRoute(line);
    const dayMatch = trimmed.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)/i);
    if (dayMatch) dutyDays.add(dayMatch[1].toLowerCase());
  }
  result.pairingDays = dutyDays.size > 0 ? Math.min(dutyDays.size, 31) : (legLines.length > 0 ? Math.min(legLines.length, 31) : undefined);

  // Parse each leg into structured format: "Th 3546 Sju-Jfk 0850 1204 0414"
  const legs: ParsedLeg[] = [];
  for (const line of legLines) {
    const trimmed = line.trim();
    const dayMatch = trimmed.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)/i);
    const day = dayMatch ? dayMatch[1] : undefined;
    const flightMatch = trimmed.match(/^(?:Mo|Tu|We|Th|Fr|Sa|Su)\s+(\d{3,5})\b/i);
    const flightNumber = flightMatch ? flightMatch[1] : undefined;
    const routeMatch = trimmed.match(airportPair);
    const depArrBlock = trimmed.match(/(\d{3,4})\s+(\d{3,4})\s+(\d{3,4})\s*$/);
    const depArrOnly = !depArrBlock && trimmed.match(/(\d{3,4})\s+(\d{3,4})\s*$/);
    let origin = "";
    let destination = "";
    if (routeMatch && routeMatch[1] && routeMatch[2]) {
      origin = routeMatch[1].toUpperCase();
      destination = routeMatch[2].toUpperCase();
      if (origin === destination || !/^[A-Za-z]{3}$/.test(origin) || !/^[A-Za-z]{3}$/.test(destination)) continue;
    } else continue;
    let depTime: string | undefined;
    let arrTime: string | undefined;
    let blockMinutes: number | undefined;
    if (depArrBlock) {
      let dep = depArrBlock[1];
      if (dep.length === 3) dep = dep.padStart(4, "0");
      depTime = `${dep.slice(0, 2)}:${dep.slice(2)}`;
      let arr = depArrBlock[2];
      if (arr.length === 3) arr = arr.padStart(4, "0");
      arrTime = `${arr.slice(0, 2)}:${arr.slice(2)}`;
      blockMinutes = hhmmToMinutes(parseInt(depArrBlock[3], 10));
    } else if (depArrOnly && depArrOnly[1] && depArrOnly[2]) {
      let dep = depArrOnly[1];
      if (dep.length === 3) dep = dep.padStart(4, "0");
      depTime = `${dep.slice(0, 2)}:${dep.slice(2)}`;
      let arr = depArrOnly[2];
      if (arr.length === 3) arr = arr.padStart(4, "0");
      arrTime = `${arr.slice(0, 2)}:${arr.slice(2)}`;
    }
    legs.push({ day, flightNumber, origin, destination, depTime, arrTime, blockMinutes, raw: trimmed });
  }
  if (legs.length > 0) result.legs = legs;

  // First leg departure time: "Th 3546 Sju-Jfk 0850 1204 0414" → dep=0850 → "08:50"
  for (const leg of legLines) {
    if (result.firstLegDepartureTime) break;
    const depArrBlock = leg.match(/(\d{3,4})\s+(\d{3,4})\s+(\d{3,4})\s*$/);
    if (depArrBlock) {
      let dep = depArrBlock[1];
      if (dep.length === 3) dep = dep.padStart(4, "0");
      result.firstLegDepartureTime = `${dep.slice(0, 2)}:${dep.slice(2)}`;
    }
  }

  // Fallback route: if DESCRIPTION is one unfolded line
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

  // Block minutes fallback (TBLK already parsed above): "Block: 2:20", leg sum
  const MAX_BLOCK_MINUTES = 24 * 60 * 14; // 14 days max
  if (!result.blockMinutes) {
    const blockHhMm = normalized.match(/\bblock\s*:?\s*(\d{1,2}):?(\d{2})/i);
    const blockDecimal = normalized.match(/\bblock\s*:?\s*(\d+(?:[.,]\d+)?)/i);
    if (blockHhMm) {
      const m = parseInt(blockHhMm[1], 10) * 60 + parseInt(blockHhMm[2], 10);
      result.blockMinutes = Math.min(Math.max(0, m), MAX_BLOCK_MINUTES);
    } else if (blockDecimal) {
      const h = parseFloat(blockDecimal[1].replace(",", "."));
      if (!isNaN(h) && h >= 0 && h <= 336) result.blockMinutes = Math.min(Math.round(h * 60), MAX_BLOCK_MINUTES);
    } else {
      let totalBlock = 0;
      for (const leg of legLines) {
        // Leg format: "Th 3546 Sju-Jfk 0850 1204 0414" (dep, arr, block in HHMM)
        const depArrBlock = leg.match(/(\d{3,4})\s+(\d{3,4})\s+(\d{3,4})\s*$/);
        if (depArrBlock) {
          const blockHhmm = parseInt(depArrBlock[3], 10);
          totalBlock += hhmmToMinutes(blockHhmm);
        } else {
          const depArr = leg.match(/(\d{3,4})\s+(\d{3,4})\s*$/);
          if (depArr) {
            const dep = parseInt(depArr[1], 10);
            const arr = parseInt(depArr[2], 10);
            const depMin = hhmmToMinutes(dep);
            const arrMin = hhmmToMinutes(arr);
            let block = arrMin - depMin;
            if (block < 0) block += 24 * 60;
            totalBlock += block;
          }
        }
      }
      if (totalBlock > 0) result.blockMinutes = Math.min(totalBlock, MAX_BLOCK_MINUTES);
    }
  }

  return result;
}

/** Extract credit/pay hours from text. Used for SUMMARY, COMMENT, or fallback. */
function parseCreditFromText(text: string): number | null {
  if (!text?.trim()) return null;
  const t = text.trim();
  const payOrCredit =
    t.match(/\b(?:pay|credit)\s*:?\s*(\d{1,2}):?(\d{2})\b/i) ??
    t.match(/\b(?:pay|credit)\s*:?\s*(\d+(?:[.,]\d+)?)\b/i) ??
    t.match(/\b(\d{1,2}):(\d{2})\s*(?:hrs?)?\s*(?:pay|credit)\b/i) ??
    t.match(/\b(\d+(?:[.,]\d+)?)\s*(?:hrs?)?\s*(?:pay|credit)\b/i);
  if (payOrCredit) {
    if (payOrCredit[2] && /^\d{2}$/.test(payOrCredit[2])) {
      const h = parseInt(payOrCredit[1], 10);
      const m = parseInt(payOrCredit[2], 10);
      return h + m / 60;
    }
    const num = parseFloat((payOrCredit[1] ?? "").replace(",", "."));
    return !isNaN(num) && num > 0 && num < 999 ? num : null;
  }
  const standalone = t.match(/\b(\d{1,2}):(\d{2})\b/);
  if (standalone) {
    const h = parseInt(standalone[1], 10);
    const m = parseInt(standalone[2], 10);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return h + m / 60;
  }
  const decimal = t.match(/\b(\d{1,2}\.\d{2})\b/);
  if (decimal) {
    const v = parseFloat(decimal[1]);
    if (v > 0 && v < 999) return v;
  }
  return null;
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
        const comment = getPropertyMultiline(block, "COMMENT");
        const location = getProperty(block, "LOCATION");
        const uid = getProperty(block, "UID");

        if (!dtstartRaw?.value) continue;

        const { reportTime, creditMinutes, firstLegRoute, firstLegDepartureTime, pairingDays, blockMinutes, legs } =
          parseDescription(description ?? "");
        if (process.env.NODE_ENV === "development" && (summary ?? "").includes("S3090") && (!legs || legs.length === 0)) {
          console.log("[ICS parse] S3090 DESCRIPTION (legs=0)", {
            summary,
            descriptionLength: (description ?? "").length,
            descriptionPreview: (description ?? "").slice(0, 500),
            descriptionFull: description ?? "",
          });
        }
        const creditFromSummary = !creditMinutes ? parseCreditFromText(summary ?? "") : null;
        const creditFromComment = !creditMinutes && !creditFromSummary ? parseCreditFromText(comment ?? "") : null;
        const resolvedCreditMinutes =
          creditMinutes ??
          (creditFromSummary != null ? Math.round(creditFromSummary * 60) : undefined) ??
          (creditFromComment != null ? Math.round(creditFromComment * 60) : undefined);
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
          creditMinutes: resolvedCreditMinutes,
          firstLegRoute: firstLegRoute || routeFromSummary || routeFromLocation || undefined,
          firstLegDepartureTime: firstLegDepartureTime ?? undefined,
          pairingDays: pairingDays ?? undefined,
          blockMinutes: blockMinutes ?? undefined,
          legs: legs ?? undefined,
        });
      }
    }
  }

  return events;
}
