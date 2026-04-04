/**
 * Shared schedule import: parse ICS text → map to rows → upsert schedule_events.
 * Used by manual ICS upload and inbound email auto-import.
 */

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";
import { parseIcs } from "@/lib/ics-parse";
import { computeTripCredit, expandEventToDaySegmentsInRange } from "@/lib/schedule-time";
import { getReserveCreditPerDay } from "@/lib/tenant-config";
import { detectTripChanges, type TripChangeSummary } from "@/lib/trips/detect-trip-changes";
import { getFrontierBidPeriodTimezone } from "@/lib/frontier-bid-periods";
import {
  inferScheduleEventTypeHeuristic,
  isReserveAssignmentByTitle,
  loadScheduleImportProtectedCodes,
  normalizeScheduleImportTitle,
  resolveScheduleEventType,
  type ScheduleImportEventType,
} from "@/lib/schedule/schedule-import-protected";

const FLICA_SOURCE = "flica_import";

/** True if trip immediately follows a reserve event (short call → pairing). */
function tripFollowsReserve(
  tripStart: Date,
  allEvents: Array<{ start: Date; end: Date; title: string }>,
  resolveEventType: (title: string) => ScheduleImportEventType
): boolean {
  const tripStartMs = tripStart.getTime();
  const preceding = allEvents
    .filter((e) => e.end.getTime() < tripStartMs)
    .sort((a, b) => b.end.getTime() - a.end.getTime());
  const lastBefore = preceding[0];
  if (!lastBefore) return false;
  if (resolveEventType(lastBefore.title) !== "reserve") return false;
  const gapMs = tripStartMs - lastBefore.end.getTime();
  return gapMs <= 48 * 60 * 60 * 1000;
}

export type ImportIcsFromTextResult =
  | { success: string; count: number; importedAt: string; tripChangeSummaries: TripChangeSummary[] }
  | { error: string; technicalError?: string };

export type ImportIcsFromTextParams = {
  supabase: SupabaseClient;
  userId: string;
  icsText: string;
  sourceTimezone?: string | null;
  importBatchId?: string | null;
  tenant?: string;
  portal?: string;
};

const DELETE_ID_CHUNK = 200;

/**
 * Parse ICS text, map to schedule_events rows, replace prior baseline in covered range, upsert.
 * Shared by manual upload and inbound email auto-import.
 */
