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
import { TENANT_CONFIG } from "@/lib/tenant-config";
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

/** IATA/ICAO → plain-English city name for Family View. */
const IATA_TO_CITY: Record<string, string> = {
  // Northeast
  BDL: "Hartford, CT",
  BOS: "Boston, MA",
  BUF: "Buffalo, NY",
  EWR: "Newark, NJ",
  HPN: "White Plains, NY",
  JFK: "New York City, NY",
  LGA: "New York City, NY",
  MHT: "Manchester, NH",
  PHL: "Philadelphia, PA",
  PIT: "Pittsburgh, PA",
  PVD: "Providence, RI",
  SYR: "Syracuse, NY",

  // Mid-Atlantic
  BWI: "Baltimore, MD",
  DCA: "Washington, D.C.",
  IAD: "Washington, D.C.",
  RIC: "Richmond, VA",

  // Southeast
  ATL: "Atlanta, GA",
  CHS: "Charleston, SC",
  CLT: "Charlotte, NC",
  FLL: "Fort Lauderdale, FL",
  JAX: "Jacksonville, FL",
  MIA: "Miami, FL",
  MCO: "Orlando, FL",
  PBI: "West Palm Beach, FL",
  RDU: "Raleigh, NC",
  RSW: "Fort Myers, FL",
  SFB: "Sanford, FL",
  TPA: "Tampa, FL",

  // Midwest
  CLE: "Cleveland, OH",
  CVG: "Cincinnati, OH",
  DSM: "Des Moines, IA",
  DTW: "Detroit, MI",
  GRR: "Grand Rapids, MI",
  IND: "Indianapolis, IN",
  MCI: "Kansas City, MO",
  MDW: "Chicago, IL",
  MKE: "Milwaukee, WI",
  MSP: "Minneapolis, MN",
  OMA: "Omaha, NE",
  ORD: "Chicago, IL",
  STL: "St. Louis, MO",

  // South / Gulf
  AUS: "Austin, TX",
  BNA: "Nashville, TN",
  DAL: "Dallas, TX",
  DFW: "Dallas, TX",
  HOU: "Houston, TX",
  IAH: "Houston, TX",
  MEM: "Memphis, TN",
  MSY: "New Orleans, LA",
  OKC: "Oklahoma City, OK",
  SAT: "San Antonio, TX",
  SDF: "Louisville, KY",
  TUL: "Tulsa, OK",

  // Mountain / Southwest
  ABQ: "Albuquerque, NM",
  DEN: "Denver, CO",
  ELP: "El Paso, TX",
  LAS: "Las Vegas, NV",
  PHX: "Phoenix, AZ",
  SLC: "Salt Lake City, UT",
  TUS: "Tucson, AZ",

  // West Coast
  BUR: "Burbank, CA",
  GEG: "Spokane, WA",
  LAX: "Los Angeles, CA",
  LGB: "Long Beach, CA",
  OAK: "Oakland, CA",
  ONT: "Ontario, CA",
  PDX: "Portland, OR",
  SAN: "San Diego, CA",
  SEA: "Seattle, WA",
  SFO: "San Francisco, CA",
  SJC: "San Jose, CA",
  SMF: "Sacramento, CA",
  SNA: "Orange County, CA",

  // Hawaii (US state — 2-letter code)
  HNL: "Honolulu, HI",
  OGG: "Maui, HI",
  KOA: "Kona, HI",
  LIH: "Kauai, HI",

  // Caribbean / Puerto Rico (territories — keep full name)
  SJU: "San Juan, Puerto Rico",
  TJSJ: "San Juan, Puerto Rico",
  BQN: "Aguadilla, Puerto Rico",
  PSE: "Ponce, Puerto Rico",
  STT: "St. Thomas, U.S. Virgin Islands",
  STX: "St. Croix, U.S. Virgin Islands",
  EIS: "Tortola, British Virgin Islands",

  // Mexico & Latin America (international — keep full name)
  CUN: "Cancún, Mexico",
  GDL: "Guadalajara, Mexico",
  MEX: "Mexico City, Mexico",
  PVR: "Puerto Vallarta, Mexico",
  SJD: "Los Cabos, Mexico",
};

