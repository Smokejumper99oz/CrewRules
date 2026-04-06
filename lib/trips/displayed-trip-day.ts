/**
 * Displayed trip day from consecutive-leg rest gaps (same base-timezone wall-clock model as leg-dates).
 */

import type { ScheduleEvent, ScheduleEventLeg } from "@/app/frontier/pilots/portal/schedule/actions";
import {
  computeLegDates,
  getLegsForDate,
  getNextActionableLeg,
  getTripDateStrings,
  isDateFullyComplete,
  todayStr,
} from "@/lib/leg-dates";
import { addDay } from "@/lib/schedule-time";
import { fromZonedTime } from "date-fns-tz";

export type GetDisplayedTripDayInfoOptions = {
  minRestHours?: number;
  releaseBufferMinutes?: number;
  now?: Date;
};

export type DisplayedTripDayInfo = {
  displayedTripLength: number;
  displayedTripDay: number;
  bucketIds: number[];
};

/** Matches leg-dates `timeToMinutes` for dep/arr wall times. */
function timeToMinutes(t: string | undefined): number | null {
  if (!t?.trim()) return null;
  const s = t.trim().replace(":", "");
  if (!/^\d{3,4}$/.test(s)) return null;
  const h = parseInt(s.slice(0, -2) || "0", 10);
  const m = parseInt(s.slice(-2), 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** Same wall-clock → instant pattern as legCrewReleasedFromLeg (base timezone). */
function legWallInstantMs(
  dateStr: string | null,
  timeStr: string | undefined,
  timezone: string
): number | null {
  const mins = timeToMinutes(timeStr);
  if (!dateStr || mins == null) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const localIso = `${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  try {
    return fromZonedTime(localIso, timezone).getTime();
  } catch {
    return null;
  }
}

function tryBucketIdsFromRestGaps(
  legs: ScheduleEventLeg[],
  tripDateStrs: string[],
  timezone: string,
  minRestHours: number
): number[] | null {
  const rows = computeLegDates(legs, tripDateStrs, timezone);
  const n = legs.length;
  if (n === 0) return null;
  const bucketIds: number[] = new Array(n).fill(0);

  for (let i = 0; i < n - 1; i++) {
    const rowI = rows[i];
    const rowNext = rows[i + 1];
    const arrDate = rowI?.arrivalDate ?? rowI?.departureDate ?? null;
    const depDateNext = rowNext?.departureDate ?? null;
    const arrMs = legWallInstantMs(arrDate, legs[i]?.arrTime, timezone);
    const depMsNext = legWallInstantMs(depDateNext, legs[i + 1]?.depTime, timezone);
    if (arrMs == null || depMsNext == null) return null;

    const gapMs = depMsNext - arrMs;
    const gapHours = gapMs / 3600000;
    const increment = gapHours >= minRestHours ? 1 : 0;
    bucketIds[i + 1] = bucketIds[i]! + increment;
  }

  return bucketIds;
}

function calendarFallbackTripDay(
  event: Pick<ScheduleEvent, "start_time" | "end_time" | "legs">,
  timezone: string,
  releaseBufferMinutes: number
): { displayedTripLength: number; displayedTripDay: number } {
  const tripDateStrs = getTripDateStrings(event.start_time, event.end_time, timezone);
  const legs = event.legs ?? [];
  const today = todayStr(timezone);
  const todayIndex = tripDateStrs.indexOf(today);
  let displayIndex = Math.max(0, todayIndex);
  if (todayIndex >= 0 && isDateFullyComplete(legs, today, tripDateStrs, timezone, releaseBufferMinutes)) {
    const tomorrow = addDay(today);
    const tomorrowIndex = tripDateStrs.indexOf(tomorrow);
    if (tomorrowIndex >= 0) {
      const legsForTomorrow = getLegsForDate(legs, tomorrow, tripDateStrs, timezone);
      if (legsForTomorrow.length > 0) {
        displayIndex = tomorrowIndex;
      }
    }
  }
  if (todayIndex < 0) {
    displayIndex = 0;
  }
  return {
    displayedTripLength: Math.max(1, tripDateStrs.length),
    displayedTripDay: displayIndex + 1,
  };
}

/**
 * Trip display length and current day from rest gaps between consecutive legs (>= minRestHours → new day).
 * Falls back to calendar span + today index when legs or dates are insufficient.
 */
export function getDisplayedTripDayInfo(
  event: Pick<ScheduleEvent, "start_time" | "end_time" | "legs" | "event_type">,
  timezone: string,
  options?: GetDisplayedTripDayInfoOptions
): DisplayedTripDayInfo {
  const minRestHours = options?.minRestHours ?? 10;
  const releaseBufferMinutes = Math.max(0, options?.releaseBufferMinutes ?? 0);

  const tripDateStrs = getTripDateStrings(event.start_time, event.end_time, timezone);
  const legs = event.legs ?? [];

  const fallback = (): DisplayedTripDayInfo => {
    const cal = calendarFallbackTripDay(event, timezone, releaseBufferMinutes);
    return {
      ...cal,
      bucketIds: [],
    };
  };

  if (event.event_type !== "trip" || legs.length === 0 || tripDateStrs.length === 0) {
    return fallback();
  }

  const bucketIds = tryBucketIdsFromRestGaps(legs, tripDateStrs, timezone, minRestHours);
  if (!bucketIds) {
    return fallback();
  }

  const displayedTripLength = Math.max(1, Math.max(...bucketIds) + 1);

  const next = getNextActionableLeg(legs, tripDateStrs, timezone, releaseBufferMinutes);
  let legIndex: number;
  if (next) {
    legIndex = legs.indexOf(next);
    if (legIndex < 0) {
      legIndex = legs.findIndex(
        (l) =>
          l.origin === next.origin &&
          l.destination === next.destination &&
          (l.depTime ?? "") === (next.depTime ?? "") &&
          (l.flightNumber ?? "") === (next.flightNumber ?? "")
      );
    }
    if (legIndex < 0) legIndex = 0;
  } else {
    legIndex = Math.max(0, legs.length - 1);
  }

  const displayedTripDay = Math.min(displayedTripLength, Math.max(1, bucketIds[legIndex]! + 1));

  return {
    displayedTripLength,
    displayedTripDay,
    bucketIds,
  };
}
