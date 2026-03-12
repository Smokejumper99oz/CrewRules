/**
 * Get the signed-in user's next scheduled flight.
 * Reads from existing schedule_events without modifying any schedule code.
 */

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getTripDateStrings, computeLegDates } from "@/lib/leg-dates";
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

export async function getNextFlight(): Promise<NextFlightResult> {
  const profile = await getProfile();
  if (!profile) return { status: "reserve" };

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const timezone =
    profile.base_timezone?.trim() ??
    (profile.base_airport ? getTimezoneFromAirport(profile.base_airport) : getTenantSourceTimezone(profile.tenant ?? "frontier"));

  const { data: event, error } = await supabase
    .from("schedule_events")
    .select("id, start_time, end_time, title, event_type, report_time, legs, filed_route")
    .eq("user_id", profile.id)
    .eq("source", FLICA_SOURCE)
    .eq("event_type", "trip")
    .gte("start_time", nowIso)
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !event) return { status: "reserve" };

  const ev = event as ScheduleEventRow;
  const legs = ev.legs ?? [];
  const tripDates = getTripDateStrings(ev.start_time, ev.end_time, timezone);

  const firstLeg = legs.find((l) => !l.deadhead && l.origin && l.destination);
  if (!firstLeg?.origin || !firstLeg?.destination) return { status: "reserve" };

  const legDates = computeLegDates(legs, tripDates, timezone);
  const firstLegIdx = legs.findIndex((l) => l === firstLeg);
  const firstLegDates = firstLegIdx >= 0 ? legDates[firstLegIdx] : legDates.find(
    (ld) => ld.leg.origin === firstLeg.origin && ld.leg.destination === firstLeg.destination
  );
  const depDateStr = firstLegDates?.departureDate ?? tripDates[0] ?? formatInTimeZone(new Date(ev.start_time), timezone, "yyyy-MM-dd");
  const arrDateStr = firstLegDates?.arrivalDate ?? depDateStr;

  const arrTime = firstLeg.arrTime ?? null;
  const depTimeRaw = (firstLeg.depTime ?? "00:00").replace(":", "").padStart(4, "0");
  const depTimeNorm = depTimeRaw.length >= 4 ? `${depTimeRaw.slice(0, 2)}:${depTimeRaw.slice(2, 4)}` : "00:00";
  const arrTimeRaw = arrTime ? arrTime.replace(":", "").padStart(4, "0") : "";
  const arrTimeNorm = arrTimeRaw.length >= 4 ? `${arrTimeRaw.slice(0, 2)}:${arrTimeRaw.slice(2, 4)}` : arrTime;

  const depAirportTz = getTimezoneFromAirport(firstLeg.origin);
  const arrAirportTz = getTimezoneFromAirport(firstLeg.destination);
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

  console.log("[getNextFlight] TAF target times:", {
    departureAirport: firstLeg.origin,
    arrivalAirport: firstLeg.destination,
    depDateStr,
    arrDateStr,
    depTimeNorm,
    arrTimeNorm,
    depAirportTz,
    arrAirportTz,
    departureIso: depIsoFull,
    arrivalIso: arrIsoFull,
  });

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
    flightNumber: firstLeg.flightNumber ?? null,
    filedRoute: ev.filed_route ?? null,
    departureAirport: firstLeg.origin,
    arrivalAirport: firstLeg.destination,
    departureTime: depLocal,
    arrivalTime: arrTime,
    departureTimeUtc: depUtcFormatted,
    arrivalTimeUtc: arrUtcFormatted,
    reportTime: reportTime ?? undefined,
    aircraft: null,
    tripNumber: extractTripNumber(ev.title),
    blockMinutes: firstLeg.blockMinutes ?? null,
    departureIso: depIsoFull,
    arrivalIso: arrIsoFull,
  };
}
