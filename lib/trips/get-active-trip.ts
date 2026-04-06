/**
 * Current Trip™ — backend helper to determine if a user is inside an active trip.
 * Works for the full trip span (layover mornings, between duty periods, etc.).
 */

import { createClient } from "@/lib/supabase/server";
import {
  getTripDateStrings,
  getLegsForDate,
  getScheduleEventDutyStartMs,
  isDateFullyComplete,
  todayStr,
  computeLegDates,
  legCrewReleasedFromLeg,
} from "@/lib/leg-dates";
import { extractPairingKey } from "@/lib/schedule-time";
import type { ScheduleEvent } from "@/app/frontier/pilots/portal/schedule/actions";
import { getDisplayedTripDayInfo } from "@/lib/trips/displayed-trip-day";

/** Add one day to YYYY-MM-DD (matches schedule-time.addDay). */
function addDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}
import { getTimezoneFromAirport } from "@/lib/airport-timezone";
import { getTenantSourceTimezone } from "@/lib/tenant-config";

const FLICA_SOURCE = "flica_import";

export type ActiveTripTodayLeg = {
  flightNumber: string;
  origin: string;
  destination: string;
  depTime: string;
  arrTime: string;
  deadhead?: boolean;
  /** Departure date (YYYY-MM-DD) for per-leg day label. Fixes overnight legs showing wrong date. */
  departureDate?: string | null;
};

export type ActiveTrip = {
  pairing: string;
  tripDay: number;
  tripLength: number;
  tripStartDate: string;
  todayLegs: ActiveTripTodayLeg[];
  /** When today's duty is done, we show tomorrow's legs; this is the date being displayed (YYYY-MM-DD). */
  displayDateStr: string;
};

type ScheduleEventRow = {
  id: string;
  start_time: string;
  end_time: string;
  event_type: string;
  report_time?: string | null;
  title: string | null;
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
};

/**
 * Returns the user's active trip if today falls within the trip date span.
 * Works for the full trip span — layover mornings, between duty periods, before next report.
 * Returns null if the user is not inside any trip.
 */
export async function getActiveTrip(userId: string): Promise<ActiveTrip | null> {
  if (!userId?.trim()) return null;

  const supabase = await createClient();

  // 1. Fetch profile for timezone
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("base_timezone, base_airport, tenant, commute_release_buffer_minutes")
    .eq("id", userId)
    .single();

  if (profileError || !profile) return null;

  const timezone =
    (profile as { base_timezone?: string }).base_timezone?.trim() ??
    ((profile as { base_airport?: string }).base_airport
      ? getTimezoneFromAirport((profile as { base_airport: string }).base_airport)
      : getTenantSourceTimezone((profile as { tenant?: string }).tenant ?? "frontier"));

  const releaseBufferMin = Math.max(
    0,
    (profile as { commute_release_buffer_minutes?: number | null }).commute_release_buffer_minutes ?? 0
  );

  const today = todayStr(timezone);
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  // 2. Active trip: duty start (report on trip day, or block start) <= now < end — not only block start_time.
  const { data: overlapRows, error } = await supabase
    .from("schedule_events")
    .select("id, start_time, end_time, event_type, report_time, title, legs")
    .eq("user_id", userId)
    .eq("source", FLICA_SOURCE)
    .eq("event_type", "trip")
    .or("is_muted.eq.false,is_muted.is.null")
    .gt("end_time", nowIso)
    .order("start_time", { ascending: true })
    .limit(25);

  if (error) return null;

  const activeEvent =
    (overlapRows ?? []).find((row) => {
      const ev = row as ScheduleEventRow;
      const dutyStartMs = getScheduleEventDutyStartMs(ev, timezone);
      const endMs = new Date(ev.end_time).getTime();
      return nowMs >= dutyStartMs && nowMs < endMs;
    }) ?? null;

  if (!activeEvent) return null;

  const ev = activeEvent as ScheduleEventRow;

  const tripDates = getTripDateStrings(ev.start_time, ev.end_time, timezone);
  if (tripDates.length === 0) return null;

  const todayIndex = tripDates.indexOf(today);
  if (todayIndex < 0) return null;

  const legs = ev.legs ?? [];
  const legsForToday = getLegsForDate(legs, today, tripDates, timezone);

  // When today's duty is done, show tomorrow's legs instead (if tomorrow is still in the trip)
  let displayDate = today;
  let displayIndex = todayIndex;
  let legsToShow = legsForToday;

  if (isDateFullyComplete(legs, today, tripDates, timezone, releaseBufferMin)) {
    const tomorrow = addDay(today);
    const tomorrowIndex = tripDates.indexOf(tomorrow);
    if (tomorrowIndex >= 0) {
      const legsForTomorrow = getLegsForDate(legs, tomorrow, tripDates, timezone);
      if (legsForTomorrow.length > 0) {
        displayDate = tomorrow;
        displayIndex = tomorrowIndex;
        legsToShow = legsForTomorrow;
      }
    }
  }

  const legDates = computeLegDates(legs, tripDates, timezone);
  const legsFiltered = legsToShow.filter((leg) => {
    const ld = legDates.find((x) => x.leg.origin === leg.origin && x.leg.destination === leg.destination);
    const arrD = ld?.arrivalDate ?? ld?.departureDate ?? null;
    return arrD == null || !legCrewReleasedFromLeg(leg, arrD, timezone, releaseBufferMin);
  });
  const todayLegs: ActiveTripTodayLeg[] = legsFiltered.map((leg) => {
    const ld = legDates.find((x) => x.leg.origin === leg.origin && x.leg.destination === leg.destination);
    return {
      flightNumber: leg.flightNumber ?? "",
      origin: leg.origin ?? "",
      destination: leg.destination ?? "",
      depTime: leg.depTime ?? "",
      arrTime: leg.arrTime ?? "",
      ...(leg.deadhead === true || (leg.blockMinutes === 0 && leg.deadhead !== false) ? { deadhead: true } : {}),
      departureDate: ld?.departureDate ?? null,
    };
  });

  const tripStartDate = tripDates[0] ?? today;

  const dayInfo = getDisplayedTripDayInfo(ev as ScheduleEvent, timezone, {
    releaseBufferMinutes: releaseBufferMin,
  });

  return {
    pairing: extractPairingKey(ev.title),
    tripDay: dayInfo.displayedTripDay,
    tripLength: dayInfo.displayedTripLength,
    tripStartDate,
    todayLegs,
    displayDateStr: displayDate,
  };
}
