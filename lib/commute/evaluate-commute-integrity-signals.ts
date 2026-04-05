/**
 * Best-effort Commute Assist coverage signals for Super Admin (system_events).
 * Does not affect flight results; safe to fire-and-forget from getCommuteFlights.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/system-events";
import type { CommuteFlight } from "@/lib/aviationstack";
import {
  COMMUTE_COVERAGE_UI_MESSAGE,
  COMMUTE_COVERAGE_UI_TITLE,
  type CommuteCoverageForClient,
  type CommuteCoverageReasonCode,
} from "./commute-coverage-public";

export type { CommuteCoverageForClient, CommuteCoverageReasonCode } from "./commute-coverage-public";

const DEDUPE_WINDOW_MS = 60 * 60 * 1000;
const RECENT_EVENTS_LIMIT = 50;

export type CommuteIntegrityProviders = {
  aviationstackFailed: boolean;
  aerodataboxFailed: boolean;
  aerodataboxSkipped: boolean;
};

export type CommuteIntegrityLogInput = {
  tenant: string;
  userId: string;
  origin: string;
  destination: string;
  commuteDate: string;
  aviationstackCount: number;
  aerodataboxCount: number;
  finalFlightCount: number;
  /** After filterCodeShareFlights; raw live fields match post-normalize CommuteFlight. */
  mergedFlightsForLiveScan: CommuteFlight[];
  providers: CommuteIntegrityProviders;
  sameDayInOrigin: boolean;
};

/** Inputs for coverage evaluation without server logging identity (UI + shared rules). */
export type CommuteCoverageSignalInput = Omit<CommuteIntegrityLogInput, "tenant" | "userId">;

type EmitSpec = {
  reasonCode: CommuteCoverageReasonCode;
  severity: "warning" | "info";
  title: string;
  message: string;
};

function sortedReasonCodesKey(codes: string[]): string {
  return [...codes].sort().join("|");
}

function hasNonEmptyRaw(v: unknown): boolean {
  if (v == null) return false;
  return String(v).trim() !== "";
}

function hasMeaningfulDelay(v: unknown): boolean {
  if (v == null) return false;
  const n = Number(v);
  return Number.isFinite(n) && n >= 1;
}

/** Live evidence aligned with operational-status delay threshold (≥1 min). */
function flightHasLiveFieldEvidence(f: CommuteFlight): boolean {
  return (
    hasNonEmptyRaw(f.dep_estimated_raw) ||
    hasNonEmptyRaw(f.dep_actual_raw) ||
    hasNonEmptyRaw(f.arr_estimated_raw) ||
    hasNonEmptyRaw(f.arr_actual_raw) ||
    hasMeaningfulDelay(f.dep_delay_min) ||
    hasMeaningfulDelay(f.arr_delay_min)
  );
}

function countWithLiveEvidence(flights: CommuteFlight[]): number {
  return flights.reduce((acc, f) => acc + (flightHasLiveFieldEvidence(f) ? 1 : 0), 0);
}

function bothProvidersSucceeded(p: CommuteIntegrityProviders): boolean {
  return !p.aviationstackFailed && !p.aerodataboxFailed && !p.aerodataboxSkipped;
}

/**
 * Shared V1 coverage rules (Super Admin events + user-facing warning).
 * Order: single_provider, low_flight_count, no_live_fields_same_day.
 */
export function collectCoverageReasonCodes(input: CommuteCoverageSignalInput): CommuteCoverageReasonCode[] {
  const codes: CommuteCoverageReasonCode[] = [];

  if (
    bothProvidersSucceeded(input.providers) &&
    ((input.aviationstackCount === 0 && input.aerodataboxCount > 0) ||
      (input.aerodataboxCount === 0 && input.aviationstackCount > 0))
  ) {
    codes.push("single_provider");
  }

  if (input.finalFlightCount < 3) {
    codes.push("low_flight_count");
  }

  const withLive = countWithLiveEvidence(input.mergedFlightsForLiveScan);
  if (input.sameDayInOrigin && input.finalFlightCount > 0 && withLive === 0) {
    codes.push("no_live_fields_same_day");
  }

  return codes;
}

function toCommuteCoverageUi(reasons: CommuteCoverageReasonCode[]): CommuteCoverageForClient {
  return {
    coverageWarning: reasons.length > 0,
    coverageWarningReasons: reasons,
    coverageWarningTitle: COMMUTE_COVERAGE_UI_TITLE,
    coverageWarningMessage: COMMUTE_COVERAGE_UI_MESSAGE,
  };
}

/** Full client payload after a fresh provider fetch (all three signals). */
export function getCommuteCoverageForClient(input: CommuteCoverageSignalInput): CommuteCoverageForClient {
  return toCommuteCoverageUi(collectCoverageReasonCodes(input));
}

/**
 * When reading legacy cache without stored coverage metadata: flight-derived signals only
 * (low count + same-day no live). Omits single_provider (needs provider counts).
 */
export function getCommuteCoverageForCacheFallback(
  flights: CommuteFlight[],
  sameDayInOrigin: boolean
): CommuteCoverageForClient {
  const finalFlightCount = flights.length;
  const withLive = countWithLiveEvidence(flights);
  const reasons: CommuteCoverageReasonCode[] = [];
  if (finalFlightCount < 3) reasons.push("low_flight_count");
  if (sameDayInOrigin && finalFlightCount > 0 && withLive === 0) {
    reasons.push("no_live_fields_same_day");
  }
  return toCommuteCoverageUi(reasons);
}

