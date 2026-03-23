/**
 * Shared flight timing normalization for Commute Assist.
 * Resolves one consistent dep/arr UTC pair per flight so downstream (direct + 2-leg) get a single source of truth.
 * Priority: AeroDataBox for scheduled/base, AviationStack for live/disrupted overlay.
 *
 * Provider-aware handling for offsetless timestamps:
 * - AviationStack: returns UTC with +00:00; if offsetless, treat as UTC.
 * - AeroDataBox: uses scheduledTimeLocal; treat offsetless as local airport time.
 * - When ambiguous, prefer the interpretation that preserves a valid flight timeline (arr >= dep).
 */

import { parseAviationstackTs } from "@/lib/aviationstack";
import type { CommuteFlight } from "@/lib/aviationstack";

function hasOffsetOrZ(ts: string): boolean {
  return !!(ts?.trim() && (ts.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(ts)));
}

/** Parse timestamp with explicit UTC/offset as UTC. */
function parseAsUtc(ts: string): Date {
  if (!ts?.trim()) return new Date(0);
  return new Date(ts);
}

/** Parse offsetless timestamp as local airport time (AeroDataBox convention). */
function parseAsLocal(ts: string, tz: string): Date {
  if (!ts?.trim()) return new Date(0);
  return parseAviationstackTs(ts, tz);
}

/** Parse offsetless timestamp as UTC (AviationStack may return UTC without offset). */
function parseOffsetlessAsUtc(ts: string): Date {
  const clean = ts.replace(/[+-]\d{2}:\d{2}$|Z$/i, "").trim();
  if (!clean) return new Date(0);
  return new Date(clean + "Z");
}

/**
 * Parse timestamp to UTC. Provider-aware:
 * - With Z/offset: treat as UTC (AviationStack).
 * - Without offset: treat as local (AeroDataBox) by default.
 */
function toUtcDate(ts: string, tz: string): Date {
  if (!ts?.trim()) return new Date(0);
  if (hasOffsetOrZ(ts)) return parseAsUtc(ts);
  return parseAsLocal(ts, tz);
}

/**
 * Normalize a merged CommuteFlight to one consistent timing truth set.
 * - On-time: use departureTime/arrivalTime (ADB base) as UTC-consistent pair.
 * - Delayed/cancelled: resolve from live/scheduled fields without mixing unrelated sources.
 */
export function normalizeFlightTiming(
  f: CommuteFlight,
  originTz: string,
  destTz: string
): CommuteFlight {
  // Same-timezone routes (e.g. SAV-CLT): prefer route TZ over API's f.origin_tz/f.dest_tz.
  // AviationStack can return wrong arrival.timezone for some airports.
  const depTz = originTz === destTz ? originTz : (f.origin_tz ?? originTz);
  const arrTz = originTz === destTz ? originTz : (f.dest_tz ?? destTz);

  let depResolved: Date;
  let arrResolved: Date;

  if (f.status?.toLowerCase() === "cancelled" && f.dep_scheduled_raw && f.arr_scheduled_raw) {
    depResolved = toUtcDate(f.dep_scheduled_raw, depTz);
    arrResolved = toUtcDate(f.arr_scheduled_raw, arrTz);
  } else {
    const depActual = f.dep_actual_raw ?? f.dep_estimated_raw;
    const arrActual = f.arr_actual_raw ?? f.arr_estimated_raw;
    const depSched = f.dep_scheduled_raw ?? f.departureTime ?? "";
    const arrSched = f.arr_scheduled_raw ?? f.arrivalTime ?? "";

    if (depActual && arrActual) {
      depResolved = parseAviationstackTs(depActual, depTz);
      arrResolved = parseAviationstackTs(arrActual, arrTz);
    } else if (depActual) {
      depResolved = parseAviationstackTs(depActual, depTz);
      arrResolved = arrSched ? toUtcDate(arrSched, arrTz) : depResolved;
    } else if (arrActual) {
      depResolved = depSched ? toUtcDate(depSched, depTz) : new Date(0);
      arrResolved = parseAviationstackTs(arrActual, arrTz);
    } else {
      depResolved = f.departureTime ? toUtcDate(f.departureTime, depTz) : new Date(0);
      arrResolved = f.arrivalTime ? toUtcDate(f.arrivalTime, arrTz) : depResolved;
    }
  }

  // Sanity guard: arrival must never be before departure. If invalid, try alternate
  // parse (offsetless as UTC) or fall back to dep + duration.
  const arrRaw = f.arr_scheduled_raw ?? f.arrivalTime ?? "";
  if (arrResolved.getTime() < depResolved.getTime()) {
    if (arrRaw && !hasOffsetOrZ(arrRaw)) {
      const arrAsUtc = parseOffsetlessAsUtc(arrRaw);
      if (arrAsUtc.getTime() >= depResolved.getTime()) {
        arrResolved = arrAsUtc;
      }
    }
    if (arrResolved.getTime() < depResolved.getTime()) {
      // Same timezone routes (e.g. SAV-CLT): provider may return wrong arr. Use dep + duration.
      const providerDur = f.durationMinutes ?? 60;
      const fallbackDur = providerDur >= 30 ? providerDur : 60;
      arrResolved = new Date(depResolved.getTime() + fallbackDur * 60_000);
    }
  }

  const depUtc = depResolved.toISOString();
  const arrUtc = arrResolved.toISOString();
  const durationMinutes = Math.max(
    0,
    Math.round((arrResolved.getTime() - depResolved.getTime()) / 60000)
  );

  // Debug: DL 1946 ATL-SJU timing trace (remove after root cause found)
  const isDl1946AtlSju =
    (f.origin === "ATL" || f.origin === "atl") &&
    (f.destination === "SJU" || f.destination === "sju") &&
    (f.carrier === "DL" || f.carrier === "dl") &&
    /1946/.test(f.flightNumber ?? "");
  if (isDl1946AtlSju && process.env.NODE_ENV !== "production") {
    console.log("[Commute Assist] DL 1946 ATL→SJU normalizeFlightTiming", {
      input: {
        departureTime: f.departureTime,
        arrivalTime: f.arrivalTime,
        dep_scheduled_raw: f.dep_scheduled_raw,
        arr_scheduled_raw: f.arr_scheduled_raw,
        dep_estimated_raw: f.dep_estimated_raw,
        arr_estimated_raw: f.arr_estimated_raw,
        origin_tz: f.origin_tz,
        dest_tz: f.dest_tz,
        durationMinutes: f.durationMinutes,
      },
      routeTz: { originTz, destTz },
      output: {
        departureTime: depUtc,
        arrivalTime: arrUtc,
        durationMinutes,
      },
    });
  }

  return {
    ...f,
    departureTime: depUtc,
    arrivalTime: arrUtc,
    durationMinutes,
  };
}
