"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin, isProActive } from "@/lib/profile";
import { getTenantSourceTimezone, getReserveCreditPerDay } from "@/lib/tenant-config";
import {
  computeTripCredit,
  expandEventToDaySegments,
  type DaySegment,
} from "@/lib/schedule-time";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";
import { getPayScale } from "@/lib/tenant-settings";
import { payYearFromDOH } from "@/lib/pay-utils";
import { detectTripChanges, type TripChangeSummary } from "@/lib/trips/detect-trip-changes";
import { getOrCreateInboundAlias } from "@/lib/email/get-or-create-inbound-alias";
import { getInboundAddress } from "@/lib/email/get-inbound-address";

const FLICA_SOURCE = "flica_import";

/** Reserve codes: RSA, RSB, RSC, RSD, RSE, RSL. */
const RESERVE_CODE = /\b(RSA|RSB|RSC|RSD|RSE|RSL)\b/i;

/** True if title indicates a trip assigned from reserve (e.g. "RSA Trip S3019"). */
function isReserveAssignmentByTitle(title: string): boolean {
  return RESERVE_CODE.test(title ?? "") && (/\bTrip\b/i.test(title ?? "") || /\bS\d{4}\b/i.test(title ?? ""));
}

/**
 * Infer event_type from ICS summary/title (FLICA-style labels).
 * Reserve assignment (RSA/RSB/etc + Trip): treat as trip, 4 hrs/day credit.
 * Reserve: RSA, RSB, RSC, RSD, RDE, RSE, RSL, RES (standalone).
 * Vacation: VAC, Vacation, V15, V20 (V + digits).
 * Off: OFF, Off, OFF DUTY, Off Duty, DAY OFF.
 * Else → trip.
 */
function inferEventType(summary: string): "trip" | "reserve" | "vacation" | "off" {
  const s = summary ?? "";
  if (/\bVAC\b|Vacation|\bV\d+\b/i.test(s)) return "vacation"; // V15, V20, etc.
  if (/\bOFF\b|\bOff\b|Off Duty|DAY OFF/i.test(s)) return "off";
  if (isReserveAssignmentByTitle(s)) return "trip";
  if (/\b(RES|RSA|RSB|RSC|RSD|RDE|RSE|RSL)\b|Reserve/i.test(s)) return "reserve";
  return "trip";
}

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

/** True if trip immediately follows a reserve event (short call → pairing). */
function tripFollowsReserve(
  tripStart: Date,
  allEvents: Array<{ start: Date; end: Date; title: string }>
): boolean {
  const tripStartMs = tripStart.getTime();
  const preceding = allEvents
    .filter((e) => e.end.getTime() < tripStartMs)
    .sort((a, b) => b.end.getTime() - a.end.getTime());
  const lastBefore = preceding[0];
  if (!lastBefore) return false;
  const type = inferEventType(lastBefore.title);
  if (type !== "reserve") return false;
  const gapMs = tripStartMs - lastBefore.end.getTime();
  return gapMs <= 48 * 60 * 60 * 1000;
}

export type ImportIcsResult =
  | { success: string; count: number; importedAt: string; tripChangeSummaries: TripChangeSummary[] }
  | { error: string; technicalError?: string };

/** Check if current user is admin (for showing technical error details). */
export async function getIsAdmin(): Promise<boolean> {
  return isAdmin("frontier", "pilots");
}

