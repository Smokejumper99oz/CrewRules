/**
 * Trip card leg prep for Dashboard + Upcoming (not a Server Action — keep out of "use server" modules).
 */

import type { NextDutyLabel, ScheduleEvent, ScheduleEventLeg } from "@/app/frontier/pilots/portal/schedule/actions";
import {
  computeLegDates,
  getLegsForDate,
  getTripDateStrings,
  sliceNextTwoProgressiveLegs,
  todayStr,
} from "@/lib/leg-dates";

/** Shapes `withLegsToShow` and Dashboard / Upcoming trip cards (same helpers as `getNextDuty`). */
export type ScheduleCardLegDateHelpers = {
  getTripDateStrings: (a: string, b: string, tz: string) => string[];
  getLegsForDate: (legs: ScheduleEventLeg[], d: string, trip: string[], tz: string) => ScheduleEventLeg[];
  todayStr: (tz: string) => string;
  sliceNextTwoProgressiveLegs: (
    legs: ScheduleEventLeg[],
    trip: string[],
    tz: string,
    releaseBufferMinutes?: number,
    progressiveAnchorCalendarDay?: string | null
  ) => ScheduleEventLeg[];
  computeLegDates: (
    legs: ScheduleEventLeg[],
    trip: string[],
    tz: string
  ) => { leg: ScheduleEventLeg; departureDate: string | null; arrivalDate: string | null }[];
};

export const scheduleCardLegDateHelpers: ScheduleCardLegDateHelpers = {
  getTripDateStrings,
  getLegsForDate,
  todayStr,
  sliceNextTwoProgressiveLegs,
  computeLegDates,
};

/** Shared trip-card prep: progressive legs + display date (Dashboard + Upcoming). */
export function withLegsToShow(
  event: ScheduleEvent,
  dateStr: string | null,
  timezone: string,
  label: NextDutyLabel,
  hasSchedule: boolean,
  legDates: ScheduleCardLegDateHelpers,
  releaseBufferMinutes = 0,
  progressiveAnchorCalendarDay: string | null | undefined = undefined
): {
  event: ScheduleEvent;
  label: NextDutyLabel;
  hasSchedule: boolean;
  legsToShow?: ScheduleEventLeg[] | null;
  displayDateStr?: string | null;
} {
  const legs = event.legs ?? [];
  if (legs.length === 0) return { event, label, hasSchedule };
  const tripDates = legDates.getTripDateStrings(event.start_time, event.end_time, timezone);
  const targetDate = dateStr ?? legDates.todayStr(timezone);
  const legsForDate = legDates.getLegsForDate(legs, targetDate, tripDates, timezone);

  let legsToShow: ScheduleEventLeg[] = legsForDate;
  let displayDateOut: string | null = dateStr ?? legDates.todayStr(timezone);

  if (event.event_type === "trip" && (label === "later_today" || label === "next_duty")) {
    const progressive = legDates.sliceNextTwoProgressiveLegs(
      legs,
      tripDates,
      timezone,
      releaseBufferMinutes,
      progressiveAnchorCalendarDay ?? null
    );
    if (progressive.length > 0) {
      const sliced = label === "later_today" ? progressive.slice(0, 1) : progressive;
      legsToShow = sliced;
      const rows = legDates.computeLegDates(legs, tripDates, timezone);
      const firstRow = rows.find((r) => r.leg === sliced[0]);
      if (firstRow?.departureDate) {
        displayDateOut = firstRow.departureDate;
      }
    }
  }

  return {
    event,
    label,
    hasSchedule,
    legsToShow,
    displayDateStr: displayDateOut,
  };
}
