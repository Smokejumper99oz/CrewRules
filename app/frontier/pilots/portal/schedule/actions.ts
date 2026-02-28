"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/profile";
import { getTenantSourceTimezone, getReserveCreditPerDay } from "@/lib/tenant-config";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";

const FLICA_SOURCE = "flica_import";

/**
 * Infer event_type from ICS summary/title (FLICA-style labels).
 * Reserve codes: RSA, RSB, RSC, RSD, RDE, RSE, RSL, RES, Reserve → reserve.
 * VAC/Vacation → vacation. Else → trip.
 */
function inferEventType(summary: string): "trip" | "reserve" | "vacation" {
  const s = summary ?? "";
  if (/\b(RES|RSA|RSB|RSC|RSD|RDE|RSE|RSL)\b|Reserve/i.test(s)) return "reserve";
  if (/\bVAC\b|Vacation/i.test(s)) return "vacation";
  return "trip";
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

  let parsed: { start: Date; end: Date; title: string; uid: string | null; reportTime?: string; creditHours?: number }[];
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
      creditHours: ev.creditHours ?? null,
    }));

  if (events.length === 0) {
    return { error: "No calendar events found in the file" };
  }

  const supabase = await createClient();
  const importBatchId = crypto.randomUUID();
  const importedAt = new Date().toISOString();
  const tenant = profile.tenant ?? "frontier";
  const portal = profile.portal ?? "pilots";

  const toRow = (e: (typeof events)[0] & { externalUid: string; creditHours?: number | null }) => ({
    tenant,
    portal,
    user_id: profile.id,
    start_time: e.start.toISOString(),
    end_time: e.end.toISOString(),
    title: e.title,
    event_type: inferEventType(e.title),
    report_time: e.reportTime,
    credit_hours: e.creditHours ?? null,
    source: FLICA_SOURCE,
    external_uid: e.externalUid,
    import_batch_id: importBatchId,
    imported_at: importedAt,
  });

  const reserveCreditPerDay = getReserveCreditPerDay(profile.tenant ?? "frontier");

  const rows = events.map((e) => {
    const uid = e.externalUid?.trim();
    const externalUid =
      uid ||
      `anon-${createHash("sha256").update(`${e.start.toISOString()}|${e.end.toISOString()}|${e.title}`).digest("hex").slice(0, 24)}`;
    const eventType = inferEventType(e.title);
    const creditHours =
      e.creditHours ?? (eventType === "reserve" ? reserveCreditPerDay : null);
    return toRow({ ...e, externalUid, creditHours });
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
};

export async function getNextDuty(): Promise<{
  event: ScheduleEvent | null;
  hasSchedule: boolean;
  error?: string;
}> {
  const profile = await getProfile();
  if (!profile) return { event: null, hasSchedule: false };

  try {
    const supabase = await createClient();
    const nowIso = new Date().toISOString();

    const { data: nextData, error: nextError } = await supabase
      .from("schedule_events")
      .select("id, start_time, end_time, title, event_type, report_time, credit_hours")
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE)
      .gte("start_time", nowIso)
      .order("start_time", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextError) return { event: null, hasSchedule: false, error: nextError.message };

    const { count } = await supabase
      .from("schedule_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE);

    return {
      event: nextData as ScheduleEvent | null,
      hasSchedule: (count ?? 0) > 0,
    };
  } catch (e) {
    return { event: null, hasSchedule: false, error: e instanceof Error ? e.message : "Unknown error" };
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
      .select("id, start_time, end_time, title, event_type, report_time, credit_hours")
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE)
      .gte("start_time", fromIso)
      .lte("start_time", toIso)
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
      .select("id, start_time, end_time, title, event_type, report_time, credit_hours")
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
  error?: string;
};

export type MonthOption = { year: number; month: number; label: string; shortLabel: string };

export async function getMonthStats(year?: number, month?: number): Promise<MonthStats> {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth();
  const profile = await getProfile();
  if (!profile) return { trip: 0, reserve: 0, vacationOff: 0 };

  try {
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 0);
    const startStr = monthStart.toISOString().slice(0, 10) + "T00:00:00.000Z";
    const endStr = monthEnd.toISOString().slice(0, 10) + "T23:59:59.999Z";

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("schedule_events")
      .select("event_type")
      .eq("user_id", profile.id)
      .eq("source", FLICA_SOURCE)
      .gte("start_time", startStr)
      .lte("start_time", endStr);

    if (error) return { trip: 0, reserve: 0, vacationOff: 0, error: error.message };

    let trip = 0, reserve = 0, vacationOff = 0;
    for (const row of data ?? []) {
      const t = (row as { event_type: string }).event_type;
      if (t === "trip") trip++;
      else if (t === "reserve") reserve++;
      else vacationOff++; // vacation, off, other
    }
    return { trip, reserve, vacationOff };
  } catch (e) {
    return { trip: 0, reserve: 0, vacationOff: 0, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

/** Returns months that have at least one schedule event, derived from event start dates. */
export async function getAvailableMonths(): Promise<MonthOption[]> {
  const profile = await getProfile();
  if (!profile) return [];

  try {
    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 13, 0);
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

    const available: MonthOption[] = [];
    const sorted = [...monthSet].sort();
    for (const key of sorted) {
      const [y, m] = key.split("-").map(Number);
      const d = new Date(y, m, 1);
      available.push({
        year: y,
        month: m,
        label: d.toLocaleString(undefined, { month: "long", year: "numeric" }),
        shortLabel: d.toLocaleString(undefined, { month: "short" }),
      });
    }
    return available;
  } catch {
    return [];
  }
}