/** Get schedule import email (alias@import.crewrules.com) for Pro users. Returns null for legacy u_ aliases. */
export async function getScheduleImportEmail(): Promise<string | null> {
  const profile = await getProfile();
  if (!profile || !isProActive(profile)) return null;
  try {
    const alias = await getOrCreateInboundAlias(profile.id);
    if (alias.startsWith("u_")) return null;
    return getInboundAddress(alias);
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
    (profile.base_airport ? getTimezoneFromAirport(profile.base_airport) : getTenantSourceTimezone(profile.tenant));

  let parsed: { start: Date; end: Date; title: string; uid: string | null; reportTime?: string; creditMinutes?: number; firstLegRoute?: string; firstLegDepartureTime?: string; pairingDays?: number; blockMinutes?: number; legs?: Array<{ day?: string; flightNumber?: string; origin: string; destination: string; depTime?: string; arrTime?: string; blockMinutes?: number; raw?: string }> }[];
  try {
    const { parseIcs } = await import("@/lib/ics-parse");
    parsed = parseIcs(icsText, { sourceTimezone });
  } catch {
    return { error: "Invalid ICS file. Could not parse calendar." };
  }

  const now = new Date();
  const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const events = parsed
    .filter((ev) => ev.start < oneYearFromNow)
    .map((ev) => ({
      start: ev.start,
      end: ev.end,
      title: ev.title,
      externalUid: ev.uid,
      reportTime: ev.reportTime ?? null,
      creditMinutes: ev.creditMinutes ?? null,
      route: ev.firstLegRoute ?? null,
      firstLegDepartureTime: ev.firstLegDepartureTime ?? null,
      pairingDays: ev.pairingDays ?? null,
      blockMinutes: ev.blockMinutes ?? null,
      legs: ev.legs ?? null,
    }));

  if (process.env.NODE_ENV === "development") {
    for (const ev of events) {
      console.log("[ICS parsed event]", {
        title: ev.title,
        start: ev.start,
        firstLegRoute: ev.route,
        legsCount: ev.legs?.length ?? 0,
        legs: ev.legs,
      });
    }
  }

  if (events.length === 0) {
    return { error: "No calendar events found in the file" };
  }

  const supabase = await createClient();
  const importBatchId = crypto.randomUUID();
  const importedAt = new Date().toISOString();
  const tenant = profile.tenant ?? "frontier";
  const portal = profile.portal ?? "pilots";

  const reserveCreditPerDay = getReserveCreditPerDay(profile.tenant ?? "frontier");
  const RESERVE_CREDIT_PER_DAY_MINUTES = Math.round(reserveCreditPerDay * 60);

  const sortedByStart = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());

  const toRow = (e: (typeof events)[0] & { externalUid: string }) => {
    const eventType = inferEventType(e.title);
    let creditMinutes: number | null = null;
    let blockMinutes: number | null = e.blockMinutes ?? null;
    let pairingDays: number | null = e.pairingDays ?? null;
    let isReserveAssignment = false;

    if (eventType === "trip") {
      const followsReserve = tripFollowsReserve(e.start, sortedByStart);
      const titleIndicatesReserveAssign = isReserveAssignmentByTitle(e.title);
      isReserveAssignment = titleIndicatesReserveAssign || followsReserve;

      if (isReserveAssignment) {
        const days = e.pairingDays ?? 1;
        creditMinutes = RESERVE_CREDIT_PER_DAY_MINUTES * days;
        blockMinutes = null;
      } else if (e.creditMinutes != null && e.creditMinutes > 0) {
        creditMinutes = e.creditMinutes;
        blockMinutes = e.blockMinutes ?? blockMinutes ?? creditMinutes;
      } else if (e.pairingDays != null || e.blockMinutes != null) {
        const { creditMinutes: computed } = computeTripCredit(e.pairingDays, e.blockMinutes);
        creditMinutes = computed;
      }
    } else if (eventType === "reserve") {
      creditMinutes = RESERVE_CREDIT_PER_DAY_MINUTES;
    }

    return {
      tenant,
      portal,
      user_id: profile.id,
      start_time: e.start.toISOString(),
      end_time: e.end.toISOString(),
      title: e.title,
      event_type: eventType,
      report_time: e.reportTime,
      credit_hours: creditMinutes != null ? creditMinutes / 60 : null,
      credit_minutes: creditMinutes,
      route: e.route ?? null,
      pairing_days: pairingDays,
      block_minutes: blockMinutes,
      is_reserve_assignment: isReserveAssignment,
      first_leg_departure_time: e.firstLegDepartureTime ?? null,
      legs: e.legs ?? null,
      source: FLICA_SOURCE,
      external_uid: e.externalUid,
      import_batch_id: importBatchId,
      imported_at: importedAt,
    };
  };

  const rows = events.map((e) => {
    const baseUid =
      e.externalUid?.trim() ||
      `anon-${createHash("sha256").update(`${e.start.toISOString()}|${e.end.toISOString()}|${e.title}`).digest("hex").slice(0, 24)}`;
    const externalUid = `${baseUid}-${e.start.toISOString()}`;
    return toRow({ ...e, externalUid });
  });

  if (process.env.NODE_ENV === "development") {
    for (const row of rows) {
      console.log("[schedule row before save]", {
        title: row.title,
        start_time: row.start_time,
        external_uid: row.external_uid,
        route: row.route,
        legsCount: row.legs?.length ?? 0,
        legs: row.legs,
      });
    }
  }

  // Trip change detection: compare with existing before overwrite
  const tripChangeSummaries: TripChangeSummary[] = [];
  const tripRows = rows.filter((r) => r.event_type === "trip" && r.external_uid);
  if (tripRows.length > 0) {
    const uids = tripRows.map((r) => r.external_uid!);
    const { data: existing } = await supabase
      .from("schedule_events")
      .select("external_uid, start_time, end_time, title, report_time, credit_minutes, legs")
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE)
      .in("external_uid", uids);
    const existingByUid = new Map((existing ?? []).map((e) => [(e as { external_uid: string }).external_uid, e]));
    for (const incoming of tripRows) {
      const prev = existingByUid.get(incoming.external_uid);
      if (prev) {
        const summary = detectTripChanges(prev as Parameters<typeof detectTripChanges>[0], incoming);
        console.log("[Trip change detect]", summary);
        if (summary.hasChanges) tripChangeSummaries.push(summary);
      }
    }
  }

  const { error: upsertError } = await supabase
    .from("schedule_events")
    .upsert(rows, {
      onConflict: "user_id,external_uid",
      ignoreDuplicates: false,
    });

  if (upsertError) {
    const technicalMsg = `Failed to import: ${upsertError.message}`;
    const isSchemaError =
      /could not find|schema cache|column.*does not exist|relation.*does not exist/i.test(
        upsertError.message
      );
    if (isSchemaError) {
      return {
        error: "Import failed. We're missing a required field on the server. Please try again in a minute.",
        technicalError: technicalMsg,
      };
    }
    return { error: technicalMsg };
  }

  revalidatePath(`/${tenant}/${portal}/portal`);
  revalidatePath(`/${tenant}/${portal}/portal/schedule`);

  // Persist trip change summaries for dashboard (Current Trip card)
  if (tripChangeSummaries.length > 0) {
    await supabase.from("trip_change_summaries").delete().eq("user_id", profile.id);
    await supabase.from("trip_change_summaries").insert(
      tripChangeSummaries.map((s) => ({
        user_id: profile.id,
        pairing: s.pairing,
        summary: s,
      }))
    );
  }

  console.log("[Trip change return]", { count: tripChangeSummaries.length, pairings: tripChangeSummaries.map((s) => s.pairing) });

  return {
    success: `Imported ${events.length} events`,
    count: events.length,
    importedAt,
    tripChangeSummaries,
  };
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
  route?: string | null;
  pairing_days?: number | null;
  block_minutes?: number | null;
  first_leg_departure_time?: string | null;
  /** Trip from short-call reserve (RSA/RSB/etc): credit = 4 hrs/day, no block. */
  is_reserve_assignment?: boolean | null;
  legs?: ScheduleEventLeg[] | null;
};