export function iataToCityName(iata: string): string {
  const code = (iata ?? "").trim().toUpperCase();
  return IATA_TO_CITY[code] ?? code;
}

/** IATA carrier code → airline display name. */
const CARRIER_NAMES: Record<string, string> = {
  // US carriers
  AA: "American Airlines",
  AS: "Alaska Airlines",
  B6: "JetBlue Airways",
  DL: "Delta Air Lines",
  F9: "Frontier Airlines",
  G4: "Allegiant Air",
  G7: "GoJet Airlines",
  HA: "Hawaiian Airlines",
  MQ: "Envoy Air",
  NK: "Spirit Airlines",
  OH: "PSA Airlines",
  OO: "SkyWest Airlines",
  QX: "Horizon Air",
  SY: "Sun Country Airlines",
  UA: "United Airlines",
  WN: "Southwest Airlines",
  YV: "Mesa Air",
  YX: "Republic Airways",
  // Canada
  AC: "Air Canada",
  PD: "Porter Airlines",
  WS: "WestJet",
  // Caribbean / Latin America
  CM: "Copa Airlines",
  JBU: "JetBlue",
  LA: "LATAM Airlines",
  // International
  AF: "Air France",
  BA: "British Airways",
  KL: "KLM",
  LH: "Lufthansa",
  LX: "Swiss International",
};

export function carrierFromFlightNumber(flightNumber: string | null): string | null {
  if (!flightNumber) return null;
  const m = flightNumber.trim().match(/^([A-Z]{2})\d/i);
  return m ? m[1].toUpperCase() : null;
}

export function carrierName(code: string | null): string | null {
  if (!code) return null;
  return CARRIER_NAMES[code.toUpperCase()] ?? null;
}

