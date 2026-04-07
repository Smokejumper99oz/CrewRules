/**
 * Family View commute inference.
 * Infers "Likely traveling to work" for fly-in commuters.
 * Uses "Likely" language only; does not claim certainty.
 */

import type { ScheduleEvent } from "@/app/frontier/pilots/portal/schedule/actions";
import type { Profile } from "@/lib/profile";
import { getTripDateStrings } from "@/lib/leg-dates";
import { formatDayLabel } from "@/lib/schedule-time";
import { formatInTimeZone } from "date-fns-tz";

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

/** 10:00 AM = 600 minutes. */
const REPORT_BEFORE_10AM_THRESHOLD_MINUTES = 600;

/**
 * Returns true if the user is a commuter (flies to base).
 * Uses: home_airport exists, base_airport exists, and they differ.
 */
export function isCommuter(profile: Profile | null): boolean {
  if (!profile) return false;
  const home = (profile.home_airport ?? "").trim().toUpperCase();
  const base = (profile.base_airport ?? "").trim().toUpperCase();
  return home.length === 3 && base.length === 3 && home !== base;
}

/** Structured commute info for Family View display. */
export type CommuteInfo = {
  note: string;
  commuteDateStr: string;
  commuteDayLabel: string;
  commuteTimingLabel: "evening before" | "that morning";
};

/**
 * V1 commute timing rule:
 * - Report before 10:00 AM base time → likely traveling the evening before (day prior)
 * - Report at 10:00 AM or later → likely traveling that morning (same day)
 */
function getCommuteTiming(
  reportMin: number,
  firstDutyDateStr: string,
  baseTimezone: string
): { note: string; commuteDateStr: string; commuteTimingLabel: "evening before" | "that morning" } {
  const [y, m, d] = firstDutyDateStr.split("-").map(Number);
  const prevDay = new Date(Date.UTC(y, m - 1, d - 1));
  const prevDayStr = prevDay.toISOString().slice(0, 10);

  if (reportMin < REPORT_BEFORE_10AM_THRESHOLD_MINUTES) {
    return {
      note: "Likely traveling to work the evening before",
      commuteDateStr: prevDayStr,
      commuteTimingLabel: "evening before",
    };
  }
  return {
    note: "Likely traveling to work that morning",
    commuteDateStr: firstDutyDateStr,
    commuteTimingLabel: "that morning",
  };
}

/**
 * Get structured commute info for a trip (e.g. Next Trip).
 * Returns null if not a commuter or event is not a trip.
 */
export function getCommuteInfoForTrip(
  event: ScheduleEvent,
  profile: Profile | null,
  baseTimezone: string
): CommuteInfo | null {
  if (event.event_type !== "trip") return null;
  if (!isCommuter(profile)) return null;

  // If the trip's first leg departs from the pilot's home airport, no commute travel
  // is needed — they just drive to their local airport. Do not generate a commute day.
  const homeIata = (profile?.home_airport ?? "").trim().toUpperCase();
  const firstLegOrigin = ((event.legs ?? [])[0] as { origin?: string } | undefined)
    ?.origin?.trim().toUpperCase() ?? "";
  if (homeIata.length === 3 && firstLegOrigin === homeIata) return null;

  // Use report_time when available; fall back to start_time converted to local HH:MM.
  // report_time can be null on freshly-imported trips not yet updated by ELP.
  let reportMin = reportTimeToMinutes(event.report_time ?? null);
  if (reportMin == null && event.start_time) {
    try {
      const localHHMM = formatInTimeZone(new Date(event.start_time), baseTimezone, "HH:mm");
      reportMin = reportTimeToMinutes(localHHMM);
    } catch {
      // ignore parse errors
    }
  }
  if (reportMin == null) return null;

  const tripDates = getTripDateStrings(event.start_time, event.end_time, baseTimezone);
  const firstDutyDate = tripDates[0];
  if (!firstDutyDate) return null;

  const { note, commuteDateStr, commuteTimingLabel } = getCommuteTiming(
    reportMin,
    firstDutyDate,
    baseTimezone
  );
  const commuteDayLabel = formatDayLabel(`${commuteDateStr}T12:00:00.000Z`, baseTimezone);

  return { note, commuteDateStr, commuteDayLabel, commuteTimingLabel };
}

/**
 * Returns a family-friendly note when the given dateStr is the commute day for this trip.
 * Used by getStatusForDay and This Week / Upcoming rows.
 */
export function isLikelyCommuteDayBefore(
  event: ScheduleEvent,
  dateStr: string,
  profile: Profile | null,
  baseTimezone: string
): string | null {
  const info = getCommuteInfoForTrip(event, profile, baseTimezone);
  if (!info || info.commuteDateStr !== dateStr) return null;
  return info.note;
}
