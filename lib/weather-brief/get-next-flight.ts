/**
 * Get the signed-in user's next scheduled flight.
 * Reads from existing schedule_events without modifying any schedule code.
 * Uses same leg-selection logic as schedule/actions.ts: active trip first,
 * then first leg not yet completed (arrival passed = completed), else next pairing.
 */

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import {
  getTripDateStrings,
  computeLegDates,
  getNextLegForDate,
  isDateFullyComplete,
  getLegsForDate,
  todayStr,
} from "@/lib/leg-dates";
import { addDay } from "@/lib/schedule-time";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";
import { getTenantSourceTimezone } from "@/lib/tenant-config";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { NextFlightResult } from "./types";

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

/** Extract pairing/trip number from title (e.g. "Trip S3019" -> "S3019"). */
function extractTripNumber(title: string | null): string | null {
  if (!title?.trim()) return null;
  const m = title.match(/\b(S\d{4}|T\d+)\b/i);
  return m ? m[1].toUpperCase() : null;
}

/** Build NextFlightResult from event + selected leg. Reused for active trip and fallback. */
function buildNextFlight(
  ev: ScheduleEventRow,
  selectedLeg: { flightNumber?: string; origin: string; destination: string; depTime?: string; arrTime?: string; blockMinutes?: number },
  legDates: { leg: typeof selectedLeg; departureDate: string | null; arrivalDate: string | null }[],
  tripDates: string[],
  timezone: string
): NextFlightResult {
  const legDatesEntry = legDates.find(
    (ld) => ld.leg.origin === selectedLeg.origin && ld.leg.destination === selectedLeg.destination
  );
  const depDateStr = legDatesEntry?.departureDate ?? tripDates[0] ?? formatInTimeZone(new Date(ev.start_time), timezone, "yyyy-MM-dd");
  const arrDateStr = legDatesEntry?.arrivalDate ?? depDateStr;

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

export async function getNextFlight(): Promise<NextFlightResult> {
  const profile = await getProfile();
  if (!profile) return { status: "reserve" };

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const timezone =
    profile.base_timezone?.trim() ??
    (profile.base_airport ? getTimezoneFromAirport(profile.base_airport) : getTenantSourceTimezone(profile.tenant ?? "frontier"));

  const today = todayStr(timezone);
  const tomorrow = addDay(today);

  // 1. Active trip: start_time <= now < end_time (same as schedule/actions.ts)
  const { data: activeEvent, error: activeError } = await supabase
    .from("schedule_events")
    .select("id, start_time, end_time, title, event_type, report_time, legs, filed_route")
    .eq("user_id", profile.id)
    .eq("source", FLICA_SOURCE)
    .eq("event_type", "trip")
    .lte("start_time", nowIso)
    .gt("end_time", nowIso)
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!activeError && activeEvent) {
    const ev = activeEvent as ScheduleEventRow;
    const legs = ev.legs ?? [];
    const tripDates = getTripDateStrings(ev.start_time, ev.end_time, timezone);
    const legDates = computeLegDates(legs, tripDates, timezone);

    if (legs.length > 0 && tripDates.length > 0) {
      // First leg that has NOT completed yet (completed = arrival has passed)
      let selectedLeg: (typeof legs)[0] | null = getNextLegForDate(legs, today, tripDates, timezone);

      if (!selectedLeg && isDateFullyComplete(legs, today, tripDates, timezone)) {
        // No remaining leg today; choose first leg for tomorrow within same trip
        const legsForTomorrow = getLegsForDate(legs, tomorrow, tripDates, timezone);
        selectedLeg = legsForTomorrow.find((l) => !l.deadhead && l.origin && l.destination) ?? legsForTomorrow[0] ?? null;
      }

      if (selectedLeg && selectedLeg.origin && selectedLeg.destination && !selectedLeg.deadhead) {
        return buildNextFlight(ev, selectedLeg, legDates, tripDates, timezone);
      }
    }
  }

  // 2. No active trip: fall back to first leg of next future trip
  const { data: futureEvent, error: futureError } = await supabase
    .from("schedule_events")
    .select("id, start_time, end_time, title, event_type, report_time, legs, filed_route")
    .eq("user_id", profile.id)
    .eq("source", FLICA_SOURCE)
    .eq("event_type", "trip")
    .gte("start_time", nowIso)
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (futureError || !futureEvent) return { status: "reserve" };

  const ev = futureEvent as ScheduleEventRow;
  const legs = ev.legs ?? [];
  const tripDates = getTripDateStrings(ev.start_time, ev.end_time, timezone);
  const legDates = computeLegDates(legs, tripDates, timezone);

  const firstLeg = legs.find((l) => !l.deadhead && l.origin && l.destination);
  if (!firstLeg?.origin || !firstLeg?.destination) return { status: "reserve" };

  return buildNextFlight(ev, firstLeg, legDates, tripDates, timezone);
}