export type NextDutyLabel = "on_duty" | "later_today" | "next_duty";

export async function getNextDuty(): Promise<{
  event: ScheduleEvent | null;
  label: NextDutyLabel | null;
  hasSchedule: boolean;
  legsToShow?: ScheduleEventLeg[] | null;
  displayDateStr?: string | null;
  /** True when event overlaps now (start <= now < end); Commute Assist uses for to_home vs to_base. */
  isInPairing?: boolean;
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
      .lte("start_time", nowIso)
      .gt("end_time", nowIso)
      .order("start_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (onDutyError) return { event: null, label: null, hasSchedule, error: onDutyError.message };
    if (onDutyData) {
      const ev = onDutyData as ScheduleEvent;
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
              legsToShow: nextLegs.length > 0 ? nextLegs : null,
              displayDateStr: tomorrow,
              isInPairing: true,
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
          };
        }
      }
      return { event: ev, label: "on_duty", hasSchedule, isInPairing: true };
    }

    // 2. Upcoming events: start >= now
    const { data: upcomingData, error: upcomingError } = await supabase
      .from("schedule_events")
      .select("id, start_time, end_time, title, event_type, report_time, credit_hours, credit_minutes, route, pairing_days, block_minutes, first_leg_departure_time, legs")
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE)
      .gte("start_time", nowIso)
      .order("start_time", { ascending: true })
      .limit(50);

    if (upcomingError) return { event: null, label: null, hasSchedule, error: upcomingError.message };

    const upcoming = (upcomingData ?? []) as ScheduleEvent[];
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
    legsToShow: legsForDate.length > 0 ? legsForDate : null,
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
      .select("id, start_time, end_time, title, event_type, report_time, credit_hours, credit_minutes, route, pairing_days, block_minutes, first_leg_departure_time, legs")
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
};

