/**
 * Get the signed-in user's next scheduled flight for Weather Brief.
 * Reads from existing schedule_events without modifying any schedule code.
 * Next trip: earliest not-ended trip (end_time > now), preferring rows whose report (or start) is <= now.
 * Matches report-night trips where block calendar start is after report “today”.
 *
 * HARD RULE — Weather Brief empty copy ("No Flight Assigned"):
 *   `status: "reserve"` is returned ONLY when the user has an active reserve block
 *   (schedule_events reserve row, now in [start_time, end_time)) AND we cannot
 *   resolve a trip leg to brief. Non-reserve users NEVER receive `status: "reserve"`;
 *   they get `no_upcoming_trip` instead.
 *
 * Leg choice is chronological (dep/arr instants via fromZonedTime), not calendar-day-only,
 * so report 23:59 with departure 00:59 still resolves the correct leg (no "today" gate).
 */

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getTripDateStrings, computeLegDates, type LegWithDates } from "@/lib/leg-dates";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";
import { getTenantSourceTimezone } from "@/lib/tenant-config";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { addDay } from "@/lib/schedule-time";
import type { NextFlightResult } from "./types";
import { briefOpenTripsInPriorityOrder } from "./open-trips-brief-order";

const FLICA_SOURCE = "flica_import";

type ScheduleEventRow = {
  id: string;
  start_time: string;
  end_time: string;
  title: string | null;
  event_type: string;
  report_time?: string | null;
  legs?: Array<{
    day?: string;
    flightNumber?: string;
    origin: string;
    destination: string;
    depTime?: string;
    arrTime?: string;
    blockMinutes?: number;
    deadhead?: boolean;
  }> | null;
  filed_route?: string | null;
};

type LegRow = NonNullable<ScheduleEventRow["legs"]>[number];

/** Extract pairing/trip number from title (e.g. "Trip S3019" -> "S3019"). */
function extractTripNumber(title: string | null): string | null {
  if (!title?.trim()) return null;
  const m = title.match(/\b(S\d{4}|T\d+)\b/i);
  return m ? m[1].toUpperCase() : null;
}

/** Trip calendar-day span for leg mapping; if span is empty but start parses, use start date (non-reserve must still brief). */
function ensureTripDateStrings(ev: ScheduleEventRow, timezone: string): string[] {
  const span = getTripDateStrings(ev.start_time, ev.end_time, timezone);
  if (span.length > 0) return span;
  const start = new Date(ev.start_time);
  if (!isNaN(start.getTime())) return [formatInTimeZone(start, timezone, "yyyy-MM-dd")];
  return [];
}

/** Single source of truth for arrival calendar day (Weather Brief / leg bounds). */
function resolveArrDateStr(
  legDatesEntry: LegWithDates | undefined,
  depDateStr: string,
  selectedLeg: { depTime?: string; arrTime?: string }
): string {
  let effectiveArrivalDate = legDatesEntry?.arrivalDate ?? null;
  if (!effectiveArrivalDate && selectedLeg.depTime && selectedLeg.arrTime) {
    const dep = selectedLeg.depTime.replace(":", "").padStart(4, "0");
    const arr = selectedLeg.arrTime.replace(":", "").padStart(4, "0");
    if (arr < dep) {
      effectiveArrivalDate = addDay(depDateStr);
    } else {
      effectiveArrivalDate = depDateStr;
    }
  }
  return effectiveArrivalDate ?? depDateStr;
}

function getLegUtcBounds(
  selectedLeg: LegRow,
  legDates: LegWithDates[],
  evStart: string,
  timezone: string
): { depUtc: Date; arrUtc: Date | null } | null {
  if (!selectedLeg.origin || !selectedLeg.destination) return null;
  const legDatesEntry = legDates.find(
    (ld) => ld.leg.origin === selectedLeg.origin && ld.leg.destination === selectedLeg.destination
  );
  let depDateStr = legDatesEntry?.departureDate ?? null;
  if (!depDateStr && evStart) {
    depDateStr = formatInTimeZone(new Date(evStart), timezone, "yyyy-MM-dd");
  }
  if (depDateStr == null) return null;
  const arrDateStr = resolveArrDateStr(legDatesEntry, depDateStr, selectedLeg);
  const depTimeRaw = (selectedLeg.depTime ?? "00:00").replace(":", "").padStart(4, "0");
  const depTimeNorm = depTimeRaw.length >= 4 ? `${depTimeRaw.slice(0, 2)}:${depTimeRaw.slice(2, 4)}` : "00:00";
  const arrTime = selectedLeg.arrTime ?? null;
  const arrTimeRaw = arrTime ? arrTime.replace(":", "").padStart(4, "0") : "";
  const arrTimeNorm = arrTimeRaw.length >= 4 ? `${arrTimeRaw.slice(0, 2)}:${arrTimeRaw.slice(2, 4)}` : arrTime;
  const depAirportTz = getTimezoneFromAirport(selectedLeg.origin);
  const arrAirportTz = getTimezoneFromAirport(selectedLeg.destination);
  const depUtc = fromZonedTime(`${depDateStr} ${depTimeNorm}`, depAirportTz);
  const arrUtc =
    arrTimeNorm && arrDateStr ? fromZonedTime(`${arrDateStr} ${arrTimeNorm}`, arrAirportTz) : null;
  if (isNaN(depUtc.getTime())) return null;
  if (arrUtc && isNaN(arrUtc.getTime())) return { depUtc, arrUtc: null };
  return { depUtc, arrUtc };
}