function adminSpecForCode(code: CommuteCoverageReasonCode, input: CommuteIntegrityLogInput): EmitSpec {
  const o = input.origin;
  const d = input.destination;
  const date = input.commuteDate;
  switch (code) {
    case "single_provider":
      return {
        reasonCode: code,
        severity: "warning",
        title: "Commute Assist: single provider returned flights",
        message: `Only one flight provider returned results for ${o}→${d} on ${date} (AviationStack: ${input.aviationstackCount}, AeroDataBox: ${input.aerodataboxCount}).`,
      };
    case "low_flight_count":
      return {
        reasonCode: code,
        severity: "warning",
        title: "Commute Assist: low direct-flight count",
        message: `Only ${input.finalFlightCount} direct flight(s) after merge for ${o}→${d} on ${date}.`,
      };
    case "no_live_fields_same_day":
      return {
        reasonCode: code,
        severity: "info",
        title: "Commute Assist: no live timing fields (same day)",
        message: `Same-day search ${o}→${d} on ${date}: ${input.finalFlightCount} flight(s) with no estimated/actual/delay fields from providers.`,
      };
  }
}

function buildEmitSpecs(input: CommuteIntegrityLogInput): EmitSpec[] {
  return collectCoverageReasonCodes(input).map((c) => adminSpecForCode(c, input));
}

function metadataMatchesDedupe(
  meta: Record<string, unknown> | null | undefined,
  origin: string,
  destination: string,
  commuteDate: string,
  reasonKey: string
): boolean {
  if (!meta || meta.commute_integrity !== true) return false;
  if (String(meta.origin ?? "").toUpperCase() !== origin.toUpperCase()) return false;
  if (String(meta.destination ?? "").toUpperCase() !== destination.toUpperCase()) return false;
  if (String(meta.commute_date ?? "") !== commuteDate) return false;
  const rc = meta.reason_codes;
  if (!Array.isArray(rc)) return false;
  const codes = rc.map((x) => String(x));
  return sortedReasonCodesKey(codes) === reasonKey;
}

async function fetchRecentCommuteIntegrityRows(): Promise<
  { created_at: string; metadata: Record<string, unknown> | null }[]
> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("system_events")
      .select("created_at, metadata")
      .eq("type", "provider")
      .eq("dismissed", false)
      .order("created_at", { ascending: false })
      .limit(RECENT_EVENTS_LIMIT);

    if (error) {
      console.error("[commute-integrity] recent events fetch failed:", error.message);
      return [];
    }
    return (data ?? []) as { created_at: string; metadata: Record<string, unknown> | null }[];
  } catch (e) {
    console.error("[commute-integrity] recent events fetch threw:", e);
    return [];
  }
}

function isDuplicateInWindow(
  rows: { created_at: string; metadata: Record<string, unknown> | null }[],
  origin: string,
  destination: string,
  commuteDate: string,
  reasonCode: string,
  nowMs: number
): boolean {
  const reasonKey = sortedReasonCodesKey([reasonCode]);
  const windowStart = nowMs - DEDUPE_WINDOW_MS;
  for (const row of rows) {
    const t = new Date(row.created_at).getTime();
    if (Number.isNaN(t) || t < windowStart) continue;
    if (metadataMatchesDedupe(row.metadata, origin, destination, commuteDate, reasonKey)) {
      return true;
    }
  }
  return false;
}

/**
 * Evaluate coverage signals and log at most one system_events row per signal (deduped within the last hour).
 * Never throws.
 */
export async function maybeLogCommuteIntegritySignals(input: CommuteIntegrityLogInput): Promise<void> {
  try {
    const specs = buildEmitSpecs(input);
    if (specs.length === 0) return;

    const nowMs = Date.now();
    const rows = await fetchRecentCommuteIntegrityRows();

    const withLive = countWithLiveEvidence(input.mergedFlightsForLiveScan);

    for (const spec of specs) {
      if (
        isDuplicateInWindow(
          rows,
          input.origin,
          input.destination,
          input.commuteDate,
          spec.reasonCode,
          nowMs
        )
      ) {
        continue;
      }

      await logSystemEvent({
        type: "provider",
        severity: spec.severity,
        title: spec.title,
        message: spec.message,
        metadata: {
          commute_integrity: true,
          reason_codes: [spec.reasonCode],
          tenant: input.tenant,
          user_id: input.userId,
          origin: input.origin,
          destination: input.destination,
          commute_date: input.commuteDate,
          counts: {
            aviationstack: input.aviationstackCount,
            aerodatabox: input.aerodataboxCount,
            final: input.finalFlightCount,
            with_any_live_field: withLive,
          },
          providers: {
            aviationstack_failed: input.providers.aviationstackFailed,
            aerodatabox_failed: input.providers.aerodataboxFailed,
            aerodatabox_skipped: input.providers.aerodataboxSkipped,
          },
        },
      });
    }
  } catch (e) {
    console.error("[commute-integrity] maybeLogCommuteIntegritySignals failed:", e);
  }
}
