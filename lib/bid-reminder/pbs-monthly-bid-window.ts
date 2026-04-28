import { addHours } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { Profile } from "@/lib/profile";

export const PBS_BID_REMINDER_FALLBACK_TZ = "America/Denver";

/** PBS monthly bid opens 1st of month at 09:00 in the pilot's base timezone (LDT). */
function firstOfMonthNineAmUtc(year: number, monthIndex0: number, timeZone: string): Date {
  const m = monthIndex0 + 1;
  const y = year;
  const local = `${y}-${String(m).padStart(2, "0")}-01T09:00:00`;
  return fromZonedTime(local, timeZone);
}

function parseYearMonthInTz(now: Date, timeZone: string): { y: number; m0: number } {
  const ymd = formatInTimeZone(now, timeZone, "yyyy-MM-dd");
  const [yStr, mStr] = ymd.split("-");
  const y = parseInt(yStr, 10);
  const m0 = parseInt(mStr, 10) - 1;
  if (!Number.isFinite(y) || !Number.isFinite(m0) || m0 < 0 || m0 > 11) {
    const d = new Date(now);
    return { y: d.getUTCFullYear(), m0: d.getUTCMonth() };
  }
  return { y, m0 };
}

/**
 * The monthly bid opening instant for the current cycle: this month's 1st @ 09:00 local,
 * unless that instant is already in the past, then next month's.
 */
export function getApplicablePbsBidOpeningUtc(now: Date, timeZone: string): Date {
  const tz = timeZone.trim() || PBS_BID_REMINDER_FALLBACK_TZ;
  const { y, m0 } = parseYearMonthInTz(now, tz);
  let O = firstOfMonthNineAmUtc(y, m0, tz);
  if (now.getTime() > O.getTime()) {
    let ny = y;
    let nm = m0 + 1;
    if (nm > 11) {
      nm = 0;
      ny += 1;
    }
    O = firstOfMonthNineAmUtc(ny, nm, tz);
  }
  return O;
}

export function isInPbsBidReminderWindow(now: Date, openingUtc: Date): boolean {
  const windowStart = addHours(openingUtc, -24);
  const t = now.getTime();
  return t >= windowStart.getTime() && t <= openingUtc.getTime();
}

export function getBidReminderMonthKey(openingUtc: Date, timeZone: string): string {
  const tz = timeZone.trim() || PBS_BID_REMINDER_FALLBACK_TZ;
  return formatInTimeZone(openingUtc, tz, "yyyy-MM");
}

export function formatBidOpeningLine(openingUtc: Date, timeZone: string): string {
  const tz = timeZone.trim() || PBS_BID_REMINDER_FALLBACK_TZ;
  return formatInTimeZone(openingUtc, tz, "MMMM d, yyyy 'at' h:mm a zzz");
}

export type BidReminderPhase1Visibility = {
  inWindow: boolean;
  openingUtc: Date;
  reminderMonth: string;
  openingLine: string;
};

/**
 * Whether the Phase 1 PBS bid reminder window applies (time only — not prefs).
 */
export function getBidReminderPhase1WindowInfo(
  now: Date,
  baseTimezone: string | null | undefined
): BidReminderPhase1Visibility | null {
  const tz = baseTimezone?.trim() || PBS_BID_REMINDER_FALLBACK_TZ;
  const openingUtc = getApplicablePbsBidOpeningUtc(now, tz);
  if (!isInPbsBidReminderWindow(now, openingUtc)) {
    return null;
  }
  return {
    inWindow: true,
    openingUtc,
    reminderMonth: getBidReminderMonthKey(openingUtc, tz),
    openingLine: formatBidOpeningLine(openingUtc, tz),
  };
}

export function shouldShowBidReminderBannerPhase1(
  profile: Profile | null,
  now: Date
): (BidReminderPhase1Visibility & { timeZone: string }) | null {
  if (!profile) return null;
  const tz = profile.base_timezone?.trim() || PBS_BID_REMINDER_FALLBACK_TZ;
  const info = getBidReminderPhase1WindowInfo(now, tz);
  if (!info) return null;

  const suppressed = (profile.bid_reminder_suppressed_month ?? "").trim();
  if (suppressed === info.reminderMonth) return null;

  const snoozedUntilRaw = profile.bid_reminder_snoozed_until;
  if (snoozedUntilRaw) {
    const snoozedUntil = new Date(snoozedUntilRaw).getTime();
    if (Number.isFinite(snoozedUntil) && snoozedUntil > now.getTime()) {
      return null;
    }
  }

  return { ...info, timeZone: tz };
}
