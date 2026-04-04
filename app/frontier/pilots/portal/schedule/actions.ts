"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin, isProActive } from "@/lib/profile";
import { getTenantSourceTimezone, getReserveCreditPerDay } from "@/lib/tenant-config";
import {
  addDay,
  computeTripCredit,
  expandEventToDaySegmentsInRange,
  type DaySegment,
} from "@/lib/schedule-time";
import { formatInTimeZone } from "date-fns-tz";
import { getBidPeriodBounds, getBidPeriodForTimestamp, getAllBidPeriodsForYear, getFrontierBidPeriodTimezone } from "@/lib/frontier-bid-periods";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";
import { getPayScale } from "@/lib/tenant-settings";
import { TENANT_CONFIG } from "@/lib/tenant-config";
import { payYearFromDOH } from "@/lib/pay-utils";
import { type TripChangeSummary } from "@/lib/trips/detect-trip-changes";
import { getInboundEmailForDisplay } from "@/lib/email/get-inbound-email-for-display";
import { importIcsFromText } from "@/lib/schedule/import-ics-from-text";

const FLICA_SOURCE = "flica_import";

function maxConsecutiveDateStrDays(dateStrs: Set<string>): number {
  const sorted = Array.from(dateStrs).sort(); // YYYY-MM-DD sorts correctly
  let best = 0;
  let cur = 0;
  let prev: Date | null = null;

  for (const d of sorted) {
    const dt = new Date(d + "T00:00:00Z");
    if (prev) {
      const diffDays = Math.round((dt.getTime() - prev.getTime()) / 86400000);
      cur = diffDays === 1 ? cur + 1 : 1;
    } else {
      cur = 1;
    }
    if (cur > best) best = cur;
    prev = dt;
  }
  return best;
}

export type ImportIcsResult =
  | { success: string; count: number; importedAt: string; tripChangeSummaries: TripChangeSummary[] }
  | { error: string; technicalError?: string };

/** Check if current user is admin (for showing technical error details). */
export async function getIsAdmin(): Promise<boolean> {
  return isAdmin("frontier", "pilots");
}

/** Get schedule import email (alias@import.crewrules.com). Returns null for legacy u_ aliases. Not Pro-only. */
export async function getScheduleImportEmail(): Promise<string | null> {
  const profile = await getProfile();
  if (!profile) return null;
  try {
    return await getInboundEmailForDisplay(profile.id);
  } catch {
    return null;
  }
}

export async function importIcsFile(formData: FormData): Promise<ImportIcsResult> {
  const profile = await getProfile();
  if (!profile) {
    return { error: "Not signed in" };
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { error: "Please select a file" };
  }

  let icsText: string;
  try {
    icsText = await file.text();
  } catch {
    return { error: "Could not read file" };
  }

  const sourceTimezone =
    profile.base_timezone ??
    (profile.base_airport ? getTimezoneFromAirport(profile.base_airport) : null);

  const supabase = await createClient();
  const result = await importIcsFromText({
    supabase,
    userId: profile.id,
    icsText,
    sourceTimezone,
    tenant: profile.tenant ?? "frontier",
    portal: profile.portal ?? "pilots",
  });

  if ("error" in result) return result;

  const tenant = profile.tenant ?? "frontier";
  const portal = profile.portal ?? "pilots";
  revalidatePath(`/${tenant}/${portal}/portal`);
  revalidatePath(`/${tenant}/${portal}/portal/schedule`);

  return result;
}

/** Clear FLICA-imported schedule for the current user. Use before re-uploading to test. */
export async function clearScheduleImport(): Promise<{ success: boolean; error?: string }> {
  const profile = await getProfile();
  if (!profile) return { success: false, error: "Not signed in" };

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("schedule_events")
      .delete()
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE);

    if (error) return { success: false, error: error.message };

    await supabase.from("trip_change_summaries").delete().eq("user_id", profile.id);

    const tenant = profile.tenant ?? "frontier";
    const portal = profile.portal ?? "pilots";
    revalidatePath(`/${tenant}/${portal}/portal`);
    revalidatePath(`/${tenant}/${portal}/portal/schedule`);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