export async function getScheduleDisplaySettings(): Promise<ScheduleDisplaySettings> {
  const profile = await getProfile();
  if (!profile) {
    return {
      baseTimezone: "America/Denver",
      baseAirport: null,
      displayTimezoneMode: "base",
      timeFormat: "24h",
      showTimezoneLabel: false,
    };
  }
  const mode = profile.display_timezone_mode ?? "base";
  const baseAirport = profile.base_airport ?? null;
  const baseTimezone =
    profile.base_timezone ?? (baseAirport ? getTimezoneFromAirport(baseAirport) : "America/Denver");
  return {
    baseTimezone,
    baseAirport,
    displayTimezoneMode: mode === "toggle" ? "both" : mode,
    timeFormat: profile.time_format ?? "24h",
    showTimezoneLabel: profile.show_timezone_label ?? false,
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
  guaranteeMinutes: number;
  creditAfterGuaranteeMinutes: number;
  paidMinutes: number;
  /** Credit minutes for display (always equals paidMinutes) */
  creditMinutes: number;
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

export async function getMonthStats(year?: number, month?: number): Promise<MonthStats> {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth();
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
    guaranteeMinutes: 0,
    creditAfterGuaranteeMinutes: 0,
    paidMinutes: 0,
    creditMinutes: 0,
  };
  if (!profile) return emptyStats;

  try {
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 0);
    const startStr = monthStart.toISOString().slice(0, 10) + "T00:00:00.000Z";
    const endStr = monthEnd.toISOString().slice(0, 10) + "T23:59:59.999Z";

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("schedule_events")
      .select("start_time, end_time, event_type, title, credit_hours, credit_minutes, pairing_days, block_minutes")
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE)
      .lte("start_time", endStr)
      .gte("end_time", startStr);

    if (error) return { ...emptyStats, error: error.message };

    const baseTimezone =
      profile.base_timezone ??
      (profile.base_airport ? getTimezoneFromAirport(profile.base_airport) : getTenantSourceTimezone(profile.tenant));
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
      pairing_days: number | null;
      block_minutes: number | null;
    }[];

    const reserveDays = new Set<string>();
    const rslDays = new Set<string>();
    const tripDays = new Set<string>();
    let tripOccurrences = 0;
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
    }> = [];
    let vacationCreditMinutes = 0;
    let tripEvents = 0;
    let reserveEvents = 0;
    let vacationEvents = 0;

    for (const ev of rows) {
      const segments = expandEventToDaySegments(ev.start_time, ev.end_time, y, m, baseTimezone);
      for (const seg of segments) {
        if (ev.event_type === "trip") {
          tripDays.add(seg.dateStr);
        } else if (ev.event_type === "reserve") {
          reserveDays.add(seg.dateStr);
          if (/\bRSL\b/i.test(ev.title ?? "")) rslDays.add(seg.dateStr);
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
        tripOccurrences += 1;

        const evCreditHrs = ev.credit_minutes != null ? ev.credit_minutes / 60 : ev.credit_hours ?? null;
        let blockHrs = 0;
        let creditHrs = 0;
        let extraHrs = 0;
        if (ev.block_minutes != null && evCreditHrs != null && evCreditHrs > 0) {
          blockHrs = ev.block_minutes / 60;
          creditHrs = evCreditHrs;
          extraHrs = Math.max(0, evCreditHrs - ev.block_minutes / 60);
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
          tripStubs.push({ segments, payMinutes, blockMinutes, extraMinutes });
        }
      }
    }

    // Classify trips: line (touches reserve) vs extra (pickup)
    for (const t of tripStubs) {
      const touchesReserve = t.segments.some((s) => reserveDays.has(s.dateStr));
      if (touchesReserve) tripCreditMinutesLine += t.payMinutes;
      else tripCreditMinutesExtra += t.payMinutes;
      totalBlock += t.blockMinutes / 60;
      totalExtraCredit += t.extraMinutes / 60;
    }
    tripCreditMinutes = tripCreditMinutesLine + tripCreditMinutesExtra;

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
    const hasReserveGuarantee = reserveStreak >= 3; // Frontier calendar-month rule (temporary)

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

    const paidMinutes =
      finalCreditedMinutes <= PREMIUM_THRESHOLD_MIN
        ? finalCreditedMinutes
        : PREMIUM_THRESHOLD_MIN + Math.round((finalCreditedMinutes - PREMIUM_THRESHOLD_MIN) * 1.25);

    const lastDate = monthEnd.getDate();
    const allMonthDays = new Set<string>();
    for (let d = 1; d <= lastDate; d++) {
      allMonthDays.add(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }

    const reserve = reserveOnlyDays.length;
    const vacationOff = [...allMonthDays].filter((d) => !reserveDays.has(d) && !tripDays.has(d)).length;

    const stats: MonthStats = {
      trip: tripOccurrences,
      reserve,
      vacationOff,
      totalBlock,
      totalExtraCredit,
      tripCreditMinutes,
      reserveCreditMinutes,
      vacationCreditMinutes,
      rawCreditMinutes,
      guaranteeMinutes,
      creditAfterGuaranteeMinutes,
      paidMinutes,
      creditMinutes: paidMinutes,
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
        const year = payYearFromDOH(doh, new Date(y, m + 1, 0));
        const cappedYear = Math.min(12, year);
        const rate = scale.seats[seat]?.[String(cappedYear)] ?? 0;

        console.log("[getMonthStats] pay calc:", {
          year,
          rate,
          paidMinutes,
          paidHours: paidMinutes / 60,
        });

        // Pay estimate derived from paidMinutes only (single source of truth)
        const paidHours = paidMinutes / 60;
        const estimatedMonthlyPay = paidHours * rate;
        const pay20thHours = Math.min(35, paidHours);
        const pay5thHours = Math.max(0, paidHours - 35);

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

/** Returns at most 2 months: current first, then next (if has events) else previous (if has events). */
export async function getAvailableMonths(): Promise<MonthOption[]> {
  const profile = await getProfile();
  if (!profile) return [];

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based
    const currentKey = `${currentYear}-${currentMonth}`;

    const rangeStart = new Date(currentYear, currentMonth - 1, 1);
    const rangeEnd = new Date(currentYear, currentMonth + 13, 0);
    const startStr = rangeStart.toISOString().slice(0, 10) + "T00:00:00.000Z";
    const endStr = rangeEnd.toISOString().slice(0, 10) + "T23:59:59.999Z";

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("schedule_events")
      .select("start_time")
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE)
      .gte("start_time", startStr)
      .lte("start_time", endStr);

    if (error) return [];

    const monthSet = new Set<string>();
    for (const row of data ?? []) {
      const d = new Date((row as { start_time: string }).start_time);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthSet.add(key);
    }

    const toOption = (y: number, m: number): MonthOption => {
      const d = new Date(y, m, 1);
      return {
        year: y,
        month: m,
        label: d.toLocaleString(undefined, { month: "long", year: "numeric" }),
        shortLabel: d.toLocaleString(undefined, { month: "short" }),
      };
    };

    const currentOption = toOption(currentYear, currentMonth);

    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextKey = `${nextYear}-${nextMonth}`;

    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevKey = `${prevYear}-${prevMonth}`;

    if (monthSet.has(nextKey)) {
      return [currentOption, toOption(nextYear, nextMonth)];
    }
    if (monthSet.has(prevKey)) {
      return [toOption(prevYear, prevMonth), currentOption];
    }
    return [currentOption];
  } catch {
    return [];
  }
}
