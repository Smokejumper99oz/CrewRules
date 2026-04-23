import type { ScheduleEvent } from "@/app/frontier/pilots/portal/schedule/actions";

/** Merge same-day completed duty into forward-window events so Family View Today stays truthful. */
export function mergeFamilyViewScheduleEvents(
  events: ScheduleEvent[],
  endedToday: ScheduleEvent | null
): ScheduleEvent[] {
  if (!endedToday) return events;
  if (events.some((e) => e.id === endedToday.id)) return events;
  return [...events, endedToday].sort((a, b) => a.start_time.localeCompare(b.start_time));
}