/** Fetch recent trip change summaries for the current user (from last import). Used by dashboard Current Trip card. */
export async function getTripChangeSummariesForUser(userId: string): Promise<TripChangeSummary[]> {
  if (!userId?.trim()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("trip_change_summaries")
    .select("summary")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (!data?.length) return [];
  return data.map((r) => r.summary as TripChangeSummary);
}

export type ScheduleImportStatus = {
  count: number;
  lastImportedAt: string | null;
  status: "no_schedule" | "up_to_date" | "outdated";
  error?: string;
};

export type ScheduleEventLeg = {
  day?: string;
  flightNumber?: string;
  origin: string;
  destination: string;
  depTime?: string;
  arrTime?: string;
  blockMinutes?: number;
  deadhead?: boolean;
  raw?: string;
};

export type ScheduleEvent = {
  id: string;
  start_time: string;
  end_time: string;
  title: string | null;
  event_type: string;
  report_time?: string | null;
  credit_hours?: number | null;
  credit_minutes?: number | null;
  baseline_credit_minutes?: number | null;
  route?: string | null;
  pairing_days?: number | null;
  block_minutes?: number | null;
  first_leg_departure_time?: string | null;
  /** Trip from short-call reserve (RSA/RSB/etc): credit = 4 hrs/day, no block. */
  is_reserve_assignment?: boolean | null;
  is_muted?: boolean | null;
  import_batch_id?: string | null;
  imported_at?: string | null;
  legs?: ScheduleEventLeg[] | null;
};

export type NextDutyLabel = "on_duty" | "later_today" | "next_duty" | "post_duty_release";

/** True if title is a vacation code (e.g. V35, V15). Trim + uppercase, match /^V\d+$/. */
function isVacationCode(title: string | null | undefined): boolean {
  const t = (title ?? "").trim().toUpperCase();
  return /^V\d+$/.test(t);
}

export async function getNextDuty(): Promise<{
  event: ScheduleEvent | null;
  label: NextDutyLabel | null;
  hasSchedule: boolean;
  legsToShow?: ScheduleEventLeg[] | null;
  displayDateStr?: string | null;
  /** True when event overlaps now (start <= now < end); Commute Assist uses for to_home vs to_base. */
  isInPairing?: boolean;
  /** When set, Commute Assist uses this direction instead of inferring from isInPairing / label. */
  commuteAssistDirection?: "to_home" | "to_base";
  /** True on last reserve day when now is within 4h before scheduled reserve end (overlapping reserve row only). */
  commuteAssistReserveEarlyReleaseWindow?: boolean;
  /** True when on overlapping reserve duty but outside the last-day early-release window — skip Commute Assist flight fetches. */
  commuteAssistSuppressFlightSearch?: boolean;
  error?: string;
}> {
  const profile = await getProfile();
  if (!profile) return { event: null, label: null, hasSchedule: false };

  try {
    const supabase = await createClient();
    const nowIso = new Date().toISOString();

    const baseAirport = profile.base_airport ?? null;
    const baseTimezone =
      profile.base_timezone ?? (baseAirport ? getTimezoneFromAirport(baseAirport) : getTenantSourceTimezone(profile.tenant));

    const { count } = await supabase
      .from("schedule_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE);

    const hasSchedule = (count ?? 0) > 0;

    const {
      getTripDateStrings,
      getLegsForDate,
      getNextLegForDate,
      isDateFullyComplete,
      todayStr,
    } = await import("@/lib/leg-dates");
    const { addDays } = await import("date-fns");
    const { formatInTimeZone } = await import("date-fns-tz");

    const today = todayStr(baseTimezone);
    const tomorrow = formatInTimeZone(addDays(new Date(), 1), baseTimezone, "yyyy-MM-dd");

    // 1. On duty: start <= now < end
    const { data: onDutyData, error: onDutyError } = await supabase
      .from("schedule_events")
      .select("id, start_time, end_time, title, event_type, report_time, credit_hours, credit_minutes, route, pairing_days, block_minutes, first_leg_departure_time, legs")
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE)
      .or("is_muted.eq.false,is_muted.is.null")
      .lte("start_time", nowIso)
      .gt("end_time", nowIso)
      .order("start_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (onDutyError) return { event: null, label: null, hasSchedule, error: onDutyError.message };
    if (onDutyData) {
      const ev = onDutyData as ScheduleEvent;
      if (!isVacationCode(ev.title)) {
      const reserveEarlyReleaseCommuteFields =
        ev.event_type === "reserve"
          ? (() => {
              const endMs = new Date(ev.end_time).getTime();
              if (Number.isNaN(endMs)) return {};
              const nowMs = Date.now();
              const fourH = 4 * 60 * 60 * 1000;
              if (nowMs < endMs - fourH || nowMs >= endMs) return {};
              const endDateStr = formatInTimeZone(new Date(ev.end_time), baseTimezone, "yyyy-MM-dd");
              if (endDateStr !== today) return {};
              return {
                commuteAssistDirection: "to_home" as const,
                commuteAssistReserveEarlyReleaseWindow: true as const,
              };
            })()
          : {};
      const reserveEarlyReleaseActive =
        reserveEarlyReleaseCommuteFields.commuteAssistReserveEarlyReleaseWindow === true;
      const legs = ev.legs ?? [];
      const tripDates = getTripDateStrings(ev.start_time, ev.end_time, baseTimezone);

      if (legs.length > 0 && tripDates.length > 0) {
        if (isDateFullyComplete(legs, today, tripDates, baseTimezone)) {
          const legsForTomorrow = getLegsForDate(legs, tomorrow, tripDates, baseTimezone);
          if (legsForTomorrow.length > 0) {
            return {
              event: ev,
              label: "next_duty",
              hasSchedule,
              legsToShow: legsForTomorrow,
              displayDateStr: tomorrow,
              isInPairing: true,
              commuteAssistSuppressFlightSearch: ev.event_type === "reserve" && !reserveEarlyReleaseActive,
              ...reserveEarlyReleaseCommuteFields,
            };
          }
          const nextEvent = await findNextEventForDate(supabase, profile.id, tomorrow, baseTimezone);
          if (nextEvent) {
            const nextTripDates = getTripDateStrings(nextEvent.start_time, nextEvent.end_time, baseTimezone);
            const nextLegs = getLegsForDate(nextEvent.legs ?? [], tomorrow, nextTripDates, baseTimezone);
            return {
              event: nextEvent,
              label: "next_duty",
              hasSchedule,
              legsToShow: nextLegs,
              displayDateStr: tomorrow,
              isInPairing: true,
              commuteAssistSuppressFlightSearch:
                nextEvent.event_type === "reserve" && !reserveEarlyReleaseActive,
              ...reserveEarlyReleaseCommuteFields,
            };
          }
        }
        const nextLeg = getNextLegForDate(legs, today, tripDates, baseTimezone);
        if (nextLeg) {
          return {
            event: ev,
            label: "on_duty",
            hasSchedule,
            legsToShow: [nextLeg],
            displayDateStr: today,
            isInPairing: true,
            commuteAssistSuppressFlightSearch: ev.event_type === "reserve" && !reserveEarlyReleaseActive,
            ...reserveEarlyReleaseCommuteFields,
          };
        }
      }
      return {
        event: ev,
        label: "on_duty",
        hasSchedule,
        isInPairing: true,
        commuteAssistSuppressFlightSearch: ev.event_type === "reserve" && !reserveEarlyReleaseActive,
        ...reserveEarlyReleaseCommuteFields,
      };
      }
    }

    // 2. Upcoming events: start >= now
    const { data: upcomingData, error: upcomingError } = await supabase
      .from("schedule_events")
      .select("id, start_time, end_time, title, event_type, report_time, credit_hours, credit_minutes, route, pairing_days, block_minutes, first_leg_departure_time, legs")
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE)
      .or("is_muted.eq.false,is_muted.is.null")
      .gte("start_time", nowIso)
      .order("start_time", { ascending: true })
      .limit(50);

    if (upcomingError) return { event: null, label: null, hasSchedule, error: upcomingError.message };

    const upcoming = (upcomingData ?? []) as ScheduleEvent[];

    const { data: lastEndedData, error: lastEndedError } = await supabase
      .from("schedule_events")
      .select("id, start_time, end_time, title, event_type, report_time, credit_hours, credit_minutes, route, pairing_days, block_minutes, first_leg_departure_time, legs")
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE)
      .or("is_muted.eq.false,is_muted.is.null")
      .lt("end_time", nowIso)
      .order("end_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastEndedError && lastEndedData) {
      const lastEndedEvent = lastEndedData as ScheduleEvent;
      if (!isVacationCode(lastEndedEvent.title)) {
        const endDate = formatInTimeZone(new Date(lastEndedEvent.end_time), baseTimezone, "yyyy-MM-dd");
        const nextStartsLater =
          upcoming.length === 0 || nowIso < upcoming[0].start_time;
        if (endDate === today && nextStartsLater) {
          const legDates = { getTripDateStrings, getLegsForDate, todayStr };
          return {
            ...withLegsToShow(lastEndedEvent, today, baseTimezone, "post_duty_release", hasSchedule, legDates),
            commuteAssistDirection: "to_home",
          };
        }
      }
    }

    if (upcoming.length === 0) {
      return { event: null, label: null, hasSchedule };
    }

    const { isEventStartToday } = await import("@/lib/schedule-time");

    // 2a. Later today: first event that starts today
    const laterToday = upcoming.find((e) => isEventStartToday(e.start_time, baseTimezone));
    if (laterToday) {
      const laterStartHour = parseInt(formatInTimeZone(new Date(laterToday.start_time), baseTimezone, "HH"), 10);
      const firstTomorrow = upcoming.find((e) => {
        const startStr = formatInTimeZone(new Date(e.start_time), baseTimezone, "yyyy-MM-dd");
        return startStr === tomorrow;
      });
      const legDates = { getTripDateStrings, getLegsForDate, todayStr };
      if (laterStartHour < 12 && firstTomorrow) {
        return { ...withLegsToShow(firstTomorrow, tomorrow, baseTimezone, "next_duty", hasSchedule, legDates), isInPairing: false };
      }
      return { ...withLegsToShow(laterToday, today, baseTimezone, "later_today", hasSchedule, legDates), isInPairing: false };
    }

    // 2b. Next duty: first future event — use first day of that duty
    const firstEvent = upcoming[0];
    const legDates = { getTripDateStrings, getLegsForDate, todayStr };
    const firstEventStartStr = formatInTimeZone(new Date(firstEvent.start_time), baseTimezone, "yyyy-MM-dd");
    return { ...withLegsToShow(firstEvent, firstEventStartStr, baseTimezone, "next_duty", hasSchedule, legDates), isInPairing: false };
  } catch (e) {
    return { event: null, label: null, hasSchedule: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

async function findNextEventForDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  dateStr: string,
  timezone: string
): Promise<ScheduleEvent | null> {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dayStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0)).toISOString();
  const dayEnd = new Date(Date.UTC(y, m - 1, d, 23, 59, 59)).toISOString();
  const { data } = await supabase
    .from("schedule_events")
    .select("id, start_time, end_time, title, event_type, report_time, credit_hours, credit_minutes, route, pairing_days, block_minutes, first_leg_departure_time, legs")
    .eq("user_id", userId)
    .eq("source", FLICA_SOURCE)
    .or("is_muted.eq.false,is_muted.is.null")
    .lte("start_time", dayEnd)
    .gte("end_time", dayStart)
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data ?? null) as ScheduleEvent | null;
}