/**
 * Next non-deadhead leg by real departure time that is not yet complete (arrival in the future when known).
 * If all legs look complete by time, falls back to earliest leg by departure (still on this pairing).
 */
function pickNextWeatherBriefLeg(
  legs: LegRow[],
  legDates: LegWithDates[],
  evStart: string,
  timezone: string
): LegRow | null {
  const nowMs = Date.now();
  const candidates = legs.filter((l) => !l.deadhead && l.origin && l.destination);
  if (candidates.length === 0) return null;
  const scored = candidates
    .map((selectedLeg) => {
      const bounds = getLegUtcBounds(selectedLeg, legDates, evStart, timezone);
      if (!bounds) return null;
      return { leg: selectedLeg, ...bounds };
    })
    .filter((x): x is { leg: LegRow; depUtc: Date; arrUtc: Date | null } => x != null);
  if (scored.length === 0) return null;
  scored.sort((a, b) => a.depUtc.getTime() - b.depUtc.getTime());
  const incomplete = scored.find((s) => {
    if (s.arrUtc) return s.arrUtc.getTime() > nowMs;
    return s.depUtc.getTime() > nowMs;
  });
  return (incomplete ?? scored[0]).leg;
}

/** If we have a trip row, always try to brief a leg when any O/D exists (chronological pick, then operational fallback). */
function tryFlightFromEvent(ev: ScheduleEventRow, timezone: string): NextFlightResult | null {
  const legs = ev.legs ?? [];
  if (legs.length === 0) return null;

  const tripDates = ensureTripDateStrings(ev, timezone);
  if (tripDates.length === 0) return null;

  const legDates = computeLegDates(legs, tripDates, timezone);

  let selectedLeg: LegRow | null = pickNextWeatherBriefLeg(legs, legDates, ev.start_time, timezone);

  if (!selectedLeg?.origin || !selectedLeg.destination) {
    selectedLeg = legs.find((l) => !l.deadhead && l.origin && l.destination) ?? null;
  }
  if (!selectedLeg?.origin || !selectedLeg.destination) {
    selectedLeg = legs.find((l) => l.origin && l.destination) ?? null;
  }

  if (!selectedLeg?.origin || !selectedLeg.destination) return null;

  return buildNextFlight(ev, selectedLeg, legDates, timezone);
}

