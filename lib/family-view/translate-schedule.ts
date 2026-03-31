/**
 * Family View translation layer.
 * Converts raw schedule events into plain-English, family-safe display items.
 * No FLICA jargon, credit, pay, or pairing numbers.
 * Honors profile settings: show_exact_times, show_overnight_cities, show_commute_estimates.
 */

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  eventOverlapsDay,
  formatDayLabel,
  addDay,
} from "@/lib/schedule-time";
import {
  getTripDateStrings,
  computeLegDates,
  todayStr,
} from "@/lib/leg-dates";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";
import { isLikelyCommuteDayBefore, getCommuteInfoForTrip, isCommuter } from "./commute-inference";
import type { CommuteInfo } from "./commute-inference";
import type { ScheduleEvent, ScheduleEventLeg } from "@/app/frontier/pilots/portal/schedule/actions";
import type { Profile } from "@/lib/profile";

/** Settings that control Family View output. Derived from profile. */
export type FamilyViewSettings = {
  showExactTimes: boolean;
  showOvernightCities: boolean;
  showCommuteEstimates: boolean;
};

/** Build settings from profile. Defaults match migration defaults. */
export function getFamilyViewSettings(profile: Profile | null): FamilyViewSettings {
  return {
    showExactTimes: profile?.family_view_show_exact_times ?? true,
    showOvernightCities: profile?.family_view_show_overnight_cities ?? true,
    showCommuteEstimates: profile?.family_view_show_commute_estimates ?? true,
  };
}

/** IATA → city name for Family View overnight wording. Fall back to code if missing. */
const IATA_TO_CITY: Record<string, string> = {
  ATL: "Atlanta",
  BOS: "Boston",
  CLE: "Cleveland",
  CLT: "Charlotte",
  CVG: "Cincinnati",
  DEN: "Denver",
  DFW: "Dallas/Fort Worth",
  FLL: "Fort Lauderdale",
  IAH: "Houston",
  LAS: "Las Vegas",
  LAX: "Los Angeles",
  MDW: "Chicago-Midway",
  MIA: "Miami",
  MCO: "Orlando",
  ORD: "Chicago-O'Hare",
  PHL: "Philadelphia",
  PHX: "Phoenix",
  SJU: "San Juan",
  SFO: "San Francisco",
  TPA: "Tampa",
};

function iataToCityName(iata: string): string {
  const code = (iata ?? "").trim().toUpperCase();
  return IATA_TO_CITY[code] ?? code;
}

/** Family-friendly status labels. */
export type FamilyViewStatus =
  | "Day Off"
  | "Vacation"
  | "On Call"
  | "Likely Commuting"
  | "At Work"
  | "Overnight Away"
  | "Expected Home";

export type FamilyViewDayItem = {
  dateStr: string;
  dayLabel: string;
  status: FamilyViewStatus;
  /** Optional detail (e.g. "Overnight in Denver") */
  detail?: string | null;
  /** For trips: report time in 12h format */
  reportTime?: string | null;
};

/** Report time display for dual timezone (base + home when commuter). */
export type ReportTimeDisplay = {
  base: string;
  baseAirport: string | null;
  home: string | null;
  homeLabel: string | null;
};

export type FamilyViewTripSummary = {
  event: ScheduleEvent;
  firstDayLabel: string;
  lastDayLabel: string;
  reportTime: string | null;
  reportTimeDisplay: ReportTimeDisplay | null;
  expectedHomeTime: string | null;
  overnightCities: string[];
  /** Actual overnight count when single overnight city. From leg layovers, not tripDates.length - 1. */
  overnightNightsCount: number;
  commuteInfo: CommuteInfo | null;
};

export type FamilyViewTodayStatus = {
  status: FamilyViewStatus;
  detail?: string | null;
};

/** Map internal status to spouse-friendly display label. */
export function formatStatusForDisplay(status: FamilyViewStatus): string {
  const LABELS: Record<FamilyViewStatus, string> = {
    "Day Off": "Day Off",
    "Vacation": "Time Off",
    "On Call": "On Call",
    "Likely Commuting": "Commute Options",
    "At Work": "Working",
    "Overnight Away": "Away Overnight",
    "Expected Home": "Coming Home",
  };
  return LABELS[status];
}

