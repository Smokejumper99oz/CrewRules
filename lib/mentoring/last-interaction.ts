import { differenceInCalendarDays, format, isToday, isYesterday, startOfDay } from "date-fns";

export type LastInteractionRecency = "none" | "fresh" | "warm" | "stale";

/** Display string (Today, Yesterday, N days ago, full date, Never). */
export function formatLastInteractionLabel(iso: string | null): string {
  if (!iso?.trim()) return "Never";
  try {
    const d = new Date(iso.trim());
    if (Number.isNaN(d.getTime())) return "Never";
    const dDate = startOfDay(d);
    const today = startOfDay(new Date());
    if (isToday(dDate)) return "Today";
    if (isYesterday(dDate)) return "Yesterday";
    const days = differenceInCalendarDays(today, dDate);
    if (days <= 30) return `${days} days ago`;
    return format(d, "MMMM d, yyyy");
  } catch {
    return "Never";
  }
}

/**
 * Calendar-aligned with `formatLastInteractionLabel` (local start-of-day):
 * fresh = today; warm = yesterday through 7 days ago; stale = older; none = missing/invalid.
 * Future calendar dates are treated as fresh.
 */
export function getLastInteractionRecency(iso: string | null): LastInteractionRecency {
  if (!iso?.trim()) return "none";
  const d = new Date(iso.trim());
  if (Number.isNaN(d.getTime())) return "none";

  const interactionDay = startOfDay(d);
  const today = startOfDay(new Date());
  const dayDiff = differenceInCalendarDays(today, interactionDay);

  if (dayDiff <= 0) return "fresh";
  if (dayDiff === 1) return "warm";
  if (dayDiff >= 2 && dayDiff <= 7) return "warm";
  return "stale";
}