/** Build NextFlightResult from event + selected leg. Reused for active trip and fallback. */
function buildNextFlight(
  ev: ScheduleEventRow,
  selectedLeg: { flightNumber?: string; origin: string; destination: string; depTime?: string; arrTime?: string; blockMinutes?: number },
  legDates: { leg: typeof selectedLeg; departureDate: string | null; arrivalDate: string | null }[],
  timezone: string
): NextFlightResult {
  const legDatesEntry = legDates.find(
    (ld) => ld.leg.origin === selectedLeg.origin && ld.leg.destination === selectedLeg.destination
  );
  let depDateStr = legDatesEntry?.departureDate ?? null;
  if (!depDateStr && ev.start_time) {
    depDateStr = formatInTimeZone(new Date(ev.start_time), timezone, "yyyy-MM-dd");
  }
  depDateStr = depDateStr ?? formatInTimeZone(new Date(ev.start_time), timezone, "yyyy-MM-dd");
  const arrDateStr = resolveArrDateStr(legDatesEntry, depDateStr, selectedLeg);

  const arrTime = selectedLeg.arrTime ?? null;
  const depTimeRaw = (selectedLeg.depTime ?? "00:00").replace(":", "").padStart(4, "0");
  const depTimeNorm = depTimeRaw.length >= 4 ? `${depTimeRaw.slice(0, 2)}:${depTimeRaw.slice(2, 4)}` : "00:00";
  const arrTimeRaw = arrTime ? arrTime.replace(":", "").padStart(4, "0") : "";
  const arrTimeNorm = arrTimeRaw.length >= 4 ? `${arrTimeRaw.slice(0, 2)}:${arrTimeRaw.slice(2, 4)}` : arrTime;

  const depAirportTz = getTimezoneFromAirport(selectedLeg.origin);
  const arrAirportTz = getTimezoneFromAirport(selectedLeg.destination);
  const depUtc = fromZonedTime(`${depDateStr} ${depTimeNorm}`, depAirportTz);
  const depLocal = formatInTimeZone(depUtc, depAirportTz, "HH:mm");
  const depIsoFull = depUtc.toISOString();
  const depUtcFormatted = formatInTimeZone(depUtc, "UTC", "HH:mm");
  const arrUtcDate =
    arrTimeNorm && arrDateStr
      ? fromZonedTime(`${arrDateStr} ${arrTimeNorm}`, arrAirportTz)
      : null;
  const arrIsoFull = arrUtcDate?.toISOString() ?? null;
  const arrUtcFormatted = arrUtcDate ? formatInTimeZone(arrUtcDate, "UTC", "HH:mm") : null;

  let reportTime: string | null = null;
  if (ev.report_time) {
    const rt = new Date(ev.report_time);
    if (!isNaN(rt.getTime())) {
      reportTime = formatInTimeZone(rt, timezone, "HH:mm");
    }
  }

  return {
    status: "flight",
    eventId: ev.id,
    flightNumber: selectedLeg.flightNumber ?? null,
    filedRoute: ev.filed_route ?? null,
    departureAirport: selectedLeg.origin,
    arrivalAirport: selectedLeg.destination,
    departureTime: depLocal,
    arrivalTime: arrTime,
    departureTimeUtc: depUtcFormatted,
    arrivalTimeUtc: arrUtcFormatted,
    reportTime: reportTime ?? undefined,
    aircraft: null,
    tripNumber: extractTripNumber(ev.title),
    blockMinutes: selectedLeg.blockMinutes ?? null,
    departureIso: depIsoFull,
    arrivalIso: arrIsoFull,
  };
}

/**
 * Reserve-only empty state. Non-reserve → `no_upcoming_trip` so UI never shows "No Flight Assigned".
 */
function weatherBriefNonFlightState(isOnReserve: boolean): NextFlightResult {
  if (isOnReserve) return { status: "reserve" };
  return { status: "no_upcoming_trip" };
}

export async function getNextFlight(): Promise<NextFlightResult> {
  const profile = await getProfile();
  if (!profile) return { status: "no_upcoming_trip" };

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const timezone =
    profile.base_timezone?.trim() ??
    (profile.base_airport ? getTimezoneFromAirport(profile.base_airport) : getTenantSourceTimezone(profile.tenant ?? "frontier"));

  const { data: activeReserve, error: reserveError } = await supabase
    .from("schedule_events")
    .select("id")
    .eq("user_id", profile.id)
    .eq("source", FLICA_SOURCE)
    .eq("event_type", "reserve")
    .lte("start_time", nowIso)
    .gt("end_time", nowIso)
    .limit(1)
    .maybeSingle();
  const isOnReserve = !reserveError && !!activeReserve;

  // Next trip to brief: any trip that has not ended, earliest start order; prefer in-progress block (start <= now).
  // Avoids missing a trip whose calendar start is "tomorrow" while report is still "today" (post-midnight dep).
  const { data: openTrips, error: openTripsError } = await supabase
    .from("schedule_events")
    .select("id, start_time, end_time, title, event_type, report_time, legs, filed_route")
    .eq("user_id", profile.id)
    .eq("source", FLICA_SOURCE)
    .eq("event_type", "trip")
    .or(`report_time.lte.${nowIso},start_time.lte.${nowIso}`)
    .gt("end_time", nowIso)
    .order("start_time", { ascending: true })
    .limit(30);

  if (openTripsError || !openTrips?.length) return weatherBriefNonFlightState(isOnReserve);

  const rows = openTrips as ScheduleEventRow[];
  /**
   * CrewRules Weather Brief: try ALL open trips in priority order before empty state.
   * In-progress first (each row report_time ?? start_time <= now), then future rows, both orderings preserve
   * the query’s ascending start_time. Never stop after the first row when tryFlightFromEvent is null.
   */
  const brief = briefOpenTripsInPriorityOrder(rows, nowIso, timezone, tryFlightFromEvent);
  if (brief) return brief;

  return weatherBriefNonFlightState(isOnReserve);
}
