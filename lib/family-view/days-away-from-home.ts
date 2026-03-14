/**
 * Compute "days away from home" for Family View Work Trip.
 * Uses Commute Assist + profile buffers when available; fallback to commute-inference for commuters.
 */

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { subMinutes, addMinutes, differenceInCalendarDays } from "date-fns";
import { getTripDateStrings } from "@/lib/leg-dates";
import { addDay } from "@/lib/schedule-time";
import { isCommuter, getCommuteInfoForTrip } from "./commute-inference";
import type { ScheduleEvent } from "@/app/frontier/pilots/portal/schedule/actions";
import type { Profile } from "@/lib/profile";
import type { FamilyViewSettings } from "./translate-schedule";

/** Parse report_time (HH:MM or HHMM) to minutes since midnight. */
function reportTimeToMinutes(reportTime: string | undefined | null): number | null {
  if (!reportTime?.trim()) return null;
  const s = reportTime.trim().replace(":", "");
  if (!/^\d{3,4}$/.test(s)) return null;
  const h = parseInt(s.slice(0, -2) || "0", 10);
  const m = parseInt(s.slice(-2), 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function subtractDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return prev.toISOString().slice(0, 10);
}

/** Check if any flight arrives by cutoff (UTC). */
function hasFlightArrivingBy(
  flights: { arrivalTime: string }[],
  arriveByUtc: Date,
  destTz: string
): boolean {
  for (const f of flights) {
    const arr = new Date(f.arrivalTime);
    if (!isNaN(arr.getTime()) && arr.getTime() <= arriveByUtc.getTime()) return true;
  }
  return false;
}

/** Find first flight that departs after cutoff; return its arrival date (YYYY-MM-DD) in destTz, or null. */
function getReturnHomeDateFromFlights(
  flights: { departureTime: string; arrivalTime: string }[],
  departAfterUtc: Date,
  destTz: string
): string | null {
  for (const f of flights) {
    const dep = new Date(f.departureTime);
    if (!isNaN(dep.getTime()) && dep.getTime() >= departAfterUtc.getTime()) {
      const arr = new Date(f.arrivalTime);
      if (!isNaN(arr.getTime())) {
        return formatInTimeZone(arr, destTz, "yyyy-MM-dd");
      }
    }
  }
  return null;
}

type GetDaysAwayInput = {
  trip: ScheduleEvent;
  profile: Profile | null;
  baseTimezone: string;
  settings: FamilyViewSettings;
  getCommuteFlights: (params: {
    origin: string;
    destination: string;
    date: string;
  }) => Promise<{ ok: true; flights: { arrivalTime: string; departureTime: string }[]; originTz?: string; destTz?: string } | { ok: false }>;
};

/**
 * Compute days away from home for a trip.
 * Returns inclusive count (e.g. Mar 13–16 = 4 days). Always >= 1.
 */
export async function getDaysAwayFromHome(input: GetDaysAwayInput): Promise<number> {
  const { trip, profile, baseTimezone, settings, getCommuteFlights } = input;
  const tripDates = getTripDateStrings(trip.start_time, trip.end_time, baseTimezone);
  if (tripDates.length === 0) return 1;

  const firstDutyDate = tripDates[0];
  const lastDutyDate = tripDates[tripDates.length - 1];

  let leaveHomeDate = firstDutyDate;
  let returnHomeDate = lastDutyDate;

  if (!isCommuter(profile) || !settings.showCommuteEstimates) {
    leaveHomeDate = firstDutyDate;
    returnHomeDate = lastDutyDate;
  } else {
    const homeAirport = (profile?.home_airport ?? "").trim().toUpperCase();
    const baseAirport = (profile?.base_airport ?? "").trim().toUpperCase();
    const dutyStartAirport = trip.legs?.[0]?.origin?.trim().toUpperCase() ?? baseAirport;
    const dutyEndAirport = trip.legs?.length
      ? (trip.legs[trip.legs.length - 1]?.destination?.trim().toUpperCase() ?? baseAirport)
      : baseAirport;

    const arrivalBuffer = profile?.commute_arrival_buffer_minutes ?? 60;
    const releaseBuffer = profile?.commute_release_buffer_minutes ?? 30;

    if (homeAirport.length !== 3 || (dutyStartAirport.length !== 3 && baseAirport.length !== 3)) {
      const commuteInfo = getCommuteInfoForTrip(trip, profile, baseTimezone);
      leaveHomeDate = commuteInfo?.commuteDateStr ?? firstDutyDate;
      returnHomeDate = lastDutyDate;
    } else {
      const destToBase = dutyStartAirport || baseAirport;

      const reportMin = reportTimeToMinutes(trip.report_time ?? null);
      const reportIso =
        reportMin != null
          ? fromZonedTime(
              `${firstDutyDate}T${String(Math.floor(reportMin / 60)).padStart(2, "0")}:${String(reportMin % 60).padStart(2, "0")}:00.000`,
              baseTimezone
            ).toISOString()
          : null;
      const arriveBy = reportIso ? subMinutes(new Date(reportIso), arrivalBuffer) : null;
      const primarySearchDate = arriveBy
        ? formatInTimeZone(arriveBy, baseTimezone, "yyyy-MM-dd")
        : firstDutyDate;

      let foundLeave = false;
      const depRes = await getCommuteFlights({
        origin: homeAirport,
        destination: destToBase,
        date: primarySearchDate,
      });
      if (depRes.ok && depRes.flights.length > 0 && arriveBy) {
        if (hasFlightArrivingBy(depRes.flights, arriveBy, depRes.destTz ?? baseTimezone)) {
          leaveHomeDate = primarySearchDate;
          foundLeave = true;
        }
      }
      if (!foundLeave && arriveBy) {
        const dayBefore = subtractDay(firstDutyDate);
        const depResPrior = await getCommuteFlights({
          origin: homeAirport,
          destination: destToBase,
          date: dayBefore,
        });
        if (depResPrior.ok && depResPrior.flights.length > 0 && hasFlightArrivingBy(depResPrior.flights, arriveBy, depResPrior.destTz ?? baseTimezone)) {
          leaveHomeDate = dayBefore;
          foundLeave = true;
        }
      }
      if (!foundLeave) {
        const commuteInfo = getCommuteInfoForTrip(trip, profile, baseTimezone);
        leaveHomeDate = commuteInfo?.commuteDateStr ?? firstDutyDate;
      }

      const dutyEndTime = new Date(trip.end_time);
      const departAfter = addMinutes(dutyEndTime, releaseBuffer);
      const returnSearchDate = formatInTimeZone(departAfter, baseTimezone, "yyyy-MM-dd");

      let foundReturn = false;
      const retRes = await getCommuteFlights({
        origin: dutyEndAirport,
        destination: homeAirport,
        date: returnSearchDate,
      });
      if (retRes.ok && retRes.flights.length > 0) {
        const arrDate = getReturnHomeDateFromFlights(
          retRes.flights,
          departAfter,
          retRes.destTz ?? baseTimezone
        );
        if (arrDate) {
          returnHomeDate = arrDate;
          foundReturn = true;
        }
      }
      if (!foundReturn) {
        const nextDay = addDay(lastDutyDate);
        const retResNext = await getCommuteFlights({
          origin: dutyEndAirport,
          destination: homeAirport,
          date: nextDay,
        });
        if (retResNext.ok && retResNext.flights.length > 0) {
          const nextDayStart = fromZonedTime(`${nextDay}T00:00:00.000`, baseTimezone);
          const arrDate = getReturnHomeDateFromFlights(
            retResNext.flights,
            nextDayStart,
            retResNext.destTz ?? baseTimezone
          );
          if (arrDate) {
            returnHomeDate = arrDate;
            foundReturn = true;
          }
        }
      }
      if (!foundReturn) {
        returnHomeDate = returnSearchDate === lastDutyDate ? lastDutyDate : addDay(lastDutyDate);
      }
    }
  }

  const diff = differenceInCalendarDays(
    new Date(returnHomeDate + "T12:00:00.000Z"),
    new Date(leaveHomeDate + "T12:00:00.000Z")
  );
  return Math.max(1, diff + 1);
}