/** Format time for Family View (always 12h). */
function formatTime12h(isoUtc: string, timezone: string): string {
  try {
    const date = new Date(isoUtc);
    if (isNaN(date.getTime())) return "";
    return formatInTimeZone(date, timezone, "h:mm a");
  } catch {
    return "";
  }
}

/** Format report_time (HH:MM or HHMM) to 12h display (e.g. "7:00 AM"). */
export function formatReportTime12h(reportTime: string | null | undefined): string {
  const min = reportTimeToMinutes(reportTime);
  if (min == null) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Time-of-day labels when exact times are hidden. */
export type TimeOfDayLabel = "morning" | "afternoon" | "evening";

/** Convert minutes since midnight to time-of-day label. Morning < noon, afternoon < 6pm, evening >= 6pm. */
function minutesToTimeOfDay(minutes: number): TimeOfDayLabel {
  if (minutes < 720) return "morning";   // before 12:00
  if (minutes < 1080) return "afternoon"; // 12:00–17:59
  return "evening";                        // 18:00+
}

/** Format report_time to time-of-day when exact times hidden (e.g. "in the morning"). */
export function formatReportTimeOfDay(reportTime: string | null | undefined): string {
  const min = reportTimeToMinutes(reportTime);
  if (min == null) return "";
  const tod = minutesToTimeOfDay(min);
  return `in the ${tod}`;
}

/** Format ISO UTC to time-of-day when exact times hidden (e.g. "sometime in the evening"). */
function formatIsoToTimeOfDay(isoUtc: string, timezone: string): string {
  try {
    const date = new Date(isoUtc);
    if (isNaN(date.getTime())) return "";
    const h = parseInt(formatInTimeZone(date, timezone, "HH"), 10);
    const m = parseInt(formatInTimeZone(date, timezone, "mm"), 10);
    const min = h * 60 + m;
    const tod = minutesToTimeOfDay(min);
    return `sometime in the ${tod}`;
  } catch {
    return "";
  }
}

/** Format report time for display: exact ("at 7:00 AM") or time-of-day ("in the morning") based on settings. */
export function formatReportTimeForDisplay(
  reportTime: string | null | undefined,
  settings: FamilyViewSettings
): string {
  if (settings.showExactTimes) {
    const exact = formatReportTime12h(reportTime);
    return exact ? `at ${exact}` : "";
  }
  return formatReportTimeOfDay(reportTime);
}

/** Format expected home time for display: exact or time-of-day based on settings. */
export function formatExpectedHomeForDisplay(
  isoUtc: string,
  timezone: string,
  settings: FamilyViewSettings
): string {
  if (settings.showExactTimes) {
    try {
      const date = new Date(isoUtc);
      if (isNaN(date.getTime())) return "";
      const h = parseInt(formatInTimeZone(date, timezone, "HH"), 10);
      const m = parseInt(formatInTimeZone(date, timezone, "mm"), 10);
      const min = h * 60 + m;
      // 12:00 AM – 4:59 AM: use "early [weekday] morning" instead of "around 12:44 AM"
      if (min >= 0 && min < 300) {
        const weekday = formatInTimeZone(date, timezone, "EEEE");
        return `early ${weekday} morning`;
      }
      const exact = formatTime12h(isoUtc, timezone);
      return exact ? `around ${exact}` : "";
    } catch {
      return "";
    }
  }
  return formatIsoToTimeOfDay(isoUtc, timezone);
}

/** Parse report_time (HH:MM or HHMM) to minutes since midnight. Returns null if invalid. */
function reportTimeToMinutes(reportTime: string | undefined | null): number | null {
  if (!reportTime?.trim()) return null;
  const s = reportTime.trim().replace(":", "");
  if (!/^\d{3,4}$/.test(s)) return null;
  const h = parseInt(s.slice(0, -2) || "0", 10);
  const m = parseInt(s.slice(-2), 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}


export type OvernightCitiesAndNights = {
  overnightCities: string[];
  /** Nights per city (key = city display name). Used when single overnight city. */
  nightsByCity: Record<string, number>;
};

/**
 * Get overnight cities and actual overnight counts from trip legs.
 * An overnight = layover where we arrive on date X and next leg departs on date Y with Y > X.
 */
function getOvernightCitiesAndNightsFromLegs(
  legs: ScheduleEventLeg[],
  tripDateStrs: string[],
  timezone: string
): OvernightCitiesAndNights {
  const overnightCities: string[] = [];
  const nightsByCity: Record<string, number> = {};

  if (legs.length < 2) return { overnightCities, nightsByCity };

  const legDates = computeLegDates(legs, tripDateStrs, timezone);

  for (let i = 0; i < legs.length - 1; i++) {
    const curr = legDates[i];
    const next = legDates[i + 1];
    if (!curr?.leg?.destination || !curr.arrivalDate || !next?.departureDate) continue;

    const destIata = curr.leg.destination.trim().toUpperCase();
    const nextOrigin = (next.leg as { origin?: string }).origin?.trim().toUpperCase();
    if (!destIata || destIata !== nextOrigin) continue;

    const arrDate = curr.arrivalDate;
    const depDate = next.departureDate;
    if (arrDate >= depDate) continue;

    let nights = 0;
    let cur = arrDate;
    while (cur < depDate) {
      nights++;
      cur = addDay(cur);
    }

    const cityName = iataToCityName(destIata);
    if (nights > 0) {
      nightsByCity[cityName] = (nightsByCity[cityName] ?? 0) + nights;
      if (!overnightCities.includes(cityName)) overnightCities.push(cityName);
    }
  }

  return { overnightCities, nightsByCity };
}

/** Filter events to non-muted only. (Caller already filters by source.) */
function filterScheduleEvents(events: ScheduleEvent[]): ScheduleEvent[] {
  return events.filter((e) => e.is_muted !== true);
}

/** Get primary status for a single day from overlapping events. */
function getStatusForDay(
  dateStr: string,
  dayDate: Date,
  events: ScheduleEvent[],
  profile: Profile | null,
  baseTimezone: string,
  settings: FamilyViewSettings
): FamilyViewDayItem {
  const dayLabel = formatDayLabel(`${dateStr}T12:00:00.000Z`, baseTimezone);

  // Check for "Likely Commuting" (day before first duty, commuter, early report) — only if commute estimates enabled
  if (settings.showCommuteEstimates) {
    for (const ev of events) {
      if (ev.event_type !== "trip") continue;
      const note = isLikelyCommuteDayBefore(ev, dateStr, profile, baseTimezone);
      if (note) {
        return { dateStr, dayLabel, status: "Likely Commuting", detail: note };
      }
    }
  }

  // Find overlapping work events (trip, reserve) and vacation/off
  const overlapping = events.filter((e) =>
    eventOverlapsDay(e.start_time, e.end_time, dayDate, baseTimezone)
  );
  const workEvents = overlapping.filter((e) => e.event_type === "trip" || e.event_type === "reserve");
  const vacationOff = overlapping.filter((e) => e.event_type === "vacation" || e.event_type === "off");

  // Prefer work over vacation/off when both exist
  const primary = workEvents.length > 0 ? workEvents[0] : vacationOff[0];

  if (!primary) {
    return { dateStr, dayLabel, status: "Day Off" };
  }

  if (primary.event_type === "vacation") {
    return { dateStr, dayLabel, status: "Vacation" };
  }
  if (primary.event_type === "off") {
    return { dateStr, dayLabel, status: "Day Off" };
  }
  if (primary.event_type === "reserve") {
    return { dateStr, dayLabel, status: "On Call" };
  }

  // Trip: determine if first day, middle, or last day
  const tripDates = getTripDateStrings(primary.start_time, primary.end_time, baseTimezone);
  const isFirstDay = tripDates[0] === dateStr;
  const isLastDay = tripDates[tripDates.length - 1] === dateStr;

  if (isLastDay) {
    const legs = primary.legs ?? [];
    let shortTurnaroundAway: FamilyViewDayItem | null = null;
    if (legs.length > 0 && tripDates.length > 0) {
      const legDates = computeLegDates(legs, tripDates, baseTimezone);
      const arrivalsOnDay = legDates.filter((ld) => ld.arrivalDate === dateStr);
      const lastArrEntry =
        arrivalsOnDay.length > 0 ? arrivalsOnDay[arrivalsOnDay.length - 1]! : null;
      const lastLeg = lastArrEntry?.leg as ScheduleEventLeg | undefined;
      const lastArrivalIata =
        (lastLeg?.destination ?? "").trim().toUpperCase() || null;
      const arrivalDateStr = lastArrEntry?.arrivalDate ?? null;
      const lastArrivalIso =
        lastLeg?.arrTime && arrivalDateStr
          ? reportTimeToIsoUtc(lastLeg.arrTime, arrivalDateStr, baseTimezone)
          : null;

      const nextTrips = events
        .filter(
          (e) => e.event_type === "trip" && e.start_time > primary.end_time
        )
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
      const nextTrip = nextTrips[0];
      const nextFirstLeg = nextTrip?.legs?.[0] as ScheduleEventLeg | undefined;
      const nextReportIata = (nextFirstLeg?.origin ?? "").trim().toUpperCase() || null;

      const nextTripDates =
        nextTrip
          ? getTripDateStrings(nextTrip.start_time, nextTrip.end_time, baseTimezone)
          : [];
      const nextFirstDutyDate = nextTripDates[0];
      const nextReportIso =
        nextTrip?.report_time && nextFirstDutyDate
          ? reportTimeToIsoUtc(nextTrip.report_time, nextFirstDutyDate, baseTimezone)
          : null;

      if (
        lastArrivalIso &&
        nextReportIso &&
        lastArrivalIata &&
        nextReportIata &&
        lastArrivalIata === nextReportIata
      ) {
        const lastArrDate = new Date(lastArrivalIso);
        const nextRepDate = new Date(nextReportIso);
        const gapMs = nextRepDate.getTime() - lastArrDate.getTime();
        const sameDay =
          formatInTimeZone(lastArrDate, baseTimezone, "yyyy-MM-dd") ===
          formatInTimeZone(nextRepDate, baseTimezone, "yyyy-MM-dd");
        const under18h =
          gapMs >= 0 && gapMs < 18 * 60 * 60 * 1000;
        const shortGap = sameDay || under18h;

        if (shortGap) {
          const cityLabel = iataToCityName(lastArrivalIata);
          const landedTime = settings.showExactTimes
            ? formatTime12h(lastArrivalIso, baseTimezone)
            : formatIsoToTimeOfDay(lastArrivalIso, baseTimezone);
          const nextReportTime = settings.showExactTimes
            ? formatReportTime12h(nextTrip!.report_time)
            : formatReportTimeOfDay(nextTrip!.report_time);
          if (landedTime && nextReportTime) {
            shortTurnaroundAway = {
              dateStr,
              dayLabel,
              status: "Overnight Away",
              detail: `Landed ${cityLabel} ${landedTime} • Next report ${nextReportTime} • Likely staying in base`,
              reportTime: null,
            };
          }
        }
      }
    }

    if (shortTurnaroundAway) {
      return shortTurnaroundAway;
    }

    const detail = formatExpectedHomeForDisplay(primary.end_time, baseTimezone, settings);
    return {
      dateStr,
      dayLabel,
      status: "Expected Home",
      detail: detail || null,
      reportTime: null,
    };
  }

  if (isFirstDay) {
    return {
      dateStr,
      dayLabel,
      status: "At Work",
      reportTime: primary.report_time ?? null,
    };
  }

  // Middle day: show overnight city (where we arrived this day) — only if overnight cities enabled
  let overnightCity: string | null = null;
  if (settings.showOvernightCities) {
    const legs = primary.legs ?? [];
    if (legs.length > 0 && tripDates.length > 0) {
      const legDates = computeLegDates(legs, tripDates, baseTimezone);
      const arrivals = legDates.filter((ld) => ld.arrivalDate === dateStr);
      if (arrivals.length > 0) {
        const last = arrivals[arrivals.length - 1];
        overnightCity = (last!.leg as ScheduleEventLeg).destination?.trim() ?? null;
      }
    }
  }
  return {
    dateStr,
    dayLabel,
    status: "Overnight Away",
    detail: overnightCity ? `in ${iataToCityName(overnightCity)}` : null,
  };
}

/** Get today's status for Family View. */
export function getTodayStatus(
  events: ScheduleEvent[],
  profile: Profile | null,
  baseTimezone: string,
  settings: FamilyViewSettings
): FamilyViewTodayStatus {
  const filtered = filterScheduleEvents(events);
  const today = todayStr(baseTimezone);
  const [y, m, d] = today.split("-").map(Number);
  const dayDate = new Date(y, m - 1, d);

  const item = getStatusForDay(today, dayDate, filtered, profile, baseTimezone, settings);
  return { status: item.status, detail: item.detail };
}

/** Build report datetime from report_time (HH:MM/HHMM) and dateStr in given timezone. */
function reportTimeToIsoUtc(reportTime: string, dateStr: string, timezone: string): string | null {
  const min = reportTimeToMinutes(reportTime);
  if (min == null) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  const timePart = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000`;
  try {
    const date = fromZonedTime(`${dateStr}T${timePart}`, timezone);
    return date.toISOString();
  } catch {
    return null;
  }
}

/** Build ReportTimeDisplay for dual timezone when commuter and timezones differ. */
function buildReportTimeDisplay(
  reportTime: string,
  firstDutyDateStr: string,
  baseTimezone: string,
  homeTimezone: string,
  baseAirport: string | null,
  homeAirport: string | null,
  settings: FamilyViewSettings
): ReportTimeDisplay | null {
  const isoUtc = reportTimeToIsoUtc(reportTime, firstDutyDateStr, baseTimezone);
  if (!isoUtc) return null;

  if (settings.showExactTimes) {
    const baseTime = formatTime12h(isoUtc, baseTimezone);
    const homeTime = formatTime12h(isoUtc, homeTimezone);
    const baseWithAirport = baseAirport ? `${baseTime} ${baseAirport}` : baseTime;
    const base = `at ${baseWithAirport}`;
    const showHome = baseTime !== homeTime;
    const homeLabel = showHome && homeAirport ? iataToCityName(homeAirport) : null;
    return {
      base,
      baseAirport,
      home: showHome ? homeTime : null,
      homeLabel: showHome ? homeLabel : null,
    };
  }
  const base = formatReportTimeForDisplay(reportTime, settings);
  return { base, baseAirport: null, home: null, homeLabel: null };
}

/** Get next work trip summary for Family View. */
export function getNextTripSummary(
  events: ScheduleEvent[],
  profile: Profile | null,
  baseTimezone: string,
  settings: FamilyViewSettings
): FamilyViewTripSummary | null {
  const filtered = filterScheduleEvents(events);
  const now = new Date().toISOString();

  const upcomingTrips = filtered
    .filter((e) => e.event_type === "trip" && e.end_time > now)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const next = upcomingTrips[0];
  if (!next) return null;

  const tripDates = getTripDateStrings(next.start_time, next.end_time, baseTimezone);
  const firstDayLabel = formatDayLabel(`${tripDates[0]}T12:00:00.000Z`, baseTimezone);
  const lastDayLabel = formatDayLabel(`${tripDates[tripDates.length - 1]}T12:00:00.000Z`, baseTimezone);
  const reportTime = next.report_time ?? null;
  const expectedHomeTime = formatExpectedHomeForDisplay(next.end_time, baseTimezone, settings);
  const baseIata = (profile?.base_airport ?? "").trim().toUpperCase();
  const homeIata = (profile?.home_airport ?? "").trim().toUpperCase();

  let overnightCities: string[] = [];
  let overnightNightsCount = 0;
  if (settings.showOvernightCities && next.legs?.length) {
    const { overnightCities: rawCities, nightsByCity } = getOvernightCitiesAndNightsFromLegs(
      next.legs,
      tripDates,
      baseTimezone
    );
    overnightCities = rawCities.filter(
      (cityName) =>
        cityName !== iataToCityName(baseIata) && cityName !== iataToCityName(homeIata)
    );
    overnightNightsCount =
      overnightCities.length === 1 ? (nightsByCity[overnightCities[0]] ?? 0) : 0;
  }

  const commuteInfo =
    settings.showCommuteEstimates ? getCommuteInfoForTrip(next, profile, baseTimezone) : null;

  const baseAirport = (profile?.base_airport ?? "").trim() || null;
  const homeAirport = (profile?.home_airport ?? "").trim() || null;
  const homeTimezone = profile?.home_airport
    ? getTimezoneFromAirport(profile.home_airport)
    : baseTimezone;
  const reportTimeDisplay =
    reportTime && settings.showExactTimes && isCommuter(profile) && baseTimezone !== homeTimezone
      ? buildReportTimeDisplay(
          reportTime,
          tripDates[0],
          baseTimezone,
          homeTimezone,
          baseAirport,
          homeAirport,
          settings
        )
      : reportTime
        ? {
            base: formatReportTimeForDisplay(reportTime, settings),
            baseAirport: null,
            home: null,
            homeLabel: null,
          }
        : null;

  return {
    event: next,
    firstDayLabel,
    lastDayLabel,
    reportTime,
    reportTimeDisplay,
    expectedHomeTime: expectedHomeTime || null,
    overnightCities,
    overnightNightsCount,
    commuteInfo,
  };
}

/** Get day-by-day items for "This Week" (next 7 days including today). */
export function getThisWeekDays(
  events: ScheduleEvent[],
  profile: Profile | null,
  baseTimezone: string,
  settings: FamilyViewSettings
): FamilyViewDayItem[] {
  const filtered = filterScheduleEvents(events);
  let cur = todayStr(baseTimezone);
  const result: FamilyViewDayItem[] = [];

  for (let i = 0; i < 7; i++) {
    const [y, m, d] = cur.split("-").map(Number);
    const dayDate = new Date(y, m - 1, d);
    result.push(getStatusForDay(cur, dayDate, filtered, profile, baseTimezone, settings));
    cur = addDay(cur);
  }

  return result;
}

/** Get upcoming work blocks (trips + reserve) for Family View. */
export function getUpcomingBlocks(
  events: ScheduleEvent[],
  profile: Profile | null,
  baseTimezone: string,
  settings: FamilyViewSettings,
  limit = 5
): FamilyViewDayItem[] {
  const filtered = filterScheduleEvents(events);
  const now = new Date().toISOString();

  const upcoming = filtered
    .filter((e) => (e.event_type === "trip" || e.event_type === "reserve") && e.start_time > now)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .slice(0, limit);

  const result: FamilyViewDayItem[] = [];
  const seenDates = new Set<string>();

  for (const ev of upcoming) {
    const tripDates =
      ev.event_type === "trip"
        ? getTripDateStrings(ev.start_time, ev.end_time, baseTimezone)
        : [formatInTimeZone(new Date(ev.start_time), baseTimezone, "yyyy-MM-dd")];

    for (const dateStr of tripDates) {
      if (seenDates.has(dateStr)) continue;
      seenDates.add(dateStr);
      const [y, m, d] = dateStr.split("-").map(Number);
      const dayDate = new Date(y, m - 1, d);
      result.push(getStatusForDay(dateStr, dayDate, filtered, profile, baseTimezone, settings));
      if (result.length >= limit) break;
    }
    if (result.length >= limit) break;
  }

  return result;
}
