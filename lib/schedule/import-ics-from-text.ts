/**
 * Shared schedule import: parse ICS text → map to rows → upsert schedule_events.
 * Used by manual ICS upload and inbound email auto-import.
 */

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseIcs } from "@/lib/ics-parse";
import { computeTripCredit } from "@/lib/schedule-time";
import { getReserveCreditPerDay } from "@/lib/tenant-config";
import { detectTripChanges, type TripChangeSummary } from "@/lib/trips/detect-trip-changes";
import { formatInTimeZone } from "date-fns-tz";
import { getBidPeriodForTimestamp, getFrontierBidPeriodTimezone } from "@/lib/frontier-bid-periods";

const FLICA_SOURCE = "flica_import";

/** Reserve codes: RSA, RSB, RSC, RSD, RSE, RSL. */
const RESERVE_CODE = /\b(RSA|RSB|RSC|RSD|RSE|RSL)\b/i;

/** True if title indicates a trip assigned from reserve (e.g. "RSA Trip S3019"). */
function isReserveAssignmentByTitle(title: string): boolean {
  return RESERVE_CODE.test(title ?? "") && (/\bTrip\b/i.test(title ?? "") || /\bS\d{4}\b/i.test(title ?? ""));
}

/**
 * Infer event_type from ICS summary/title (FLICA-style labels).
 */
function inferEventType(summary: string): "trip" | "reserve" | "vacation" | "off" | "pay" {
  const s = summary ?? "";
  if (/\bVAC\b|Vacation|\bV\d+\b/i.test(s)) return "vacation";
  if (/\bOFF\b|\bOff\b|Off Duty|DAY OFF/i.test(s)) return "off";
  if (/\bPAY\b/i.test(s)) return "pay";
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

/**
 * Parse ICS text, map to schedule_events rows, and upsert.
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

  const uidCounts = new Map<string, number>();
  for (const ev of events) {
    const u = ev.externalUid?.trim() ?? "";
    if (u.length > 0) uidCounts.set(u, (uidCounts.get(u) ?? 0) + 1);
  }

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

  // Dedupe within the incoming file only. Rows already in DB must still be upserted so that after the
  // bid-window mute step they are re-written with is_muted: false (avoids "Previous" stale rows).
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

  // Trip change detection: compare with existing before overwrite
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

  if (rows.length > 0) {
    const tz = sourceTimezone;
    const countByBidPeriod = new Map<string, { startStr: string; endStr: string; count: number }>();
    for (const r of rows) {
      const period = getBidPeriodForTimestamp(r.start_time, tz);
      if (period) {
        const key = `${period.startStr.slice(0, 4)}-${period.bidMonthIndex}`;
        const existing = countByBidPeriod.get(key);
        if (!existing) {
          countByBidPeriod.set(key, { startStr: period.startStr, endStr: period.endStr, count: 1 });
        } else {
          existing.count += 1;
        }
        if (process.env.NODE_ENV === "development") {
          console.log("[bid-period-check]", {
            title: r.title ?? null,
            start_time: r.start_time ?? null,
            timezone: tz,
            resolvedLocalDateTime: formatInTimeZone(new Date(r.start_time), tz, "yyyy-MM-dd HH:mm"),
            bidPeriod: period?.name ?? null,
            bidMonthIndex: period?.bidMonthIndex ?? null,
          });
        }
      }
    }
    let primary: { startStr: string; endStr: string } | null = null;
    let maxCount = 0;
    for (const v of countByBidPeriod.values()) {
      if (v.count > maxCount) {
        maxCount = v.count;
        primary = { startStr: v.startStr, endStr: v.endStr };
      }
    }
    if (primary) {
      const rangeStart = `${primary.startStr}T00:00:00.000Z`;
      const rangeEnd = `${primary.endStr}T23:59:59.999Z`;
      await supabase
        .from("schedule_events")
        .update({ is_muted: true })
        .eq("user_id", userId)
        .eq("source", FLICA_SOURCE)
        .gte("start_time", rangeStart)
        .lte("start_time", rangeEnd);
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

  // Persist trip change summaries for dashboard (Current Trip card)
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
