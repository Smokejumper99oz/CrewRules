/**
 * Current Trip™ — backend helper to determine if a user is inside an active trip.
 * Works for the full trip span (layover mornings, between duty periods, etc.).
 */

import { fromZonedTime } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import { getTripDateStrings, getLegsForDate, isDateFullyComplete, todayStr } from "@/lib/leg-dates";
import { extractPairingKey } from "@/lib/schedule-time";

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
    .select("base_timezone, base_airport, tenant")
    .eq("id", userId)
    .single();

  if (profileError || !profile) return null;

  const timezone =
    (profile as { base_timezone?: string }).base_timezone?.trim() ??
    ((profile as { base_airport?: string }).base_airport
      ? getTimezoneFromAirport((profile as { base_airport: string }).base_airport)
      : getTenantSourceTimezone((profile as { tenant?: string }).tenant ?? "frontier"));

  const today = todayStr(timezone);

  // 2. Compute today's UTC bounds for overlap query
  const dayStartUtc = fromZonedTime(`${today}T00:00:00.000`, timezone).toISOString();
  const dayEndUtc = fromZonedTime(`${today}T23:59:59.999`, timezone).toISOString();

  // 3. Fetch trip events that span today
  const { data: events, error } = await supabase
    .from("schedule_events")
    .select("id, start_time, end_time, title, legs")
    .eq("user_id", userId)
    .eq("source", FLICA_SOURCE)
    .eq("event_type", "trip")
    .lte("start_time", dayEndUtc)
    .gte("end_time", dayStartUtc)
    .order("start_time", { ascending: true })
    .limit(5);

  if (error || !events?.length) return null;

  const ev = events[0] as ScheduleEventRow;
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

  if (isDateFullyComplete(legs, today, tripDates, timezone)) {
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

  const todayLegs: ActiveTripTodayLeg[] = legsToShow.map((leg) => ({
    flightNumber: leg.flightNumber ?? "",
    origin: leg.origin ?? "",
    destination: leg.destination ?? "",
    depTime: leg.depTime ?? "",
    arrTime: leg.arrTime ?? "",
    ...(leg.deadhead === true || (leg.blockMinutes === 0 && leg.deadhead !== false) ? { deadhead: true } : {}),
  }));

  const tripStartDate = tripDates[0] ?? today;

  return {
    pairing: extractPairingKey(ev.title),
    tripDay: displayIndex + 1,
    tripLength: tripDates.length,
    tripStartDate,
    todayLegs,
    displayDateStr: displayDate,
  };
}