/** Returns just the numeric flight number portion (e.g. "479" from "WN479"). */
export function flightNumberNumeric(flightNumber: string | null): string | null {
  if (!flightNumber) return null;
  const m = flightNumber.trim().match(/\d+$/);
  return m ? m[0] : flightNumber;
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

export type TodayLegDetail = {
  origin: string;              // plain city name
  originIata: string;          // raw IATA, e.g. "BDL"
  depTime: string;             // HH:MM
  destination: string;         // plain city name
  destIata: string;            // raw IATA, e.g. "MCO"
  arrTime: string;             // HH:MM
  departureDate: string;       // "YYYY-MM-DD" of the leg's departure
  deadhead: boolean;
  flightNumber: string | null;       // full, e.g. "WN479"
  carrierCode: string | null;        // e.g. "WN"
  carrierDisplayName: string | null; // e.g. "Southwest Airlines"
  flightNumeric: string | null;      // e.g. "479"
};

export type FamilyViewDayItem = {
  dateStr: string;
  dayLabel: string;
  status: FamilyViewStatus;
  /** Optional detail (e.g. "Overnight in Denver") */
  detail?: string | null;
  /** For trips: report time in 12h format */
  reportTime?: string | null;
  /** Trip day label, e.g. "Day 2 of 3" */
  tripDayLabel?: string | null;
  /** Today's flight route summary, e.g. "Hartford → Orlando → San Juan" */
  todayFlightRoute?: string | null;
  /** Per-leg detail for today's flights */
  todayLegs?: TodayLegDetail[] | null;
  /** True when a commuter picks up a trip departing from and/or returning to their home airport. */
  isHomeBaseTrip?: boolean | null;
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
  reportTime?: string | null;
  tripDayLabel?: string | null;
  todayFlightRoute?: string | null;
  todayLegs?: TodayLegDetail[] | null;
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
  const tripDayIndex = tripDates.indexOf(dateStr);
  const tripDayLabel = tripDayIndex >= 0 ? `Day ${tripDayIndex + 1} of ${tripDates.length}` : null;

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
    const lastDayLegs = primary.legs ?? [];
    const lastDayRoute = lastDayLegs.length > 0
      ? computeDayFlightRoute(lastDayLegs, tripDates, dateStr, baseTimezone)
      : null;

    // Detect home-base trips: commuter whose trip's last leg lands at home airport.
    // For single-day trips, also verify the first leg departs from home.
    const homeIata = (profile?.home_airport ?? "").trim().toUpperCase();
    const baseIata = (profile?.base_airport ?? "").trim().toUpperCase();
    const commuterPilot = homeIata.length === 3 && baseIata.length === 3 && homeIata !== baseIata;
    const lastTripLeg = legs.length > 0 ? (legs[legs.length - 1] as ScheduleEventLeg) : null;
    const firstTripLeg = legs.length > 0 ? (legs[0] as ScheduleEventLeg) : null;
    const tripEndsAtHome = commuterPilot && (lastTripLeg?.destination ?? "").trim().toUpperCase() === homeIata;
    const isHomeBaseTrip = tripEndsAtHome
      ? (tripDates.length === 1 ? (firstTripLeg?.origin ?? "").trim().toUpperCase() === homeIata : true)
      : false;

    // For home-base trips, replace the vague "sometime in the X" detail with
    // real departure and arrival times from the last day's legs.
    let homeBaseTripDetail: string | null = null;
    if (isHomeBaseTrip && legs.length > 0 && tripDates.length > 0) {
      const lastDayLegDates = computeLegDates(legs, tripDates, baseTimezone)
        .filter((ld) => ld.departureDate === dateStr);
      const firstLegOfDay = lastDayLegDates.length > 0 ? (lastDayLegDates[0]!.leg as ScheduleEventLeg) : null;
      const lastLegOfDay = lastDayLegDates.length > 0 ? (lastDayLegDates[lastDayLegDates.length - 1]!.leg as ScheduleEventLeg) : null;
      const depStr = firstLegOfDay?.depTime ? formatReportTime12h(firstLegOfDay.depTime) : null;
      const arrStr = lastLegOfDay?.arrTime ? formatReportTime12h(lastLegOfDay.arrTime) : null;
      if (depStr && arrStr) homeBaseTripDetail = `Departs ${depStr} · Arrives ${arrStr}`;
      else if (arrStr) homeBaseTripDetail = `Arrives ${arrStr}`;
    }

    return {
      dateStr,
      dayLabel,
      status: "Expected Home",
      detail: homeBaseTripDetail ?? detail ?? null,
      reportTime: null,
      tripDayLabel,
      todayFlightRoute: lastDayRoute,
      isHomeBaseTrip: isHomeBaseTrip || null,
    };
  }

  if (isFirstDay) {
    const firstDayLegs = primary.legs ?? [];
    const firstDayRoute = firstDayLegs.length > 0
      ? computeDayFlightRoute(firstDayLegs, tripDates, dateStr, baseTimezone)
      : null;
    // Detect home-base departures: commuter whose first leg departs from home airport.
    const homeIataFirst = (profile?.home_airport ?? "").trim().toUpperCase();
    const baseIataFirst = (profile?.base_airport ?? "").trim().toUpperCase();
    const commuterPilotFirst = homeIataFirst.length === 3 && baseIataFirst.length === 3 && homeIataFirst !== baseIataFirst;
    const firstLeg = firstDayLegs.length > 0 ? (firstDayLegs[0] as ScheduleEventLeg) : null;
    const departsFromHome = commuterPilotFirst && (firstLeg?.origin ?? "").trim().toUpperCase() === homeIataFirst;

    return {
      dateStr,
      dayLabel,
      status: "At Work",
      reportTime: primary.report_time ?? null,
      tripDayLabel,
      todayFlightRoute: firstDayRoute,
      isHomeBaseTrip: departsFromHome || null,
    };
  }

  // Middle day: overnight city + today's route + trip day label
  const middleLegs = primary.legs ?? [];
  let overnightCity: string | null = null;
  let todayFlightRoute: string | null = null;
  let todayLegs: TodayLegDetail[] | null = null;

  const homeCarrierCode =
    TENANT_CONFIG[(profile?.tenant ?? "").toLowerCase()]?.carrier ?? null;

  if (middleLegs.length > 0 && tripDates.length > 0) {
    const legDates = computeLegDates(middleLegs, tripDates, baseTimezone);

    if (settings.showOvernightCities) {
      const arrivals = legDates.filter((ld) => ld.arrivalDate === dateStr);
      if (arrivals.length > 0) {
        const last = arrivals[arrivals.length - 1];
        overnightCity = (last!.leg as ScheduleEventLeg).destination?.trim() ?? null;
      }
    }

    const departingToday = legDates.filter((ld) => ld.departureDate === dateStr);
    if (departingToday.length > 0) {
      todayFlightRoute = computeDayFlightRoute(middleLegs, tripDates, dateStr, baseTimezone);

      todayLegs = departingToday
        .map((ld) => {
          const leg = ld.leg as ScheduleEventLeg;
          const fn = leg.flightNumber?.trim() || null;
          // For operating legs (no carrier prefix), fall back to the pilot's home carrier
          const code = carrierFromFlightNumber(fn) ?? (leg.deadhead ? null : homeCarrierCode);
          const rawOrigin = (leg.origin ?? "").trim().toUpperCase();
          const rawDest = (leg.destination ?? "").trim().toUpperCase();
          return {
            origin: iataToCityName(rawOrigin),
            originIata: rawOrigin,
            depTime: leg.depTime ?? "",
            destination: iataToCityName(rawDest),
            destIata: rawDest,
            arrTime: leg.arrTime ?? "",
            departureDate: ld.departureDate ?? dateStr,
            deadhead: leg.deadhead === true,
            flightNumber: fn,
            carrierCode: code,
            carrierDisplayName: carrierName(code),
            flightNumeric: flightNumberNumeric(fn),
          };
        })
        .filter((l) => l.depTime && l.arrTime);
    }
  }

  return {
    dateStr,
    dayLabel,
    status: "Overnight Away",
    detail: overnightCity ? `in ${iataToCityName(overnightCity)}` : null,
    tripDayLabel,
    todayFlightRoute,
    todayLegs: todayLegs?.length ? todayLegs : null,
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
  return {
    status: item.status,
    detail: item.detail,
    reportTime: item.reportTime ?? null,
    tripDayLabel: item.tripDayLabel ?? null,
    todayFlightRoute: item.todayFlightRoute ?? null,
    todayLegs: item.todayLegs ?? null,
  };
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

/**
 * Get a continuous day-by-day list for the Upcoming section.
 * Starts `startOffset` days after today and runs for `numDays`.
 * Every day is included — Days Off, work days, training, reserve — no gaps.
 */
export function getUpcomingDays(
  events: ScheduleEvent[],
  profile: Profile | null,
  baseTimezone: string,
  settings: FamilyViewSettings,
  startOffset = 7,
  numDays = 28
): FamilyViewDayItem[] {
  const filtered = filterScheduleEvents(events);
  let cur = todayStr(baseTimezone);

  for (let i = 0; i < startOffset; i++) cur = addDay(cur);

  const result: FamilyViewDayItem[] = [];
  for (let i = 0; i < numDays; i++) {
    const [y, m, d] = cur.split("-").map(Number);
    const dayDate = new Date(y!, m! - 1, d!);
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

/** Build a city-name route string for all legs departing on a given day, e.g. "San Juan → Hartford". */
function computeDayFlightRoute(
  legs: ScheduleEventLeg[],
  tripDates: string[],
  dateStr: string,
  baseTimezone: string
): string | null {
  if (!legs.length || !tripDates.length) return null;
  const legDates = computeLegDates(legs, tripDates, baseTimezone);
  const departingToday = legDates.filter((ld) => ld.departureDate === dateStr);
  if (!departingToday.length) return null;
  const stops: string[] = [];
  const firstLeg = departingToday[0]!.leg as ScheduleEventLeg;
  stops.push(iataToCityName((firstLeg.origin ?? "").trim().toUpperCase()));
  for (const ld of departingToday) {
    const leg = ld.leg as ScheduleEventLeg;
    const dest = iataToCityName((leg.destination ?? "").trim().toUpperCase());
    if (dest && stops[stops.length - 1] !== dest) stops.push(dest);
  }
  return stops.length >= 2 ? stops.join(" → ") : null;
}

/** Returns true if two airport codes are in the same state/territory (same-region commuter). */
export function isSameRegionAirports(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a.toUpperCase() === b.toUpperCase()) return true;
  const cityA = IATA_TO_CITY[a.toUpperCase()];
  const cityB = IATA_TO_CITY[b.toUpperCase()];
  if (!cityA || !cityB) return false;
  const stateA = cityA.split(",")[1]?.trim();
  const stateB = cityB.split(",")[1]?.trim();
  return !!stateA && !!stateB && stateA === stateB;
}

/** Day-by-day status items for a specific trip (used in Work Trip card). */
export function getTripDayItems(
  trip: ScheduleEvent,
  events: ScheduleEvent[],
  profile: Profile | null,
  baseTimezone: string,
  settings: FamilyViewSettings
): FamilyViewDayItem[] {
  const filtered = filterScheduleEvents(events);
  const tripDates = getTripDateStrings(trip.start_time, trip.end_time, baseTimezone);
  return tripDates.map((dateStr) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dayDate = new Date(y, m - 1, d);
    return getStatusForDay(dateStr, dayDate, filtered, profile, baseTimezone, settings);
  });
}

export type BetweenTripStatus = {
  /** Hours between current trip end and next trip start. Null if no next trip. */
  gapHours: number | null;
  /** Whether the pilot is likely to make it home before the next trip. */
  likelyComesHome: boolean;
  /**
   * Warning message when a long-distance commuter won't have enough time to go home.
   * e.g. "Sven most likely won't make it home before the next trip"
   */
  warningMessage: string | null;
  /** Day label for next trip start, e.g. "Wed • April 9". */
  nextTripStartLabel: string | null;
};

/**
 * Determines whether a pilot will likely make it home between the current trip and the next.
 * Rules:
 *  - Non-commuters (home == base): always comes home.
 *  - Same-region commuter (e.g. Tampa–Orlando, drive possible): needs gap ≥ 8 h.
 *  - Long-distance commuter (e.g. Tampa–San Juan, requires flight): needs gap ≥ 48 h.
 *    Rationale: a 3h flight each way + fatigue recovery after a late landing + last viable
 *    return flight constraints mean anything under 48h leaves at most a few hours at home,
 *    making the commute impractical from a human-factors standpoint.
 */
export function getBetweenTripStatus(
  currentTrip: ScheduleEvent,
  events: ScheduleEvent[],
  profile: Profile | null,
  baseTimezone: string,
  firstName: string | null
): BetweenTripStatus {
  const filtered = filterScheduleEvents(events);
  const futureTrips = filtered
    .filter((e) => e.event_type === "trip" && e.start_time > currentTrip.end_time)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const nextTrip = futureTrips[0];

  if (!nextTrip) {
    return { gapHours: null, likelyComesHome: true, warningMessage: null, nextTripStartLabel: null };
  }

  const gapMs = new Date(nextTrip.start_time).getTime() - new Date(currentTrip.end_time).getTime();
  const gapHours = Math.round(gapMs / (1000 * 60 * 60));

  const homeAirport = (profile?.home_airport ?? "").trim().toUpperCase();
  const baseAirport = (profile?.base_airport ?? "").trim().toUpperCase();
  const commuter = isCommuter(profile);

  if (!commuter) {
    return { gapHours, likelyComesHome: true, warningMessage: null, nextTripStartLabel: null };
  }

  // Home-base trip: if the current trip's last leg lands at home airport,
  // the pilot is already home when the trip ends — no commute needed.
  const currentTripLegs = (currentTrip.legs ?? []) as ScheduleEventLeg[];
  const lastCurrentTripLeg = currentTripLegs.length > 0 ? currentTripLegs[currentTripLegs.length - 1] : null;
  if (homeAirport.length === 3 && (lastCurrentTripLeg?.destination ?? "").trim().toUpperCase() === homeAirport) {
    return { gapHours, likelyComesHome: true, warningMessage: null, nextTripStartLabel: null };
  }

  const sameRegion = isSameRegionAirports(homeAirport, baseAirport);
  const minGapHours = sameRegion ? 8 : 48;
  const likelyComesHome = gapHours >= minGapHours;

  const nextTripDates = getTripDateStrings(nextTrip.start_time, nextTrip.end_time, baseTimezone);
  const nextTripFirstDay = nextTripDates[0];
  const nextTripStartLabel = nextTripFirstDay
    ? formatDayLabel(`${nextTripFirstDay}T12:00:00.000Z`, baseTimezone)
    : null;

  const name = firstName?.trim() || "The pilot";
  const warningMessage = likelyComesHome
    ? null
    : `${name} most likely won't make it home before the next trip`;

  return { gapHours, likelyComesHome, warningMessage, nextTripStartLabel };
}