export async function importIcsFromText(
  params: ImportIcsFromTextParams
): Promise<ImportIcsFromTextResult> {
  const {
    supabase,
    userId,
    icsText,
    sourceTimezone: sourceTimezoneParam,
    importBatchId: importBatchIdParam,
    tenant: tenantParam = "frontier",
    portal: portalParam = "pilots",
  } = params;

  const tenant = tenantParam;
  const portal = portalParam;
  const sourceTimezone = getFrontierBidPeriodTimezone({ sourceTimezone: sourceTimezoneParam });
  const importBatchId = importBatchIdParam ?? crypto.randomUUID();
  const importedAt = new Date().toISOString();
  const reserveCreditPerDay = getReserveCreditPerDay(tenant);
  const RESERVE_CREDIT_PER_DAY_MINUTES = Math.round(reserveCreditPerDay * 60);

  let parsed: Awaited<ReturnType<typeof parseIcs>>;
  try {
    parsed = parseIcs(icsText, { sourceTimezone });
  } catch {
    return { error: "Could not read this schedule file. Check that it is a valid FLICA vCalendar (.VCS) export." };
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
      isTraining: ev.isTraining === true,
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

  const protectedCodes = await loadScheduleImportProtectedCodes(supabase, tenant);
  const resolveEventType = (title: string) =>
    resolveScheduleEventType(title, protectedCodes.classification, inferScheduleEventTypeHeuristic);

  const uidCounts = new Map<string, number>();
  for (const ev of events) {
    const u = ev.externalUid?.trim() ?? "";
    if (u.length > 0) uidCounts.set(u, (uidCounts.get(u) ?? 0) + 1);
  }

  const sortedByStart = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());

  const toRow = (e: (typeof events)[0] & { externalUid: string }) => {
    const eventType =
      e.isTraining === true ? ("training" as const) : resolveEventType(e.title);
    let creditMinutes: number | null = null;
    let blockMinutes: number | null = null;
    let pairingDays: number | null = null;
    let isReserveAssignment = false;

    if (eventType === "training") {
      creditMinutes = null;
      blockMinutes = null;
      pairingDays = null;
      isReserveAssignment = false;
    } else if (eventType === "trip") {
      blockMinutes = e.blockMinutes ?? null;
      pairingDays = e.pairingDays ?? null;
      const followsReserve = tripFollowsReserve(e.start, sortedByStart, resolveEventType);
      const titleIndicatesReserveAssign = isReserveAssignmentByTitle(e.title);
      isReserveAssignment = titleIndicatesReserveAssign || followsReserve;

      if (isReserveAssignment) {
        const days = e.pairingDays ?? 1;
        creditMinutes = RESERVE_CREDIT_PER_DAY_MINUTES * days;
        blockMinutes =
          e.blockMinutes != null && Number.isFinite(e.blockMinutes) && e.blockMinutes > 0
            ? e.blockMinutes
            : null;
      } else if (e.creditMinutes != null && e.creditMinutes > 0) {
        creditMinutes = e.creditMinutes;
        blockMinutes = e.blockMinutes ?? blockMinutes ?? creditMinutes;
      } else if (e.pairingDays != null || e.blockMinutes != null) {
        const { creditMinutes: computed } = computeTripCredit(e.pairingDays, e.blockMinutes);
        creditMinutes = computed;
      }
    } else if (eventType === "reserve") {
      blockMinutes = e.blockMinutes ?? null;
      pairingDays = e.pairingDays ?? null;
      creditMinutes = RESERVE_CREDIT_PER_DAY_MINUTES;
    } else {
      blockMinutes = e.blockMinutes ?? null;
      pairingDays = e.pairingDays ?? null;
    }

    return {
      tenant,
      portal,
      user_id: userId,
      start_time: e.start.toISOString(),
      end_time: e.end.toISOString(),
      title: e.title,
      event_type: eventType,
      report_time: e.reportTime,
      credit_hours: creditMinutes != null ? creditMinutes / 60 : null,
      credit_minutes: creditMinutes,
      baseline_credit_minutes: creditMinutes,
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
      is_muted: false,
    };
  };

  let rows = events.map((e) => {
    const trimmedUid = e.externalUid?.trim() ?? "";
    const hashPart = createHash("sha256")
      .update(`${e.start.toISOString()}|${e.end.toISOString()}|${e.title}`)
      .digest("hex")
      .slice(0, 24);
    let externalUid: string;
    if (trimmedUid.length === 0) {
      externalUid = `anon-${hashPart}`;
    } else if ((uidCounts.get(trimmedUid) ?? 0) > 1) {
      externalUid = `cr-ics-dup-${hashPart}`;
    } else {
      externalUid = trimmedUid;
    }
    return toRow({ ...e, externalUid });
  });

  const seenInBatch = new Set<string>();
  rows = rows.filter((r) => {
    const key = `${r.title ?? ""}|${r.start_time}|${r.end_time}|${r.source}`;
    if (seenInBatch.has(key)) return false;
    seenInBatch.add(key);
    return true;
  });

  if (rows.length === 0) {
    return {
      success: `Imported 0 events (all duplicates)`,
      count: 0,
      importedAt,
      tripChangeSummaries: [],
    };
  }

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

  const tripChangeSummaries: TripChangeSummary[] = [];
  const tripRows = rows.filter((r) => r.event_type === "trip" && r.external_uid);
  if (tripRows.length > 0) {
    const uids = tripRows.map((r) => r.external_uid!);
    const { data: existing } = await supabase
      .from("schedule_events")
      .select("external_uid, start_time, end_time, title, report_time, credit_minutes, legs")
      .eq("user_id", userId)
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

  let rangeMin = rows[0]!.start_time;
  let rangeMax = rows[0]!.start_time;
  for (const r of rows) {
    if (r.start_time < rangeMin) rangeMin = r.start_time;
    if (r.start_time > rangeMax) rangeMax = r.start_time;
  }

  const { data: candidates, error: selectDelError } = await supabase
    .from("schedule_events")
    .select("id, title, event_type, start_time, end_time")
    .eq("user_id", userId)
    .eq("source", FLICA_SOURCE)
    .gte("start_time", rangeMin)
    .lte("start_time", rangeMax);

  if (selectDelError) {
    return {
      error: `Failed to import: ${selectDelError.message}`,
      technicalError: selectDelError.message,
    };
  }

  const preserve = protectedCodes.preservationNormalizedTitles;
  const nonProtected = (candidates ?? []).filter(
    (c) => !preserve.has(normalizeScheduleImportTitle(c.title))
  ) as Array<{
    id: string;
    title: string | null;
    event_type: string | null;
    start_time: string;
    end_time: string;
  }>;

  let envelopeIsoMin = rows[0]!.start_time;
  let envelopeIsoMax = rows[0]!.end_time;
  for (const r of rows) {
    if (r.start_time < envelopeIsoMin) envelopeIsoMin = r.start_time;
    if (r.end_time > envelopeIsoMax) envelopeIsoMax = r.end_time;
  }
  for (const c of nonProtected) {
    if (c.start_time < envelopeIsoMin) envelopeIsoMin = c.start_time;
    if (c.end_time > envelopeIsoMax) envelopeIsoMax = c.end_time;
  }
  let rangeStartStr = formatInTimeZone(new Date(envelopeIsoMin), sourceTimezone, "yyyy-MM-dd");
  let rangeEndStr = formatInTimeZone(new Date(envelopeIsoMax), sourceTimezone, "yyyy-MM-dd");
  if (rangeStartStr > rangeEndStr) {
    const t = rangeStartStr;
    rangeStartStr = rangeEndStr;
    rangeEndStr = t;
  }

  const tripLocalDays = new Set<string>();
  for (const r of rows) {
    if (r.event_type !== "trip") continue;
    const segs = expandEventToDaySegmentsInRange(
      r.start_time,
      r.end_time,
      rangeStartStr,
      rangeEndStr,
      sourceTimezone
    );
    for (const s of segs) tripLocalDays.add(s.dateStr);
  }

  const muteIds: string[] = [];
  const deleteIds: string[] = [];
  for (const c of nonProtected) {
    if (c.event_type === "reserve" && tripLocalDays.size > 0) {
      const reserveSegs = expandEventToDaySegmentsInRange(
        c.start_time,
        c.end_time,
        rangeStartStr,
        rangeEndStr,
        sourceTimezone
      );
      const overlapsTripDay = reserveSegs.some((s) => tripLocalDays.has(s.dateStr));
      if (overlapsTripDay) {
        muteIds.push(c.id);
        continue;
      }
    }
    deleteIds.push(c.id);
  }

  for (let i = 0; i < muteIds.length; i += DELETE_ID_CHUNK) {
    const chunk = muteIds.slice(i, i + DELETE_ID_CHUNK);
    const { error: muteError } = await supabase
      .from("schedule_events")
      .update({ is_muted: true })
      .in("id", chunk);
    if (muteError) {
      return {
        error: `Failed to import: ${muteError.message}`,
        technicalError: muteError.message,
      };
    }
  }

  for (let i = 0; i < deleteIds.length; i += DELETE_ID_CHUNK) {
    const chunk = deleteIds.slice(i, i + DELETE_ID_CHUNK);
    const { error: delError } = await supabase.from("schedule_events").delete().in("id", chunk);
    if (delError) {
      return {
        error: `Failed to import: ${delError.message}`,
        technicalError: delError.message,
      };
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

  if (tripChangeSummaries.length > 0) {
    await supabase.from("trip_change_summaries").delete().eq("user_id", userId);
    await supabase.from("trip_change_summaries").insert(
      tripChangeSummaries.map((s) => ({
        user_id: userId,
        pairing: s.pairing,
        summary: s,
      }))
    );
  }

  console.log("[Trip change return]", { count: tripChangeSummaries.length, pairings: tripChangeSummaries.map((s) => s.pairing) });

  return {
    success: `Imported ${rows.length} events`,
    count: rows.length,
    importedAt,
    tripChangeSummaries,
  };
}
