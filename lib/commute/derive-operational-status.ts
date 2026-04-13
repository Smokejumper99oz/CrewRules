/**
 * Canonical operational status derivation for Commute Assist.
 * Single source of truth: status is computed once in the data layer, UI consumes it.
 */

import { addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { OperationalStatus, OperationalStatusLabel } from "./operational-status-types";

export type { OperationalStatus, OperationalStatusLabel } from "./operational-status-types";

export type OperationalStatusInput = {
  depUtc: string;
  arrUtc: string;
  originTz?: string;
  destTz?: string;
  dep_scheduled_raw?: string;
  dep_estimated_raw?: string;
  dep_actual_raw?: string;
  arr_scheduled_raw?: string;
  arr_estimated_raw?: string;
  arr_actual_raw?: string;
  dep_delay_min?: number | null;
  arr_delay_min?: number | null;
  status?: string;
  /** Optional: when set and matches AA 1352 SAV→CLT, log verification. */
  _debug?: { carrier: string; flightNumber: string; origin: string; destination: string };
};

function hasOffsetOrZ(ts: string): boolean {
  return !!(ts?.trim() && (ts.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(ts)));
}

function stripOffset(s: string): string {
  return s.replace(/[+-]\d{2}:\d{2}$|Z$/i, "").trim();
}

/**
 * Provider-aware timestamp parsing.
 * - Offset-aware (Z or ±HH:MM): parse as UTC, except America/* where providers often mislabel local as Z.
 * - Offsetless: parse as airport-local naive time.
 */
export function parseTimestampProviderAware(ts: string, tz: string): Date | null {
  if (!ts?.trim()) return null;
  try {
    if (hasOffsetOrZ(ts)) {
      const clean = stripOffset(ts);
      if (tz.startsWith("America/")) {
        const d = fromZonedTime(clean, tz);
        return Number.isNaN(d.getTime()) ? null : d;
      }
      const d = new Date(ts);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const clean = stripOffset(ts);
    const d = fromZonedTime(clean, tz);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/** Provider status text indicating delay or diversion. */
function statusIndicatesDelay(status: string | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return (
    s.includes("delay") ||
    s.includes("divert") ||
    s === "diverted" ||
    s === "delayed"
  );
}

/**
 * Derive canonical operational status from merged flight data.
 * Priority: cancelled -> landed/arrived/completed -> numeric delay -> timestamp delay -> proven on_time -> provider status -> unknown.
 * Provider textual status cannot override stronger timing evidence (proven no-delay).
 */
export function deriveOperationalStatus(
  input: OperationalStatusInput,
  originTz: string,
  destTz: string
): OperationalStatus {
  const depTz = input.originTz ?? originTz;
  const arrTz = input.destTz ?? destTz;
  const parseTs = (ts: string, tz: string) => parseTimestampProviderAware(ts, tz);
  const isAa1352SavClt =
    input._debug &&
    input._debug.carrier === "AA" &&
    /1352/.test(input._debug.flightNumber ?? "") &&
    input._debug.origin === "SAV" &&
    input._debug.destination === "CLT";

  // a. cancelled/canceled provider status -> cancelled
  const statusLower = (input.status ?? "").toLowerCase();
  if (statusLower === "cancelled" || statusLower === "canceled") {
    let depSched = formatInTimeZone(new Date(input.depUtc), depTz, "HH:mm");
    let depSortD = new Date(input.depUtc);
    if (input.dep_scheduled_raw) {
      const p = parseTs(input.dep_scheduled_raw, depTz);
      if (p) {
        depSched = formatInTimeZone(p, depTz, "HH:mm");
        depSortD = p;
      }
    }
    let arrSched = formatInTimeZone(new Date(input.arrUtc), arrTz, "HH:mm");
    let arrSortD = new Date(input.arrUtc);
    if (input.arr_scheduled_raw) {
      const p = parseTs(input.arr_scheduled_raw, arrTz);
      if (p) {
        arrSched = formatInTimeZone(p, arrTz, "HH:mm");
        arrSortD = p;
      }
    }
    return {
      label: "cancelled",
      delay_minutes: null,
      source_of_truth: "provider_status",
      confidence: "high",
      dep: { scheduled: depSched, actual: depSched },
      arr: { scheduled: arrSched, actual: arrSched },
      sort_dep_utc: depSortD.toISOString(),
      sort_arr_utc: arrSortD.toISOString(),
    };
  }

  // a2. landed / arrived / completed -> completed
  if (statusLower === "landed" || statusLower === "arrived" || statusLower === "completed") {
    return {
      label: "completed",
      delay_minutes: 0,
      source_of_truth: "provider_status",
      confidence: "high",
      sort_dep_utc: input.depUtc,
      sort_arr_utc: input.arrUtc,
    };
  }

  // b. dep_delay_min or arr_delay_min >= 1 -> delayed
  const depDelay = input.dep_delay_min != null ? Number(input.dep_delay_min) : 0;
  const arrDelay = input.arr_delay_min != null ? Number(input.arr_delay_min) : 0;
  if (depDelay >= 1 || arrDelay >= 1) {
    const delayMin = Math.max(depDelay, arrDelay);
    let depSched = formatInTimeZone(new Date(input.depUtc), depTz, "HH:mm");
    if (input.dep_scheduled_raw) {
      const p = parseTs(input.dep_scheduled_raw, depTz);
      if (p) depSched = formatInTimeZone(p, depTz, "HH:mm");
    }
    let arrSched = formatInTimeZone(new Date(input.arrUtc), arrTz, "HH:mm");
    if (input.arr_scheduled_raw) {
      const p = parseTs(input.arr_scheduled_raw, arrTz);
      if (p) arrSched = formatInTimeZone(p, arrTz, "HH:mm");
    }
    const depNow = input.dep_actual_raw ?? input.dep_estimated_raw;
    const arrNow = input.arr_actual_raw ?? input.arr_estimated_raw;
    let depSortD = new Date(input.depUtc);
    let arrSortD = new Date(input.arrUtc);
    let depActual = depSched;
    if (depNow) {
      const p = parseTs(depNow, depTz);
      if (p) {
        depActual = formatInTimeZone(p, depTz, "HH:mm");
        depSortD = p;
      }
    } else if (depDelay >= 1) {
      const depSchedDate = input.dep_scheduled_raw
        ? parseTs(input.dep_scheduled_raw, depTz)
        : new Date(input.depUtc);
      if (depSchedDate && !Number.isNaN(depSchedDate.getTime())) {
        const moved = addMinutes(depSchedDate, depDelay);
        depActual = formatInTimeZone(moved, depTz, "HH:mm");
        depSortD = moved;
      }
    }
    let arrActual = arrSched;
    if (arrNow) {
      const p = parseTs(arrNow, arrTz);
      if (p) {
        arrActual = formatInTimeZone(p, arrTz, "HH:mm");
        arrSortD = p;
      }
    } else if (arrDelay >= 1) {
      const arrSchedDate = input.arr_scheduled_raw
        ? parseTs(input.arr_scheduled_raw, arrTz)
        : new Date(input.arrUtc);
      if (arrSchedDate && !Number.isNaN(arrSchedDate.getTime())) {
        const moved = addMinutes(arrSchedDate, arrDelay);
        arrActual = formatInTimeZone(moved, arrTz, "HH:mm");
        arrSortD = moved;
      }
    }
    return {
      label: "delayed",
      delay_minutes: delayMin,
      source_of_truth: depDelay >= 1 ? "dep_delay_min" : "arr_delay_min",
      confidence: "high",
      dep: { scheduled: depSched, actual: depActual },
      arr: { scheduled: arrSched, actual: arrActual },
      sort_dep_utc: depSortD.toISOString(),
      sort_arr_utc: arrSortD.toISOString(),
    };
  }

  // c. timestamp-derived delay >= 60 seconds -> delayed
  const depWasRaw = input.dep_scheduled_raw;
  const depNowRaw = input.dep_actual_raw ?? input.dep_estimated_raw;
  const arrWasRaw = input.arr_scheduled_raw;
  const arrNowRaw = input.arr_actual_raw ?? input.arr_estimated_raw;

  let depTsDelayMs = 0;
  let arrTsDelayMs = 0;
  let depDisplay: { scheduled: string; actual: string } | undefined;
  let arrDisplay: { scheduled: string; actual: string } | undefined;
  let depSortFromTs: Date | undefined;
  let arrSortFromTs: Date | undefined;

  if (depWasRaw && depNowRaw) {
    const was = parseTs(depWasRaw, depTz);
    const now = parseTs(depNowRaw, depTz);
    if (was && now) {
      depTsDelayMs = now.getTime() - was.getTime();
      if (depTsDelayMs >= 60000) {
        depDisplay = {
          scheduled: formatInTimeZone(was, depTz, "HH:mm"),
          actual: formatInTimeZone(now, depTz, "HH:mm"),
        };
        depSortFromTs = now;
      }
    }
  }
  if (arrWasRaw && arrNowRaw) {
    const was = parseTs(arrWasRaw, arrTz);
    const now = parseTs(arrNowRaw, arrTz);
    if (was && now) {
      arrTsDelayMs = now.getTime() - was.getTime();
      if (arrTsDelayMs >= 60000) {
        arrDisplay = {
          scheduled: formatInTimeZone(was, arrTz, "HH:mm"),
          actual: formatInTimeZone(now, arrTz, "HH:mm"),
        };
        arrSortFromTs = now;
      }
    }
  }

  if (depTsDelayMs >= 60000 || arrTsDelayMs >= 60000) {
    const delayMin = Math.max(
      Math.round(depTsDelayMs / 60000),
      Math.round(arrTsDelayMs / 60000)
    );
    const depSched =
      depDisplay?.scheduled ?? formatInTimeZone(new Date(input.depUtc), depTz, "HH:mm");
    const arrSched =
      arrDisplay?.scheduled ?? formatInTimeZone(new Date(input.arrUtc), arrTz, "HH:mm");
    const sortDepD = depSortFromTs ?? new Date(input.depUtc);
    const sortArrD = arrSortFromTs ?? new Date(input.arrUtc);
    return {
      label: "delayed",
      delay_minutes: delayMin,
      source_of_truth: depTsDelayMs >= 60000 ? "timestamp_dep" : "timestamp_arr",
      confidence: "medium",
      dep: depDisplay ?? { scheduled: depSched, actual: depSched },
      arr: arrDisplay ?? { scheduled: arrSched, actual: arrSched },
      sort_dep_utc: sortDepD.toISOString(),
      sort_arr_utc: sortArrD.toISOString(),
    };
  }

  // d. proven no-delay live evidence -> on_time (before provider text; timing overrides status)
  const hasDepEvidence = !!(depWasRaw && depNowRaw);
  const hasArrEvidence = !!(arrWasRaw && arrNowRaw);
  const depNoDelay = !hasDepEvidence || depTsDelayMs < 60000;
  const arrNoDelay = !hasArrEvidence || arrTsDelayMs < 60000;

  if ((hasDepEvidence || hasArrEvidence) && depNoDelay && arrNoDelay) {
    const depSched = formatInTimeZone(new Date(input.depUtc), depTz, "HH:mm");
    const arrSched = formatInTimeZone(new Date(input.arrUtc), arrTz, "HH:mm");
    const result: OperationalStatus = {
      label: "on_time",
      delay_minutes: null,
      source_of_truth: "proven_on_time",
      confidence: "medium",
      dep: { scheduled: depSched, actual: depSched },
      arr: { scheduled: arrSched, actual: arrSched },
      sort_dep_utc: input.depUtc,
      sort_arr_utc: input.arrUtc,
    };
    if (isAa1352SavClt) {
      console.log("[Commute Assist] AA1352 SAV→CLT deriveOperationalStatus", {
        input_status: input.status,
        dep_delay_min: input.dep_delay_min,
        arr_delay_min: input.arr_delay_min,
        timestamp_dep_delay_ms: depTsDelayMs,
        timestamp_arr_delay_ms: arrTsDelayMs,
        final_operationalStatus: result.label,
        source_of_truth: result.source_of_truth,
      });
    }
    return result;
  }

  // e. provider status text indicating delay/diversion -> delayed (only when no stronger timing evidence)
  if (statusIndicatesDelay(input.status)) {
    let depSched = formatInTimeZone(new Date(input.depUtc), depTz, "HH:mm");
    if (input.dep_scheduled_raw) {
      const p = parseTs(input.dep_scheduled_raw, depTz);
      if (p) depSched = formatInTimeZone(p, depTz, "HH:mm");
    }
    let arrSched = formatInTimeZone(new Date(input.arrUtc), arrTz, "HH:mm");
    let depSortD = new Date(input.depUtc);
    let arrSortD = new Date(input.arrUtc);
    if (input.arr_scheduled_raw) {
      const p = parseTs(input.arr_scheduled_raw, arrTz);
      if (p) {
        arrSched = formatInTimeZone(p, arrTz, "HH:mm");
        arrSortD = p;
      }
    }
    if (input.dep_scheduled_raw) {
      const p = parseTs(input.dep_scheduled_raw, depTz);
      if (p) {
        depSortD = p;
      }
    }
    const result: OperationalStatus = {
      label: "delayed",
      delay_minutes: null,
      source_of_truth: "provider_status",
      confidence: "medium",
      dep: { scheduled: depSched, actual: depSched },
      arr: { scheduled: arrSched, actual: arrSched },
      sort_dep_utc: depSortD.toISOString(),
      sort_arr_utc: arrSortD.toISOString(),
    };
    if (isAa1352SavClt) {
      console.log("[Commute Assist] AA1352 SAV→CLT deriveOperationalStatus", {
        input_status: input.status,
        dep_delay_min: input.dep_delay_min,
        arr_delay_min: input.arr_delay_min,
        timestamp_dep_delay_ms: depTsDelayMs,
        timestamp_arr_delay_ms: arrTsDelayMs,
        final_operationalStatus: result.label,
        source_of_truth: result.source_of_truth,
      });
    }
    return result;
  }

  // f. otherwise -> unknown
  const depSched = formatInTimeZone(new Date(input.depUtc), depTz, "HH:mm");
  const arrSched = formatInTimeZone(new Date(input.arrUtc), arrTz, "HH:mm");
  const result: OperationalStatus = {
    label: "unknown",
    delay_minutes: null,
    source_of_truth: "unknown_fallback",
    confidence: "low",
    dep: { scheduled: depSched, actual: depSched },
    arr: { scheduled: arrSched, actual: arrSched },
    sort_dep_utc: input.depUtc,
    sort_arr_utc: input.arrUtc,
  };
  if (isAa1352SavClt) {
    console.log("[Commute Assist] AA1352 SAV→CLT deriveOperationalStatus", {
      input_status: input.status,
      dep_delay_min: input.dep_delay_min,
      arr_delay_min: input.arr_delay_min,
      timestamp_dep_delay_ms: depTsDelayMs,
      timestamp_arr_delay_ms: arrTsDelayMs,
      final_operationalStatus: result.label,
      source_of_truth: result.source_of_truth,
    });
  }
  return result;
}

