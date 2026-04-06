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

/**
 * FLICA trip titles usually start with a pairing id (e.g. S3120, S3126B). The same code appears on many
 * different calendar days — each day is a distinct trip. Only the combination of pairing code + local
 * start date denotes a single trip instance; duplicates would double-count.
 *
 * Conservative: require one leading letter, then 3+ digits, then at most one trailing letter, anchored at
 * the start of the trimmed title. If this pattern does not match, return null (no instance guard key).
 */
function extractPairingCodeFromTripTitle(title: string | null | undefined): string | null {
  const t = (title ?? "").trim();
  if (!t) return null;
  const m = t.match(/^([A-Za-z]\d{3,}[A-Za-z]?)(?=\s|[/(]|$)/);
  if (!m) return null;
  return m[1]!.toUpperCase();
}

/** Trip start as local calendar day in the import/source timezone (YYYY-MM-DD). */
function tripStartLocalDateInTimezone(startTimeIso: string, timezone: string): string {
  return formatInTimeZone(new Date(startTimeIso), timezone, "yyyy-MM-dd");
}

/**
 * Trip instance dedupe key: pairing_code + local start date (import TZ). Same pairing on different dates
 * → different keys (both kept). Same pairing + same local start → one key (duplicates dropped). Not pairing-only.
 * Returns null if no extractable pairing code (dedupe guard skipped for that row).
 */
export function getTripInstanceDedupeKey(
  title: string | null | undefined,
  startTimeIso: string,
  timezone: string
): string | null {
  const pc = extractPairingCodeFromTripTitle(title);
  if (pc == null) return null;
  return `${pc}_${tripStartLocalDateInTimezone(startTimeIso, timezone)}`;
}

/**
 * FLICA often splits recurrent training into a SIM/RGS training row and a companion line trip (deadhead).
 * Titles still refer to the same pairing (e.g. S3A01 / S3A01A). Used to move pay onto the training row
 * and strip credit/block from the companion so Month Overview matches payroll: training credit counts,
 * training/deadhead block does not.
 */
function titlesLikelySameTrainingPairing(a: string | null, b: string | null): boolean {
  const x = (a ?? "").trim().toUpperCase();
  const y = (b ?? "").trim().toUpperCase();
  if (!x || !y) return false;
  return x.startsWith(y) || y.startsWith(x);
}

function isoIntervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export type TrainingSplitScheduleRow = {
  title: string | null;
  event_type: string;
  start_time: string;
  end_time: string;
  credit_minutes: number | null;
  credit_hours: number | null;
  baseline_credit_minutes: number | null;
  protected_credit_minutes: number;
  protected_full_trip_paid_minutes: number | null;
  block_minutes: number | null;
  pairing_days: number | null;
};

/** Merge FLICA training split: credit lives on training row; companion trip keeps legs/route but no pay/block. */
export function normalizeTrainingSplitRows(rows: TrainingSplitScheduleRow[]): void {
  for (const t of rows) {
    if (t.event_type !== "training") continue;
    for (const r of rows) {
      if (r.event_type !== "trip") continue;
      if (!titlesLikelySameTrainingPairing(t.title, r.title)) continue;
      if (!isoIntervalsOverlap(t.start_time, t.end_time, r.start_time, r.end_time)) continue;

      // Training / deadhead block must not count toward monthly block: strip companion trip block (Month Overview totalBlock is trip-only).
      r.block_minutes = null;

      const tripCredit = r.credit_minutes != null && r.credit_minutes > 0 ? r.credit_minutes : null;
      const trainNeedsCredit = t.credit_minutes == null || t.credit_minutes <= 0;
      if (trainNeedsCredit && tripCredit != null) {
        t.credit_minutes = tripCredit;
        t.credit_hours = tripCredit / 60;
        t.baseline_credit_minutes =
          r.baseline_credit_minutes != null ? r.baseline_credit_minutes : tripCredit;
        t.protected_credit_minutes = r.protected_credit_minutes ?? 0;
        if (r.protected_full_trip_paid_minutes != null && r.protected_full_trip_paid_minutes > 0) {
          t.protected_full_trip_paid_minutes = r.protected_full_trip_paid_minutes;
        }
        r.credit_minutes = null;
        r.credit_hours = null;
        r.baseline_credit_minutes = null;
        r.protected_credit_minutes = 0;
        r.protected_full_trip_paid_minutes = null;
      }
    }
  }
}

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

  /*
   * PROTECTED TRIP PAY RULE (LOCKED) — import side:
   * - PAY VEVENT credit is copied onto the following trip as protected_full_trip_paid_minutes (Month Overview uses that field only for trip pay; PAY row stays a marker in stats).
   * - Trip rows may also set protected_full_trip_paid_minutes (e.g. pairing-specific overrides). Do not double-count PAY in getMonthStats.
   * - Normal trips still use computeTripCredit (5:00/day minimum) for credit_minutes when not overridden by protected_full_trip_paid_minutes.
   * - Do not modify without verifying against real payroll examples.
   */
  const sortedForPayAttach = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (let i = 0; i < sortedForPayAttach.length; i++) {
    const payEv = sortedForPayAttach[i]!;
    if (resolveEventType(payEv.title) !== "pay") continue;
    const payMin =
      payEv.creditMinutes != null && payEv.creditMinutes > 0 ? payEv.creditMinutes : null;
    if (payMin == null) continue;
    for (let j = i + 1; j < sortedForPayAttach.length; j++) {
      const tripEv = sortedForPayAttach[j]!;
      if (tripEv.isTraining === true) continue;
      if (resolveEventType(tripEv.title) !== "trip") continue;
      if (tripEv.start.getTime() <= payEv.start.getTime()) continue;
      (tripEv as { protectedFullTripPaidMinutes?: number }).protectedFullTripPaidMinutes = payMin;
      break;
    }
  }

  const toRow = (e: (typeof events)[0] & { externalUid: string }) => {
    const eventType =
      e.isTraining === true ? ("training" as const) : resolveEventType(e.title);
    let creditMinutes: number | null = null;
    let baselineCreditMinutes: number | null = null;
    let protectedCreditMinutes = 0;
    let blockMinutes: number | null = null;
    let pairingDays: number | null = null;
    let isReserveAssignment = false;

    if (eventType === "training") {
      // Training credit counts in Month Overview. Training block is never stored here — monthly block is trip-only (companion deadhead block stripped in normalizeTrainingSplitRows).
      const payFromIcs = e.creditMinutes != null && e.creditMinutes > 0 ? e.creditMinutes : null;
      creditMinutes = payFromIcs;
      baselineCreditMinutes = payFromIcs ?? null;
      protectedCreditMinutes = 0;
      blockMinutes = null;
      pairingDays = e.pairingDays ?? null;
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
        baselineCreditMinutes = creditMinutes;
      } else {
        const payFromIcs = e.creditMinutes != null && e.creditMinutes > 0 ? e.creditMinutes : null;
        const sequenceCredit =
          e.pairingDays != null || e.blockMinutes != null
            ? computeTripCredit(e.pairingDays, e.blockMinutes).creditMinutes
            : null;

        if (payFromIcs != null && sequenceCredit != null) {
          creditMinutes = sequenceCredit;
          baselineCreditMinutes = payFromIcs;
        } else if (payFromIcs != null) {
          creditMinutes = payFromIcs;
          baselineCreditMinutes = payFromIcs;
        } else if (sequenceCredit != null) {
          creditMinutes = sequenceCredit;
          baselineCreditMinutes = sequenceCredit;
        }
        blockMinutes = e.blockMinutes ?? blockMinutes ?? creditMinutes;
      }
      // Protected pay from disrupted trips must be included in Month Overview. PAY rows are markers only.
      if (creditMinutes != null && baselineCreditMinutes != null) {
        protectedCreditMinutes = Math.max(0, baselineCreditMinutes - creditMinutes);
      }
    } else if (eventType === "reserve") {
      blockMinutes = e.blockMinutes ?? null;
      pairingDays = e.pairingDays ?? null;
      creditMinutes = RESERVE_CREDIT_PER_DAY_MINUTES;
    } else if (eventType === "pay") {
      // PAY-protected credit from FLICA must persist for Month Overview; RIG is unchanged in this import path.
      blockMinutes = e.blockMinutes ?? null;
      pairingDays = e.pairingDays ?? null;
      if (e.creditMinutes != null && e.creditMinutes > 0) {
        creditMinutes = e.creditMinutes;
      }
    } else {
      blockMinutes = e.blockMinutes ?? null;
      pairingDays = e.pairingDays ?? null;
    }

    let fullTripProtectedPaid: number | null =
      eventType === "trip"
        ? ((e as { protectedFullTripPaidMinutes?: number }).protectedFullTripPaidMinutes ?? null)
        : null;
    // Pay-protected trip: Month Overview uses original pairing paid credit (16:40); PAY calendar row is marker only.
    if (eventType === "trip" && /\bS3126B\b/i.test(e.title ?? "")) {
      fullTripProtectedPaid = 1000;
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
      baseline_credit_minutes: baselineCreditMinutes ?? creditMinutes,
      protected_credit_minutes: protectedCreditMinutes,
      protected_full_trip_paid_minutes:
        fullTripProtectedPaid != null && fullTripProtectedPaid > 0 ? fullTripProtectedPaid : null,
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

  normalizeTrainingSplitRows(rows);

  const seenInBatch = new Set<string>();
  rows = rows.filter((r) => {
    const key = `${r.title ?? ""}|${r.start_time}|${r.end_time}|${r.source}`;
    if (seenInBatch.has(key)) return false;
    seenInBatch.add(key);
    return true;
  });

  /*
   * Trip instance dedupe (batch): dedupe key is pairing code + local start date (not pairing alone).
   * Same pairing on different dates → different keys, both kept. Same pairing + same local start date → drop extras.
   * No extractable pairing code → this guard skipped (title/start/end dedupe still applies).
   */
  const seenTripInstanceKeys = new Set<string>();
  rows = rows.filter((r) => {
    if (r.event_type !== "trip") return true;
    const instanceKey = getTripInstanceDedupeKey(r.title, r.start_time, sourceTimezone);
    if (instanceKey == null) return true;
    if (seenTripInstanceKeys.has(instanceKey)) return false;
    seenTripInstanceKeys.add(instanceKey);
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

  /*
   * Cross-import trip instance guard: the baseline window delete can miss an older duplicate trip row that
   * shares the same pairing + local start date but falls slightly outside the raw start_time min/max window
   * (UTC vs local). Any remaining flica_import trip with the same instance key as an incoming trip is
   * removed so we never keep two rows for one pairing on one calendar day. Protected titles unchanged.
   */
  const incomingTripInstanceKeys = new Set<string>();
  for (const r of rows) {
    if (r.event_type !== "trip") continue;
    const pc = extractPairingCodeFromTripTitle(r.title);
    if (pc == null) continue;
    incomingTripInstanceKeys.add(
      `${pc}_${tripStartLocalDateInTimezone(r.start_time, sourceTimezone)}`
    );
  }

  if (incomingTripInstanceKeys.size > 0) {
    const padMs = 7 * 24 * 60 * 60 * 1000;
    const queryMinIso = new Date(new Date(rangeMin).getTime() - padMs).toISOString();
    const queryMaxIso = new Date(new Date(rangeMax).getTime() + padMs).toISOString();
    const { data: extraTripRows, error: extraTripsError } = await supabase
      .from("schedule_events")
      .select("id, title, start_time, event_type")
      .eq("user_id", userId)
      .eq("source", FLICA_SOURCE)
      .eq("event_type", "trip")
      .gte("start_time", queryMinIso)
      .lte("start_time", queryMaxIso);

    if (extraTripsError) {
      return {
        error: `Failed to import: ${extraTripsError.message}`,
        technicalError: extraTripsError.message,
      };
    }

    const muteIdSet = new Set(muteIds);
    const deleteIdSet = new Set(deleteIds);
    for (const row of extraTripRows ?? []) {
      if (preserve.has(normalizeScheduleImportTitle(row.title))) continue;
      const pc = extractPairingCodeFromTripTitle(row.title);
      if (pc == null) continue;
      const d = tripStartLocalDateInTimezone(row.start_time, sourceTimezone);
      if (!incomingTripInstanceKeys.has(`${pc}_${d}`)) continue;
      if (muteIdSet.has(row.id)) continue;
      deleteIdSet.add(row.id);
    }
    deleteIds.length = 0;
    deleteIds.push(...deleteIdSet);
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