function withLegsToShow(
  event: ScheduleEvent,
  dateStr: string | null,
  timezone: string,
  label: NextDutyLabel,
  hasSchedule: boolean,
  legDates: {
    getTripDateStrings: (a: string, b: string, tz: string) => string[];
    getLegsForDate: (legs: ScheduleEventLeg[], d: string, trip: string[], tz: string) => ScheduleEventLeg[];
    todayStr: (tz: string) => string;
  }
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
  return {
    event,
    label,
    hasSchedule,
    legsToShow: legsForDate,
    displayDateStr: dateStr ?? legDates.todayStr(timezone),
  };
}

export async function getScheduleEvents(fromIso: string, toIso: string): Promise<{
  events: ScheduleEvent[];
  error?: string;
}> {
  const profile = await getProfile();
  if (!profile) return { events: [] };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("schedule_events")
      .select("id, start_time, end_time, title, event_type, report_time, credit_hours, credit_minutes, baseline_credit_minutes, route, pairing_days, block_minutes, first_leg_departure_time, legs, is_muted, import_batch_id, imported_at")
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE)
      .lte("start_time", toIso)
      .gte("end_time", fromIso)
      .order("start_time", { ascending: true });

    if (error) return { events: [], error: error.message };
    return { events: (data ?? []) as ScheduleEvent[] };
  } catch (e) {
    return { events: [], error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function getScheduleImportStatus(): Promise<ScheduleImportStatus> {
  const profile = await getProfile();
  if (!profile) {
    return { count: 0, lastImportedAt: null, status: "no_schedule" };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("schedule_events")
      .select("imported_at")
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE)
      .order("imported_at", { ascending: false })
      .limit(1);

    if (error) {
      return { count: 0, lastImportedAt: null, status: "no_schedule", error: error.message };
    }

    const { count, error: countError } = await supabase
      .from("schedule_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE);

    if (countError) {
      return { count: 0, lastImportedAt: null, status: "no_schedule", error: countError.message };
    }

    const lastImportedAt = data?.[0]?.imported_at ?? null;
    const cnt = count ?? 0;
    let status: "no_schedule" | "up_to_date" | "outdated" = "no_schedule";
    if (cnt > 0 && lastImportedAt) {
      const daysSince = (Date.now() - new Date(lastImportedAt).getTime()) / (24 * 60 * 60 * 1000);
      status = daysSince <= 14 ? "up_to_date" : "outdated";
    }
    return { count: cnt, lastImportedAt, status };
  } catch (e) {
    return { count: 0, lastImportedAt: null, status: "no_schedule", error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function getUpcomingEvents(limit = 8): Promise<{ events: ScheduleEvent[]; error?: string }> {
  const profile = await getProfile();
  if (!profile) return { events: [] };

  try {
    const supabase = await createClient();
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("schedule_events")
      .select("id, start_time, end_time, title, event_type, report_time, credit_hours, credit_minutes, route, pairing_days, block_minutes, first_leg_departure_time, legs")
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE)
      .or("is_muted.eq.false,is_muted.is.null")
      .gte("start_time", nowIso)
      .order("start_time", { ascending: true })
      .limit(limit);

    if (error) return { events: [], error: error.message };
    return { events: (data ?? []) as ScheduleEvent[] };
  } catch (e) {
    return { events: [], error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export type ScheduleDisplaySettings = {
  baseTimezone: string;
  baseAirport: string | null;
  displayTimezoneMode: "base" | "device" | "toggle" | "both";
  timeFormat: "24h" | "12h";
  showTimezoneLabel: boolean;
  /** Tenant carrier code for flight number display prefix (e.g. F9 → F92300). */
  carrierCode?: string | null;
};

export async function getScheduleDisplaySettings(): Promise<ScheduleDisplaySettings> {
  const profile = await getProfile();
  if (!profile) {
    return {
      baseTimezone: getFrontierBidPeriodTimezone(),
      baseAirport: null,
      displayTimezoneMode: "base",
      timeFormat: "24h",
      showTimezoneLabel: false,
      carrierCode: null,
    };
  }
  const mode = profile.display_timezone_mode ?? "base";
  const baseAirport = profile.base_airport ?? null;
  const baseTimezone = getFrontierBidPeriodTimezone({
    baseTimezone: profile.base_timezone ?? (baseAirport ? getTimezoneFromAirport(baseAirport) : null),
    profileBaseTimezone: profile.base_timezone,
  });
  const carrierCode = (profile.tenant && TENANT_CONFIG[profile.tenant]?.carrier) ?? null;
  return {
    baseTimezone,
    baseAirport,
    displayTimezoneMode: mode === "toggle" ? "both" : mode,
    timeFormat: profile.time_format ?? "24h",
    showTimezoneLabel: profile.show_timezone_label ?? false,
    carrierCode,
  };
}

export type MonthStats = {
  trip: number;
  reserve: number;
  vacationOff: number;
  /** Trip block hours (wheels up–down). */
  totalBlock: number;
  /** Extra credit over block (min 5 hrs/day). */
  totalExtraCredit: number;
  /** Credit totals in minutes */
  tripCreditMinutes: number;
  reserveCreditMinutes: number;
  vacationCreditMinutes: number;
  rawCreditMinutes: number;
  /** Month Overview + pay estimate: floor at 75:00 when reserve guarantee applies (temporary reserve-line fallback). */
  displayCreditMinutes: number;
  guaranteeMinutes: number;
  creditAfterGuaranteeMinutes: number;
  /** Line credit after reserve guarantee floor, plus pickup / non-line trip credit (pre-premium). */
  finalCreditedMinutes: number;
  paidMinutes: number;
  /** Credit minutes for display (always equals paidMinutes) */
  creditMinutes: number;
  /** credit_minutes - baseline_credit_minutes (delta from imported baseline) */
  creditDeltaMinutes?: number;
  /** RSL days count (for guarantee logic) */
  rslDaysCount?: number;
  /** True if RSL streak ≥ 7 consecutive days (FDO line, 75-hr guarantee) */
  isFDO?: boolean;
  /** Longest consecutive RSL day streak in the month */
  rslStreak?: number;
  /** Pro with setting off: show "Pay hidden" for privacy */
  payHidden?: boolean;
  /** Pro user is eligible for pay projection */
  payEligible?: boolean;
  /** Missing inputs needed to compute pay (e.g. pay scale, position, date of hire) */
  payMissingInputs?: string[];
  /** Pro-only: estimated gross pay projection */
  payProjection?: {
    pay20thHours: number;
    pay5thHours: number;
    pay20thGross: number;
    pay5thGross: number;
    totalGross: number;
    rate: number;
    year: number;
  };
  error?: string;
  /** DEV-only: debug pay/pro state */
  _debug?: {
    isPro?: boolean;
    subscription_tier?: string | null;
    pro_trial_expires_at?: string | null;
    show_pay_projection?: boolean | null;
  };
};

export type MonthOption = { year: number; month: number; label: string; shortLabel: string };

export async function getMonthStats(year?: number, bidMonthIndex?: number): Promise<MonthStats> {
  const profile = await getProfile();
  const emptyStats: MonthStats = {
    trip: 0,
    reserve: 0,
    vacationOff: 0,
    totalBlock: 0,
    totalExtraCredit: 0,
    tripCreditMinutes: 0,
    reserveCreditMinutes: 0,
    vacationCreditMinutes: 0,
    rawCreditMinutes: 0,
    displayCreditMinutes: 0,
    guaranteeMinutes: 0,
    creditAfterGuaranteeMinutes: 0,
    finalCreditedMinutes: 0,
    paidMinutes: 0,
    creditMinutes: 0,
  };
  if (!profile) return emptyStats;

  const baseTimezone = getFrontierBidPeriodTimezone({
    baseTimezone: profile.base_timezone ?? (profile.base_airport ? getTimezoneFromAirport(profile.base_airport) : null),
    profileBaseTimezone: profile.base_timezone,
  });
  const now = new Date();
  const y = year ?? now.getFullYear();
  const bidIdx =
    bidMonthIndex ?? getBidPeriodForTimestamp(now.toISOString(), baseTimezone, y)?.bidMonthIndex ?? 0;
  const bidPeriod = getBidPeriodBounds(y, bidIdx);
  if (!bidPeriod) return emptyStats;

  try {
    const startStr = bidPeriod.startStr + "T00:00:00.000Z";
    const endStr = bidPeriod.endStr + "T23:59:59.999Z";

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("schedule_events")
      .select("start_time, end_time, event_type, title, credit_hours, credit_minutes, baseline_credit_minutes, pairing_days, block_minutes, is_reserve_assignment, is_muted")
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE)
      .lte("start_time", endStr)
      .gte("end_time", startStr);

    if (error) return { ...emptyStats, error: error.message };

    const reserveCreditPerDay = getReserveCreditPerDay(profile.tenant ?? "frontier");

    // Cache pay code rules so we don't query per-event
    const payRuleCache = new Map<string, number>(); // key: `${tenant}|${role}|${code}` -> hours/day

    async function getHoursPerDayFromRules(code: string, onFailFallback: number): Promise<number> {
      if (!profile) return onFailFallback;
      const roleForRules =
        profile.role === "pilot" || profile.role === "flight_attendant"
          ? profile.role
          : "pilot"; // safe fallback for admins viewing stats

      const key = `${profile.tenant}|${roleForRules}|${code}`;
      const cached = payRuleCache.get(key);
      if (cached != null) return cached;

      const { data: ruleData, error: ruleError } = await supabase
        .from("pay_code_rules")
        .select("hours_per_day")
        .eq("tenant", profile.tenant)
        .eq("role", roleForRules)
        .eq("code", code)
        .maybeSingle();

      if (!ruleError && ruleData?.hours_per_day != null) {
        const v = Number(ruleData.hours_per_day);
        payRuleCache.set(key, v);
        return v;
      }

      // No rule found → fallback to the old behavior
      payRuleCache.set(key, onFailFallback);
      return onFailFallback;
    }

    const rows = (data ?? []) as {
      start_time: string;
      end_time: string;
      event_type: string;
      title: string | null;
      credit_hours: number | null;
      credit_minutes: number | null;
      baseline_credit_minutes: number | null;
      pairing_days: number | null;
      block_minutes: number | null;
      is_reserve_assignment: boolean | null;
      is_muted: boolean | null;
    }[];

    const reserveDays = new Set<string>();
    const rslDays = new Set<string>();
    const tripDays = new Set<string>();
    const trainingDays = new Set<string>();
    const seenTripKeys = new Set<string>();
    let totalBlock = 0;
    let totalExtraCredit = 0;
    let tripCreditMinutesLine = 0; // trips that touch a reserve day (not "extra")
    let tripCreditMinutesExtra = 0; // trips that do NOT touch a reserve day ("pickup")
    let tripCreditMinutes = 0;
    const tripStubs: Array<{
      segments: DaySegment[];
      payMinutes: number;
      blockMinutes: number;
      extraMinutes: number;
      credit_delta_minutes: number;
      isReserveAssignment: boolean;
    }> = [];
    let vacationCreditMinutes = 0;
    let tripEvents = 0;
    let reserveEvents = 0;
    let vacationEvents = 0;

    for (const ev of rows) {
      if (ev.event_type === "trip" && ev.is_muted === true) continue;

      const normalizedTitle = (ev.title ?? "").trim().toUpperCase();
      if (normalizedTitle === "PAY") continue;

      if (ev.event_type === "trip") {
        const tripKey = `${ev.title ?? ""}|${ev.start_time}|${ev.end_time}`;
        if (seenTripKeys.has(tripKey)) continue;
        seenTripKeys.add(tripKey);
      }

      const period = getBidPeriodForTimestamp(ev.start_time, baseTimezone);
      if (process.env.NODE_ENV === "development") {
        console.log("[bid-period-check]", {
          title: ev.title ?? null,
          start_time: ev.start_time ?? null,
          timezone: baseTimezone,
          resolvedLocalDateTime: formatInTimeZone(new Date(ev.start_time), baseTimezone, "yyyy-MM-dd HH:mm"),
          bidPeriod: period?.name ?? null,
          bidMonthIndex: period?.bidMonthIndex ?? null,
        });
      }
      const segments = expandEventToDaySegmentsInRange(
        ev.start_time,
        ev.end_time,
        bidPeriod.startStr,
        bidPeriod.endStr,
        baseTimezone
      );
      for (const seg of segments) {
        if (ev.event_type === "trip") {
          tripDays.add(seg.dateStr);
        } else if (ev.event_type === "reserve") {
          reserveDays.add(seg.dateStr);
          if (/\bRSL\b/i.test(ev.title ?? "")) rslDays.add(seg.dateStr);
        } else if (ev.event_type === "training") {
          trainingDays.add(seg.dateStr);
        }
      }
      if (ev.event_type === "vacation") {
        vacationEvents += 1;

        const vacMatch = (ev.title ?? "").match(/\bV(\d+)\b/i);
        if (!vacMatch) continue;

        const code = `V${vacMatch[1]}`; // e.g. V35
        const tenths = parseInt(vacMatch[1], 10); // e.g. 35
        const fallbackHours = tenths / 10; // old behavior (V35 -> 3.5)

        const hoursPerDay = await getHoursPerDayFromRules(code, fallbackHours);
        const minutesPerDay = Math.round(hoursPerDay * 60);

        vacationCreditMinutes += segments.length * minutesPerDay;
      } else if (ev.event_type === "reserve") {
        reserveEvents += 1;
      } else if (ev.event_type === "trip") {
        tripEvents += 1;

        // Flown block: independent of credit/pay stubs (reserve-assignment trips still count real block_minutes)
        if (segments.length > 0) {
          const bm = ev.block_minutes;
          if (bm != null && Number.isFinite(bm) && bm > 0) {
            const pairingDaysForBlock = ev.pairing_days ?? 1;
            const blockRatio =
              pairingDaysForBlock > 0 ? Math.min(1, segments.length / pairingDaysForBlock) : 1;
            totalBlock += Math.round(bm * blockRatio) / 60;
          }
        }

        const evCreditMinutes = ev.credit_minutes != null ? ev.credit_minutes : (ev.credit_hours != null ? Math.round(ev.credit_hours * 60) : null);
        const effectiveCreditMinutes = ev.baseline_credit_minutes != null && evCreditMinutes != null
          ? Math.max(evCreditMinutes, ev.baseline_credit_minutes)
          : evCreditMinutes;
        const evCreditHrs = effectiveCreditMinutes != null ? effectiveCreditMinutes / 60 : ev.credit_hours ?? null;
        let blockHrs = 0;
        let creditHrs = 0;
        let extraHrs = 0;
        if (ev.block_minutes != null && evCreditHrs != null && evCreditHrs > 0) {
          blockHrs = ev.block_minutes / 60;
          creditHrs = evCreditHrs;
          extraHrs = Math.max(0, evCreditHrs - ev.block_minutes / 60);
        } else if (ev.is_reserve_assignment === true && evCreditHrs != null && evCreditHrs > 0) {
          creditHrs = evCreditHrs;
          blockHrs = 0;
          extraHrs = 0;
        } else if (ev.pairing_days != null || ev.block_minutes != null) {
          const { blockMinutes, creditMinutes, extraCreditMinutes } = computeTripCredit(
            ev.pairing_days,
            ev.block_minutes
          );
          blockHrs = blockMinutes / 60;
          creditHrs = creditMinutes / 60;
          extraHrs = extraCreditMinutes / 60;
        } else if (evCreditHrs != null && evCreditHrs > 0) {
          creditHrs = evCreditHrs;
        }

        if (creditHrs > 0 && segments.length > 0) {
          const pairingDays = ev.pairing_days ?? 1;
          const ratio = pairingDays > 0 ? Math.min(1, segments.length / pairingDays) : 1;
          const payMinutes = Math.round(creditHrs * ratio * 60);
          const blockMinutes = Math.round(blockHrs * ratio * 60);
          const extraMinutes = Math.round(extraHrs * ratio * 60);
          const creditMinutes = Math.round(creditHrs * 60);
          const baselineMinutes = ev.baseline_credit_minutes ?? creditMinutes;
          const credit_delta_minutes = creditMinutes - baselineMinutes;
          tripStubs.push({
            segments,
            payMinutes,
            blockMinutes,
            extraMinutes,
            credit_delta_minutes,
            isReserveAssignment: ev.is_reserve_assignment === true,
          });
        }
      }
    }

    // Classify trips: line (touches reserve) vs extra (pickup)
    for (const t of tripStubs) {
      const touchesReserve =
        t.isReserveAssignment === true || t.segments.some((s) => reserveDays.has(s.dateStr));
      if (touchesReserve) tripCreditMinutesLine += t.payMinutes;
      else tripCreditMinutesExtra += t.payMinutes;
      totalExtraCredit += t.extraMinutes / 60;
    }
    tripCreditMinutes = tripCreditMinutesLine + tripCreditMinutesExtra;

    const totalCreditDeltaMinutes = tripStubs.reduce((sum, t) => sum + t.credit_delta_minutes, 0);

    console.log("[TripBuckets]", {
      line: tripCreditMinutesLine / 60,
      extra: tripCreditMinutesExtra / 60,
      reserveDays: reserveDays.size,
      tripDays: tripDays.size,
    });

    // Add reserve credit (exclude days that are also trip days—short call that converted to pairing)
    const reserveOnlyDays = [...reserveDays].filter((d) => !tripDays.has(d));
    const reserveCreditMinutes = Math.round(reserveOnlyDays.length * reserveCreditPerDay * 60);

    const reserveStreak = maxConsecutiveDateStrDays(reserveDays);
    const hasReserveGuarantee = reserveStreak >= 3; // Frontier bid-period rule

    const rslStreak = maxConsecutiveDateStrDays(rslDays);
    const isFDO = rslStreak >= 7;

    const PREMIUM_THRESHOLD_MIN = 4920; // 82h
    const guaranteeMinutes = hasReserveGuarantee ? 4500 : 0; // 75:00

    // "Line" credit is what can be protected/absorbed by the 75 guarantee
    const lineCreditMinutes = tripCreditMinutesLine + vacationCreditMinutes + reserveCreditMinutes;

    // Guarantee applies to the line bucket only
    const creditAfterGuaranteeMinutes = Math.max(lineCreditMinutes, guaranteeMinutes);

    // Extras ALWAYS add, regardless of guarantee
    const finalCreditedMinutes = creditAfterGuaranteeMinutes + tripCreditMinutesExtra;

    const rawCreditMinutes = tripCreditMinutes + vacationCreditMinutes + reserveCreditMinutes;

    const displayCreditMinutes =
      guaranteeMinutes > 0 ? Math.max(rawCreditMinutes, 4500) : rawCreditMinutes;

    const paidMinutes =
      finalCreditedMinutes <= PREMIUM_THRESHOLD_MIN
        ? finalCreditedMinutes
        : PREMIUM_THRESHOLD_MIN + Math.round((finalCreditedMinutes - PREMIUM_THRESHOLD_MIN) * 1.25);

    const allMonthDays = new Set<string>();
    let cur = bidPeriod.startStr;
    while (cur <= bidPeriod.endStr) {
      allMonthDays.add(cur);
      cur = addDay(cur);
    }

    const reserve = reserveOnlyDays.length;
    const vacationOff = [...allMonthDays].filter(
      (d) => !reserveDays.has(d) && !tripDays.has(d) && !trainingDays.has(d)
    ).length;

    const stats: MonthStats = {
      trip: seenTripKeys.size,
      reserve,
      vacationOff,
      totalBlock,
      totalExtraCredit,
      tripCreditMinutes,
      reserveCreditMinutes,
      vacationCreditMinutes,
      rawCreditMinutes,
      displayCreditMinutes,
      guaranteeMinutes,
      creditAfterGuaranteeMinutes,
      finalCreditedMinutes,
      paidMinutes,
      creditMinutes: paidMinutes,
      creditDeltaMinutes: totalCreditDeltaMinutes,
      rslDaysCount: rslDays.size,
      isFDO,
      rslStreak,
    };

    const isPro = isProActive(profile);

    if (process.env.NODE_ENV !== "production") {
      stats._debug = {
        isPro,
        subscription_tier: profile.subscription_tier ?? null,
        pro_trial_expires_at: profile.pro_trial_expires_at ?? null,
        show_pay_projection: profile.show_pay_projection ?? null,
      };
    }

    if (isPro) {
      stats.payEligible = true;

      // Always compute pay for Pro users
      const scale = await getPayScale(profile.tenant, profile.portal);

      const seat =
        profile.position === "captain"
          ? "CA"
          : profile.position === "first_officer"
            ? "FO"
            : null;

      const doh = profile.date_of_hire;

      const payMissingInputs: string[] = [];
      if (!scale) payMissingInputs.push("pay scale");
      if (!seat) payMissingInputs.push("position (Captain/First Officer)");
      if (!doh) payMissingInputs.push("Date of Hire (DOH)");
      stats.payMissingInputs = payMissingInputs;

      // DEBUG: log scale, seat, doh before payProjection
      console.log("[getMonthStats] pay inputs:", {
        scale: scale ?? null,
        seat: seat ?? null,
        doh: doh ?? null,
      });

      if (scale && seat && doh) {
        const year = payYearFromDOH(doh, new Date(bidPeriod.endStr + "T23:59:59.999Z"));
        const cappedYear = Math.min(12, year);
        const rate = scale.seats[seat]?.[String(cappedYear)] ?? 0;

        console.log("[getMonthStats] pay calc:", {
          year,
          rate,
          displayCreditMinutes: stats.displayCreditMinutes,
          creditHours: stats.displayCreditMinutes / 60,
        });

        // Pay estimate uses display credit (includes temporary 75:00 reserve-line floor when guarantee applies)
        const creditHours = stats.displayCreditMinutes / 60;
        const estimatedMonthlyPay = creditHours * rate;
        const pay20thHours = Math.min(35, creditHours);
        const pay5thHours = Math.max(0, creditHours - 35);

        stats.payProjection = {
          pay20thHours,
          pay5thHours,
          pay20thGross: pay20thHours * rate,
          pay5thGross: pay5thHours * rate,
          totalGross: estimatedMonthlyPay,
          rate,
          year,
        };
      }

      // Visibility controlled only by toggle
      stats.payHidden = !profile.show_pay_projection;
    }

    return stats;
  } catch (e) {
    return {
      ...emptyStats,
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

/** Returns at most 2 bid periods: current first, then next (if has events) else previous (if has events). */
export async function getAvailableMonths(): Promise<MonthOption[]> {
  const profile = await getProfile();
  if (!profile) return [];

  try {
    const baseTimezone = getFrontierBidPeriodTimezone({
      baseTimezone: profile.base_timezone ?? (profile.base_airport ? getTimezoneFromAirport(profile.base_airport) : null),
      profileBaseTimezone: profile.base_timezone,
    });
    const now = new Date();
    const currentYear = now.getFullYear();

    const periods = getAllBidPeriodsForYear(currentYear);
    if (periods.length === 0) return [];

    const periodKey = (idx: number) => `${currentYear}-${idx}`;

    const toOption = (p: { index: number; name: string; startStr: string; endStr: string }): MonthOption => {
      const fmt = (s: string) =>
        new Date(s + "T12:00:00.000Z").toLocaleString("en-US", { month: "long", day: "numeric" });
      return {
        year: currentYear,
        month: p.index,
        label: `${p.name} ${currentYear} (${fmt(p.startStr)} – ${fmt(p.endStr)})`,
        shortLabel: p.name,
      };
    };

    const currentBid = getBidPeriodForTimestamp(now.toISOString(), baseTimezone, currentYear);
    const currentIdx = currentBid?.bidMonthIndex ?? 0;

    const rangeStart = periods[0].startStr + "T00:00:00.000Z";
    const rangeEnd = periods[periods.length - 1].endStr + "T23:59:59.999Z";

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("schedule_events")
      .select("start_time")
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE)
      .gte("start_time", rangeStart)
      .lte("start_time", rangeEnd);

    if (error) return [];

    const periodSet = new Set<string>();
    for (const row of data ?? []) {
      const startTime = (row as { start_time: string }).start_time;
      const period = getBidPeriodForTimestamp(startTime, baseTimezone, currentYear);
      if (period) periodSet.add(periodKey(period.bidMonthIndex));
    }

    const currentOption = toOption(periods[currentIdx]);
    const nextIdx = currentIdx + 1;
    const prevIdx = currentIdx - 1;

    if (nextIdx < periods.length && periodSet.has(periodKey(nextIdx))) {
      return [currentOption, toOption(periods[nextIdx])];
    }
    if (prevIdx >= 0 && periodSet.has(periodKey(prevIdx))) {
      return [toOption(periods[prevIdx]), currentOption];
    }
    return [currentOption];
  } catch {
    return [];
  }
}
