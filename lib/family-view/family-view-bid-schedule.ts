import type { ScheduleEvent } from "@/app/frontier/pilots/portal/schedule/actions";
import { formatInTimeZone } from "date-fns-tz";
import { getBidPeriodBounds, getBidPeriodForDate } from "@/lib/frontier-bid-periods";

function filterFamilyViewEvents(events: ScheduleEvent[]): ScheduleEvent[] {
  return events.filter((e) => e.is_muted !== true);
}

function eventLocalDateBounds(
  event: ScheduleEvent,
  timezone: string
): { start: string; end: string } {
  return {
    start: formatInTimeZone(new Date(event.start_time), timezone, "yyyy-MM-dd"),
    end: formatInTimeZone(new Date(event.end_time), timezone, "yyyy-MM-dd"),
  };
}

function yyyyMmddRangesOverlap(a0: string, a1: string, b0: string, b1: string): boolean {
  return a0 <= b1 && a1 >= b0;
}

/** True if any non-muted event overlaps the bid-period inclusive date range (local calendar days). */
export function eventsTouchBidPeriod(
  events: ScheduleEvent[],
  periodStartYmd: string,
  periodEndYmd: string,
  timezone: string
): boolean {
  for (const e of filterFamilyViewEvents(events)) {
    const { start, end } = eventLocalDateBounds(e, timezone);
    if (yyyyMmddRangesOverlap(start, end, periodStartYmd, periodEndYmd)) {
      return true;
    }
  }
  return false;
}

export type FamilyViewBidGap =
  | { active: false }
  | {
      active: true;
      /** Hide Week Ahead / Upcoming rows with dateStr >= this (YYYY-MM-DD, Frontier bid local). */
      hideDayRowsFromYmd: string;
      nextBidName: string;
      nextBidStartYmd: string;
      nextBidEndYmd: string;
    };

/**
 * If the next Frontier bid period intersects the forward Family View day list but no imported
 * schedule rows fall in that bid period, Family View should not show a streak of false "Day Off"
 * days — hide those rows and show a bid-period placeholder instead.
 */
export function computeFamilyViewBidGap(args: {
  todayYmd: string;
  timezone: string;
  events: ScheduleEvent[];
  /** First calendar day in Week Ahead (T+1). */
  firstForwardDayYmd: string;
  /** Last calendar day in Upcoming (≈ T+35). */
  lastForwardDayYmd: string;
}): FamilyViewBidGap {
  const { todayYmd, timezone, events, firstForwardDayYmd, lastForwardDayYmd } = args;
  const year = Number(todayYmd.slice(0, 4));
  if (!Number.isFinite(year)) {
    return { active: false };
  }

  const current = getBidPeriodForDate(todayYmd, year);
  if (!current) {
    return { active: false };
  }

  let nextYear = year;
  let nextIndex = current.bidMonthIndex + 1;
  if (nextIndex >= 12) {
    nextIndex = 0;
    nextYear = year + 1;
  }

  const nextBounds = getBidPeriodBounds(nextYear, nextIndex);
  if (!nextBounds) {
    return { active: false };
  }

  const { name: nextBidName, startStr: nextStart, endStr: nextEnd } = nextBounds;

  // Next bid does not intersect what we render as Week Ahead + Upcoming.
  if (nextStart > lastForwardDayYmd || nextEnd < firstForwardDayYmd) {
    return { active: false };
  }

  if (eventsTouchBidPeriod(events, nextStart, nextEnd, timezone)) {
    return { active: false };
  }

  return {
    active: true,
    hideDayRowsFromYmd: nextStart,
    nextBidName,
    nextBidStartYmd: nextStart,
    nextBidEndYmd: nextEnd,
  };
}

/** Next Frontier bid period after "today" (local calendar date in the bid table’s year). */
export function getNextBidPeriodForFamilyView(todayYmd: string): {
  name: string;
  startStr: string;
  endStr: string;
} | null {
  const year = Number(todayYmd.slice(0, 4));
  if (!Number.isFinite(year)) {
    return null;
  }
  const current = getBidPeriodForDate(todayYmd, year);
  if (!current) {
    return null;
  }
  let nextYear = year;
  let nextIndex = current.bidMonthIndex + 1;
  if (nextIndex >= 12) {
    nextIndex = 0;
    nextYear = year + 1;
  }
  const nextBounds = getBidPeriodBounds(nextYear, nextIndex);
  if (!nextBounds) {
    return null;
  }
  return { name: nextBounds.name, startStr: nextBounds.startStr, endStr: nextBounds.endStr };
}
