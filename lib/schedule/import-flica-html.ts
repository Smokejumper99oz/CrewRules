/**
 * Import FLICA HTML calendar into schedule_events.
 * Used when inbound email contains FLICA HTML (not .ics).
 */

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseFlicaHtml, type ParsedFlicaEvent } from "@/lib/schedule/parse-flica-html";
import { computeTripCredit } from "@/lib/schedule-time";
import { getReserveCreditPerDay } from "@/lib/tenant-config";
import { detectTripChanges, type TripChangeSummary } from "@/lib/trips/detect-trip-changes";

const FLICA_SOURCE = "flica_import";

const RESERVE_CODE = /\b(RSA|RSB|RSC|RSD|RSE|RSL)\b/i;

function isReserveAssignmentByTitle(title: string): boolean {
  return RESERVE_CODE.test(title ?? "") && (/\bTrip\b/i.test(title ?? "") || /\bS\d{4}\b/i.test(title ?? ""));
}

function inferEventType(summary: string): "trip" | "reserve" | "vacation" | "off" {
  const s = summary ?? "";
  if (/\bVAC\b|Vacation|\bV\d+\b/i.test(s)) return "vacation";
  if (/\bOFF\b|\bOff\b|Off Duty|DAY OFF/i.test(s)) return "off";
  if (isReserveAssignmentByTitle(s)) return "trip";
  if (/\b(RES|RSA|RSB|RSC|RSD|RDE|RSE|RSL)\b|Reserve/i.test(s)) return "reserve";
  return "trip";
}

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

export type ImportFlicaHtmlResult =
  | { success: string; count: number; importedAt: string; tripChangeSummaries: TripChangeSummary[] }
  | { error: string; technicalError?: string };

export type ImportFlicaHtmlParams = {
  supabase: SupabaseClient;
  userId: string;
  htmlText: string;
  sourceTimezone?: string | null;
  importBatchId?: string | null;
  tenant?: string;
  portal?: string;
};

/**
 * Parse FLICA HTML calendar, map to schedule_events rows, and upsert.
 */
export async function importFlicaHtmlFromText(
  params: ImportFlicaHtmlParams
): Promise<ImportFlicaHtmlResult> {
  const {
    supabase,
    userId,
    htmlText,
    sourceTimezone: sourceTimezoneParam,
    importBatchId: importBatchIdParam,
    tenant: tenantParam = "frontier",
    portal: portalParam = "pilots",
  } = params;

  const tenant = tenantParam;
  const portal = portalParam;
  const sourceTimezone = sourceTimezoneParam ?? "America/Denver";
  const importBatchId = importBatchIdParam ?? crypto.randomUUID();
  const importedAt = new Date().toISOString();
  const reserveCreditPerDay = getReserveCreditPerDay(tenant);
  const RESERVE_CREDIT_PER_DAY_MINUTES = Math.round(reserveCreditPerDay * 60);

  let parsed: ParsedFlicaEvent[];
  try {
    parsed = parseFlicaHtml(htmlText, { sourceTimezone });
  } catch {
    return { error: "Invalid FLICA HTML. Could not parse calendar." };
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

  if (events.length === 0) {
    return { error: "No calendar events found in the FLICA HTML" };
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

  return {
    success: `Imported ${events.length} events from FLICA HTML`,
    count: events.length,
    importedAt,
    tripChangeSummaries,
  };
}
