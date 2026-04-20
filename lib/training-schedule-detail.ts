/**
 * Per-calendar-day training activity labels (ground school, SIM, etc.) from FLICA VEVENT DESCRIPTION.
 * Weekday → date uses the same trip-date spine as leg mapping, in training-station local dates.
 */

import { formatInTimeZone } from "date-fns-tz";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";
import { getTripDateStrings } from "@/lib/leg-dates";
import { addDay } from "@/lib/schedule-time";
import { getTrainingCityIataFromTrainingRow } from "@/lib/schedule/training-city-iata";

const DAY_ABBREVS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function getWeekdayAbbrev(dateStr: string, timezone: string): string {
  const d = new Date(dateStr + "T12:00:00.000Z");
  const dayIdx = parseInt(formatInTimeZone(d, timezone, "i"), 10) % 7;
  return DAY_ABBREVS[dayIdx]!;
}

function isFlightLegLine(trimmed: string): boolean {
  return /^(?:Mo|Tu|We|Th|Fr|Sa|Su)\s+\d{3,5}\b/i.test(trimmed);
}

function padHhmmDigits(hm: number): string {
  const s = String(hm).padStart(4, "0");
  return `${s.slice(0, 2)}:${s.slice(2)}`;
}

function formatRangeLabel(startHm: number, endHm: number): string {
  const sm = Math.floor(startHm / 100) * 60 + (startHm % 100);
  const em = Math.floor(endHm / 100) * 60 + (endHm % 100);
  const overnight = em <= sm;
  const a = padHhmmDigits(startHm);
  const b = padHhmmDigits(endHm);
  return overnight ? `${a}–${b} (+1)` : `${a}–${b}`;
}

/** Last HHMM–HHMM on the line (same idea as SIM end extraction in ics-parse). */
function lastHhmmRangeOnLine(line: string): { a: number; b: number } | null {
  const re = /(\d{3,4})\s*[-–—\u2010\u2011]\s*(\d{3,4})/g;
  let last: { a: number; b: number } | null = null;
  let m;
  while ((m = re.exec(line)) !== null) {
    last = { a: parseInt(m[1], 10), b: parseInt(m[2], 10) };
  }
  return last;
}

/** Two adjacent HHMM tokens (e.g. ground school). */
function twoHhmmTokens(line: string): { a: number; b: number } | null {
  const m = line.match(/\b(\d{3,4})\s+(\d{3,4})\b/);
  if (!m) return null;
  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  const ok = (n: number) => {
    const h = Math.floor(n / 100);
    const mi = n % 100;
    return h >= 0 && h < 24 && mi >= 0 && mi < 60;
  };
  if (!ok(a) || !ok(b)) return null;
  return { a, b };
}

function isPlausibleHhmmToken(n: number): boolean {
  const h = Math.floor(n / 100);
  const m = n % 100;
  return h >= 0 && h < 24 && m >= 0 && m < 60;
}

/** First and last clock with am/pm on the line (e.g. 8am … 5pm). */
function firstLastAmPmOnLine(line: string): { a: number; b: number } | null {
  const re = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi;
  const vals: number[] = [];
  let m;
  while ((m = re.exec(line)) !== null) {
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const ap = m[3].toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    const v = h * 100 + min;
    if (isPlausibleHhmmToken(v)) vals.push(v);
  }
  if (vals.length < 2) return null;
  return { a: vals[0]!, b: vals[vals.length - 1]! };
}

/** e.g. "8am … 1700" or "8:00 … 1700" (one am/pm + trailing military HHMM). */
function firstAmPmLastHhmmLine(line: string): { a: number; b: number } | null {
  const reAmpm = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
  const mAmpm = line.match(reAmpm);
  if (!mAmpm) return null;
  let h = parseInt(mAmpm[1], 10);
  const min = mAmpm[2] ? parseInt(mAmpm[2], 10) : 0;
  const ap = mAmpm[3].toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  const a = h * 100 + min;
  if (!isPlausibleHhmmToken(a)) return null;
  const hhmmMatches = [...line.matchAll(/\b(\d{3,4})\b/g)];
  for (let i = hhmmMatches.length - 1; i >= 0; i--) {
    const n = parseInt(hhmmMatches[i]![1], 10);
    if (isPlausibleHhmmToken(n) && n !== a) {
      return { a, b: n };
    }
  }
  return null;
}

function activityKindFromLine(lower: string): "sim" | "ground" | "other" {
  if (/\bSIM\b/i.test(lower)) return "sim";
  if (
    /\bground\s*school\b/i.test(lower) ||
    /\bground\b/i.test(lower) ||
    /\bgnd\b/i.test(lower) ||
    /\bgrnd\b/i.test(lower) ||
    /\brgs\b/i.test(lower) ||
    /\bgs\b/i.test(lower)
  ) {
    return "ground";
  }
  return "other";
}

