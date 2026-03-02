"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/profile";
import { getTenantSourceTimezone, getReserveCreditPerDay } from "@/lib/tenant-config";
import { computeTripCredit, extractPairingKey, expandEventToDaySegments, addDay } from "@/lib/schedule-time";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";

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
  | { success: string; count: number; importedAt: string }
  | { error: string; technicalError?: string };

/** Check if current user is admin (for showing technical error details). */
export async function getIsAdmin(): Promise<boolean> {
  return isAdmin("frontier", "pilots");
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

  let parsed: { start: Date; end: Date; title: string; uid: string | null; reportTime?: string; creditMinutes?: number; firstLegRoute?: string; firstLegDepartureTime?: string; pairingDays?: number; blockMinutes?: number }[];
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
    }));

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

  return {
    success: `Imported ${events.length} events`,
    count: events.length,
    importedAt,
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

    const tenant = profile.tenant ?? "frontier";
    const portal = profile.portal ?? "pilots";
    revalidatePath(`/${tenant}/${portal}/portal`);
    revalidatePath(`/${tenant}/${portal}/portal/schedule`);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export type ScheduleImportStatus = {
  count: number;
  lastImportedAt: string | null;
  status: "no_schedule" | "up_to_date" | "outdated";
  error?: string;
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
};

export type NextDutyLabel = "on_duty" | "later_today" | "next_duty";

export async function getNextDuty(): Promise<{
  event: ScheduleEvent | null;
  label: NextDutyLabel | null;
  hasSchedule: boolean;
  error?: string;
}> {
  const profile = await getProfile();
  if (!profile) return { event: null, label: null, hasSchedule: false };

  try {
    const supabase = await createClient();
    const nowIso = new Date().toISOString();

    const { count } = await supabase
      .from("schedule_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE);

    const hasSchedule = (count ?? 0) > 0;

    // 1. On duty: start <= now < end
    const { data: onDutyData, error: onDutyError } = await supabase
      .from("schedule_events")
      .select("id, start_time, end_time, title, event_type, report_time, credit_hours, credit_minutes, route, pairing_days, block_minutes, first_leg_departure_time")
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE)
      .lte("start_time", nowIso)
      .gt("end_time", nowIso)
      .order("start_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (onDutyError) return { event: null, label: null, hasSchedule, error: onDutyError.message };
    if (onDutyData) {
      return { event: onDutyData as ScheduleEvent, label: "on_duty", hasSchedule };
    }

    // 2. Upcoming events: start >= now
    const { data: upcomingData, error: upcomingError } = await supabase
      .from("schedule_events")
      .select("id, start_time, end_time, title, event_type, report_time, credit_hours, credit_minutes, route, pairing_days, block_minutes, first_leg_departure_time")
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

    // Need base timezone to determine "today"
    const baseAirport = profile.base_airport ?? null;
    const baseTimezone =
      profile.base_timezone ?? (baseAirport ? getTimezoneFromAirport(baseAirport) : getTenantSourceTimezone(profile.tenant));

    const { isEventStartToday } = await import("@/lib/schedule-time");

    // 2a. Later today: first event that starts today
    const laterToday = upcoming.find((e) => isEventStartToday(e.start_time, baseTimezone));
    if (laterToday) {
      return { event: laterToday, label: "later_today", hasSchedule };
    }

    // 2b. Next duty: first future event
    return { event: upcoming[0], label: "next_duty", hasSchedule };
  } catch (e) {
    return { event: null, label: null, hasSchedule: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
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
      .select("id, start_time, end_time, title, event_type, report_time, credit_hours, credit_minutes, route, pairing_days, block_minutes")
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
      .select("id, start_time, end_time, title, event_type, report_time, credit_hours, credit_minutes, route, pairing_days, block_minutes, first_leg_departure_time")
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
  /** Trip credit hours (pay). */
  totalCredit: number;
  /** Trip block hours (wheels up–down). */
  totalBlock: number;
  /** Extra credit over block (min 5 hrs/day). */
  totalExtraCredit: number;
  error?: string;
};

export type MonthOption = { year: number; month: number; label: string; shortLabel: string };

export async function getMonthStats(year?: number, month?: number): Promise<MonthStats> {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth();
  const profile = await getProfile();
  if (!profile) return { trip: 0, reserve: 0, vacationOff: 0, totalCredit: 0, totalBlock: 0, totalExtraCredit: 0 };

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

    if (error)
      return { trip: 0, reserve: 0, vacationOff: 0, totalCredit: 0, totalBlock: 0, totalExtraCredit: 0, error: error.message };

    const baseTimezone =
      profile.base_timezone ??
      (profile.base_airport ? getTimezoneFromAirport(profile.base_airport) : getTenantSourceTimezone(profile.tenant));
    const reserveCreditPerDay = getReserveCreditPerDay(profile.tenant ?? "frontier");

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
    const tripDays = new Set<string>();
    let tripOccurrences = 0;
    let totalCredit = 0;
    let totalBlock = 0;
    let totalExtraCredit = 0;

    // Group by pairing, then find runs (consecutive dates). Same pairing on non-consecutive days = different trips.
    // e.g. S3019 Feb 19-20 and S3019 Feb 21-22 are two separate trips, not duplicates.
    const byPairing = new Map<
      string,
      Array<{
        creditHrs: number;
        blockHrs: number;
        extraHrs: number;
        pairingDays: number;
        dateStrs: string[];
      }>
    >();

    for (const ev of rows) {
      const segments = expandEventToDaySegments(ev.start_time, ev.end_time, y, m, baseTimezone);
      for (const seg of segments) {
        if (ev.event_type === "trip") {
          tripDays.add(seg.dateStr);
        } else if (ev.event_type === "reserve") {
          reserveDays.add(seg.dateStr);
        }
      }
      if (ev.event_type === "trip") {
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
          const key = extractPairingKey(ev.title);
          const dateStrs = segments.map((s) => s.dateStr);
          const entry = {
            creditHrs,
            blockHrs,
            extraHrs,
            pairingDays: ev.pairing_days ?? 1,
            dateStrs,
          };
          if (!byPairing.has(key)) byPairing.set(key, []);
          byPairing.get(key)!.push(entry);
        }
      }
    }

    // Find runs: consecutive dates that share an event. Same pairing on non-consecutive/ungapped
    // spans = different trips (e.g. S3019 Feb 19-20 vs Feb 21-22).
    for (const [, entries] of byPairing) {
      const allDateStrs = [...new Set(entries.flatMap((e) => e.dateStrs))].sort();
      const runs: string[][] = [];
      let run: string[] = [allDateStrs[0]];
      for (let i = 1; i < allDateStrs.length; i++) {
        const prev = allDateStrs[i - 1];
        const curr = allDateStrs[i];
        const isConsecutive = addDay(prev) === curr;
        const hasEventSpanningBoth = isConsecutive && entries.some(
          (e) => e.dateStrs.includes(prev) && e.dateStrs.includes(curr)
        );
        if (hasEventSpanningBoth) {
          run.push(curr);
        } else {
          runs.push(run);
          run = [curr];
        }
      }
      runs.push(run);
      for (const runDateStrs of runs) {
        const ev = entries.find((e) => e.dateStrs.some((d) => runDateStrs.includes(d)))!;
        const daysInMonth = runDateStrs.length;
        const ratio = ev.pairingDays > 0 ? Math.min(1, daysInMonth / ev.pairingDays) : 1;
        totalCredit += ev.creditHrs * ratio;
        totalBlock += ev.blockHrs * ratio;
        totalExtraCredit += ev.extraHrs * ratio;
      }
    }

    // Add reserve credit (exclude days that are also trip days—short call that converted to pairing)
    const reserveOnlyDays = [...reserveDays].filter((d) => !tripDays.has(d));
    totalCredit += reserveOnlyDays.length * reserveCreditPerDay;

    const lastDate = monthEnd.getDate();
    const allMonthDays = new Set<string>();
    for (let d = 1; d <= lastDate; d++) {
      allMonthDays.add(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }

    const reserve = reserveOnlyDays.length;
    const vacationOff = [...allMonthDays].filter((d) => !reserveDays.has(d) && !tripDays.has(d)).length;

    return { trip: tripOccurrences, reserve, vacationOff, totalCredit, totalBlock, totalExtraCredit };
  } catch (e) {
    return {
      trip: 0,
      reserve: 0,
      vacationOff: 0,
      totalCredit: 0,
      totalBlock: 0,
      totalExtraCredit: 0,
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