function timesForLine(trimmed: string): { a: number; b: number } | null {
  const ranged = lastHhmmRangeOnLine(trimmed);
  if (ranged && isPlausibleHhmmToken(ranged.a) && isPlausibleHhmmToken(ranged.b)) return ranged;
  const paired = twoHhmmTokens(trimmed);
  if (paired) return paired;
  const ampm = firstLastAmPmOnLine(trimmed);
  if (ampm) return ampm;
  const mixed = firstAmPmLastHhmmLine(trimmed);
  if (mixed) return mixed;
  return null;
}

function buildLineSummary(trimmed: string): string | null {
  const lower = trimmed.toLowerCase();
  const kind = activityKindFromLine(lower);
  if (kind === "other") return null;
  const times = timesForLine(trimmed);
  if (kind === "sim" && times) {
    return `SIM · ${formatRangeLabel(times.a, times.b)}`;
  }
  if (kind === "ground" && times) {
    return `Ground school · ${formatRangeLabel(times.a, times.b)}`;
  }
  if (kind === "sim") return "SIM";
  if (kind === "ground") return "Ground school";
  return null;
}

type DayLine = { dayAbbrev: string; summary: string };

function collectTrainingDayLines(rawDesc: string): DayLine[] {
  const raw = rawDesc.replace(/\\n/g, "\n").replace(/\\,/g, ",");
  const out: DayLine[] = [];
  for (const line of raw.split(/\r?\n|\t+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const dm = trimmed.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)\b/i);
    if (!dm) continue;
    if (isFlightLegLine(trimmed)) continue;
    const summary = buildLineSummary(trimmed);
    if (!summary) continue;
    out.push({ dayAbbrev: dm[1]!, summary });
  }
  return out;
}

function assignToTripDates(
  lines: DayLine[],
  tripDateStrs: string[],
  timezone: string
): Record<string, string> {
  const usedCountByWeekday = new Map<string, number>();
  const out: Record<string, string> = {};
  for (const line of lines) {
    const legDayNorm = line.dayAbbrev.slice(0, 2).toLowerCase();
    const datesForWeekday = tripDateStrs.filter(
      (d) => getWeekdayAbbrev(d, timezone).toLowerCase() === legDayNorm
    );
    const usedCount = usedCountByWeekday.get(legDayNorm) ?? 0;
    const idx = Math.min(usedCount, Math.max(0, datesForWeekday.length - 1));
    const ymd = datesForWeekday[idx] ?? null;
    if (!ymd) continue;
    usedCountByWeekday.set(legDayNorm, usedCount + 1);
    const prev = out[ymd];
    out[ymd] = prev ? `${prev}; ${line.summary}` : line.summary;
  }
  return out;
}

/** For overnight SIM, label the next calendar day with end time (e.g. 02:30 release). */
function applyOvernightSimSpill(byDate: Record<string, string>): void {
  for (const ymd of Object.keys(byDate)) {
    const v = byDate[ymd];
    if (!v || !v.includes("SIM ·") || !v.includes("(+1)")) continue;
    const m = v.match(/SIM · \d{2}:\d{2}–(\d{2}:\d{2}) \(\+1\)/);
    if (!m) continue;
    const endClock = m[1]!;
    const next = addDay(ymd);
    const spill = `SIM · until ${endClock}`;
    const existing = byDate[next];
    byDate[next] = existing ? `${spill}; ${existing}` : spill;
  }
}

/**
 * Build map YYYY-MM-DD (training TZ) → short label for schedule popover.
 * Returns null if nothing parseable.
 */
export function buildTrainingScheduleDetail(
  descriptionRaw: string,
  startTimeIso: string,
  endTimeIso: string,
  trainingTimezone: string
): Record<string, string> | null {
  const lines = collectTrainingDayLines(descriptionRaw);
  if (lines.length === 0) return null;
  const tripDateStrs = getTripDateStrings(startTimeIso, endTimeIso, trainingTimezone);
  if (tripDateStrs.length === 0) return null;
  const byDate = assignToTripDates(lines, tripDateStrs, trainingTimezone);
  if (Object.keys(byDate).length === 0) return null;
  applyOvernightSimSpill(byDate);
  return byDate;
}

export type TrainingTzInputLeg = { destination?: string; blockMinutes?: number };

/** Resolve IANA TZ from training legs/route; fallback import source TZ. */
export function trainingTimezoneForParsed(params: {
  legs?: TrainingTzInputLeg[] | null;
  firstLegRoute?: string | null;
  sourceTimezone: string;
}): string {
  const iata = getTrainingCityIataFromTrainingRow(
    {
      event_type: "training",
      legs: params.legs ?? [],
      route: params.firstLegRoute ?? null,
    },
    null
  );
  if (iata && iata.length === 3) {
    try {
      return getTimezoneFromAirport(iata);
    } catch {
      return params.sourceTimezone;
    }
  }
  return params.sourceTimezone;
}
