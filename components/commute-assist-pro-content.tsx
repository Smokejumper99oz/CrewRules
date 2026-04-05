"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { subMinutes, subDays, addDays } from "date-fns";
import type { CommuteFlightOption } from "@/lib/commute/providers/types";
import { getCommuteFlights } from "@/app/frontier/pilots/portal/commute/actions";
import type { CommuteFlight } from "@/lib/aviationstack";
import type { ScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";
import type { Profile } from "@/lib/profile";
import { AirlineLogo } from "@/components/airline-logo";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";
import { computeDelayInfo, getDelayStatusLabel, type DelayInfo } from "@/lib/flight-delay";
import {
  operationalStatusToDisplayLabel,
  type OperationalStatus,
} from "@/lib/commute/operational-status-types";
import { deriveOperationalStatus } from "@/lib/commute/derive-operational-status";
import {
  COMMUTE_COVERAGE_UI_MESSAGE,
  COMMUTE_COVERAGE_UI_TITLE,
  type CommuteCoverageForClient,
} from "@/lib/commute/commute-coverage-public";

type CommuteFlightsOk = Extract<Awaited<ReturnType<typeof getCommuteFlights>>, { ok: true }>;

function pickCoverageFromCommuteResponse(res: CommuteFlightsOk): CommuteCoverageForClient | null {
  if (!res.coverageWarning) return null;
  return {
    coverageWarning: true,
    coverageWarningReasons: res.coverageWarningReasons ?? [],
    coverageWarningTitle: res.coverageWarningTitle ?? COMMUTE_COVERAGE_UI_TITLE,
    coverageWarningMessage: res.coverageWarningMessage ?? COMMUTE_COVERAGE_UI_MESSAGE,
  };
}

function mergeCoverageWarnings(
  a: CommuteCoverageForClient | null,
  b: CommuteCoverageForClient | null
): CommuteCoverageForClient | null {
  if (!a?.coverageWarning && !b?.coverageWarning) return null;
  if (!a?.coverageWarning) return b;
  if (!b?.coverageWarning) return a;
  return {
    coverageWarning: true,
    coverageWarningReasons: [...new Set([...a.coverageWarningReasons, ...b.coverageWarningReasons])],
    coverageWarningTitle: COMMUTE_COVERAGE_UI_TITLE,
    coverageWarningMessage: COMMUTE_COVERAGE_UI_MESSAGE,
  };
}

function fmtHM(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Format carrier + flight as "XX NNNN" with a space (e.g. B6 2751, F9 1234). */
function formatFlightLabel(carrier: string, flight: string | undefined): string {
  let c = (carrier ?? "").trim().toUpperCase();
  let raw = (flight ?? "").trim();
  // When carrier is empty but flight is combined (e.g. "B62751"), parse it
  if (!c && raw) {
    const m = raw.match(/^([A-Z]{2})(\d+)$/i);
    if (m) {
      c = m[1].toUpperCase();
      raw = m[2];
    }
  }
  const numPart = c
    ? raw.replace(new RegExp(`^${escapeRegExp(c)}`, "i"), "").trim() || raw
    : raw;
  return c && numPart ? `${c} ${numPart}` : c || numPart;
}

/** Strip carrier code from flight number (e.g. B62751 → 2751). */
function stripCarrierFromFlight(flightNumber: string, carrier: string): string {
  if (!carrier) return flightNumber;
  return flightNumber.replace(new RegExp(`^${escapeRegExp(carrier)}`, "i"), "").trim() || flightNumber;
}

function minutesBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

/** Flight duration in minutes from UTC timestamps. Always returns >= 0. */
function durationMinutesUtc(depUtc: string, arrUtc: string): number {
  return Math.max(0, minutesBetween(depUtc, arrUtc));
}

/** Round trip end/release time DOWN to nearest full hour in the given timezone. Returns ISO string. */
function roundDownToHour(iso: string, tz: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dateStr = formatInTimeZone(d, tz, "yyyy-MM-dd");
  const hourStr = formatInTimeZone(d, tz, "HH");
  return fromZonedTime(`${dateStr}T${hourStr}:00:00`, tz).toISOString();
}

function formatLastUpdate(iso: string | null, baseTz: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const ageMs = Date.now() - d.getTime();
  if (ageMs < 60_000) return "Updated just now";
  return `Last update: ${formatInTimeZone(d, baseTz, "HH:mm")} (LOCAL)`;
}

/** Return YYYY-MM-DD for the day before the given date string. */
function subtractDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return prev.toISOString().slice(0, 10);
}

function parseDutyStartAirport(route?: string | null): string | null {
  if (!route) return null;
  const m = route.toUpperCase().match(/([A-Z]{3})\s*(?:→|->|-)/);
  return m?.[1] ?? null;
}

type CommuteFlightOptionSorted = CommuteFlightOption & {
  sortDepUtc: string;
  sortArrUtc: string;
};

function isValidSortUtc(iso: string | undefined | null): boolean {
  return typeof iso === "string" && iso.length > 0 && !Number.isNaN(new Date(iso).getTime());
}

/**
 * Guarantees canonical sort instants (sort_dep_utc / sort_arr_utc) before any sort, filter, or connection math.
 * Missing or invalid fields trigger deriveOperationalStatus using the same inputs as the card.
 */
function ensureOptionSortFields(o: CommuteFlightOption): CommuteFlightOptionSorted {
  if (isValidSortUtc(o.sortDepUtc) && isValidSortUtc(o.sortArrUtc)) {
    return o as CommuteFlightOptionSorted;
  }
  const depTz = o.originTz ?? "UTC";
  const arrTz = o.destTz ?? "UTC";
  const derived = deriveOperationalStatus(
    {
      depUtc: o.depUtc,
      arrUtc: o.arrUtc,
      originTz: depTz,
      destTz: arrTz,
      dep_scheduled_raw: o.dep_scheduled_raw,
      dep_estimated_raw: o.dep_estimated_raw,
      dep_actual_raw: o.dep_actual_raw,
      arr_scheduled_raw: o.arr_scheduled_raw,
      arr_estimated_raw: o.arr_estimated_raw,
      arr_actual_raw: o.arr_actual_raw,
      dep_delay_min: o.dep_delay_min,
      arr_delay_min: o.arr_delay_min,
      status: o.status,
    },
    depTz,
    arrTz
  );
  return {
    ...o,
    sortDepUtc: derived.sort_dep_utc,
    sortArrUtc: derived.sort_arr_utc,
  };
}

/** UTC instants used for ordering; must match primary visible times on the card (not raw/scheduled-only when UI shows estimated/actual). */
function sortDepMs(o: CommuteFlightOption): number {
  return new Date(ensureOptionSortFields(o).sortDepUtc).getTime();
}
function sortArrMs(o: CommuteFlightOption): number {
  return new Date(ensureOptionSortFields(o).sortArrUtc).getTime();
}

/** Connection time using visible landing / departure instants (delayed estimates included). */
function connectionMinutesBetweenLegs(leg1: CommuteFlightOption, leg2: CommuteFlightOption): number {
  const L1 = ensureOptionSortFields(leg1);
  const L2 = ensureOptionSortFields(leg2);
  return durationMinutesUtc(L1.sortArrUtc, L2.sortDepUtc);
}

function sortFlights(
  list: CommuteFlightOption[],
  sortBy: "arrAsc" | "arrDesc" | "durAsc" | "durDesc"
): CommuteFlightOption[] {
  const ensured = list.map(ensureOptionSortFields);
  return [...ensured].sort((a, b) => {
    const arrA = new Date(a.sortArrUtc).getTime();
    const arrB = new Date(b.sortArrUtc).getTime();
    const depA = new Date(a.sortDepUtc).getTime();
    const depB = new Date(b.sortDepUtc).getTime();
    const durA = arrA - depA;
    const durB = arrB - depB;
    if (sortBy === "arrAsc") return arrA - arrB;
    if (sortBy === "arrDesc") return arrB - arrA;
    if (sortBy === "durAsc") return durA - durB;
    return durB - durA; // durDesc
  });
}

/** Shared conversion: CommuteFlight → CommuteFlightOption. Used by direct and 2-leg paths. */
function commuteFlightToOption(
  f: CommuteFlight,
  originTzVal: string,
  destTzVal: string,
  id: string,
  overrides?: { risk?: "recommended" | "risky" | "not_recommended"; reason?: string }
): CommuteFlightOptionSorted | null {
  const stripOffset = (s: string) => s.replace(/[+-]\d{2}:\d{2}$|Z$/i, "").trim();
  const depTz = f.origin_tz ?? originTzVal;
  const arrTz = f.dest_tz ?? destTzVal;
  const depRaw = f.departureTime ?? "";
  const arrRaw = f.arrivalTime ?? "";
  const depClean = stripOffset(depRaw);
  const arrClean = stripOffset(arrRaw);
  if (!depClean || !arrClean) return null;
  let depUtc: string;
  let arrUtc: string;
  const depIsUtc = depRaw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(depRaw);
  const arrIsUtc = arrRaw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(arrRaw);
  try {
    if (depIsUtc && arrIsUtc) {
      depUtc = new Date(depRaw).toISOString();
      arrUtc = new Date(arrRaw).toISOString();
    } else {
      depUtc = fromZonedTime(depClean, depTz).toISOString();
      arrUtc = fromZonedTime(arrClean, arrTz).toISOString();
    }
  } catch {
    return null;
  }
  // Never show arrival before departure. Fix arr = dep + duration instead of dropping.
  let depUtcDate = new Date(depUtc);
  let arrUtcDate = new Date(arrUtc);
  if (arrUtcDate.getTime() <= depUtcDate.getTime()) {
    const durMin = f.durationMinutes ?? 60;
    const fallbackDur = durMin >= 30 ? durMin : 60;
    arrUtc = new Date(depUtcDate.getTime() + fallbackDur * 60_000).toISOString();
    arrUtcDate = new Date(arrUtc);
  }
  // Debug: DL 1946 ATL-SJU commuteFlightToOption output (remove after root cause found)
  const isDl1946AtlSju =
    (f.origin === "ATL" || f.origin === "atl") &&
    (f.destination === "SJU" || f.destination === "sju") &&
    (f.carrier === "DL" || f.carrier === "dl") &&
    /1946/.test(f.flightNumber ?? "");
  if (isDl1946AtlSju && typeof window !== "undefined") {
    const durMin = Math.round((new Date(arrUtc).getTime() - new Date(depUtc).getTime()) / 60000);
    console.log("[Commute Assist] DL 1946 ATL→SJU commuteFlightToOption", {
      input: { departureTime: f.departureTime, arrivalTime: f.arrivalTime },
      output: { depUtc, arrUtc, durationMinutes: durMin },
    });
  }
  return ensureOptionSortFields({
    id,
    carrier: f.carrier,
    flight: stripCarrierFromFlight(f.flightNumber, f.carrier),
    depUtc,
    arrUtc,
    sortDepUtc: f.operationalStatus?.sort_dep_utc,
    sortArrUtc: f.operationalStatus?.sort_arr_utc,
    nonstop: true,
    risk: overrides?.risk ?? "recommended",
    reason: overrides?.reason ?? `Leg • ${fmtHM(f.durationMinutes)}`,
    originTz: depTz,
    destTz: arrTz,
    dep_scheduled_raw: f.dep_scheduled_raw,
    dep_estimated_raw: f.dep_estimated_raw,
    dep_actual_raw: f.dep_actual_raw,
    dep_delay_min: f.dep_delay_min,
    arr_scheduled_raw: f.arr_scheduled_raw,
    arr_estimated_raw: f.arr_estimated_raw,
    arr_actual_raw: f.arr_actual_raw,
    arr_delay_min: f.arr_delay_min,
    status: f.status,
    dep_gate: f.dep_gate,
    arr_gate: f.arr_gate,
    aircraft_type: f.aircraft_type,
    operationalStatus: f.operationalStatus,
  });
}

/** Convert raw commute flights to CommuteFlightOption[] for 2-leg legs. Uses shared converter. */
function convertRawFlightsToLegOptions(
  flights: CommuteFlight[],
  originTzVal: string,
  destTzVal: string,
  idPrefix: string
): CommuteFlightOptionSorted[] {
  const options: CommuteFlightOptionSorted[] = [];
  for (let i = 0; i < flights.length; i++) {
    const opt = commuteFlightToOption(flights[i], originTzVal, destTzVal, `${idPrefix}-${flights[i].flightNumber}-${flights[i].departureTime}-${i}`);
    if (opt) options.push(opt);
  }
  return options;
}

type Props = {
  event: { start_time: string; end_time?: string; report_time?: string | null; route?: string | null };
  label?: "on_duty" | "later_today" | "next_duty" | "post_duty_release";
  profile: NonNullable<Profile>;
  displaySettings: ScheduleDisplaySettings;
  tenant: string;
  portal: string;
  /** When set, use as duty date for to_base (dayPriorBase = displayDateStr - 1). */
  displayDateStr?: string | null;
  /** When true, show to_home (return when pairing ends); when false, show to_base (commute to duty). */
  isInPairing?: boolean;
  /** When set, overrides direction inferred from isInPairing / label. */
  commuteAssistDirection?: "to_home" | "to_base";
  /** Reserve: last-day window before scheduled end — show conditional commute messaging. */
  commuteAssistReserveEarlyReleaseWindow?: boolean;
  /** Overlapping reserve duty outside early-release window — skip flight API fetches. */
  commuteAssistSuppressFlightSearch?: boolean;
  /** When set (e.g. from legsToShow[0].origin), use as duty start airport for to_base. */
  dutyStartAirportOverride?: string | null;
  /** When set (e.g. from legsToShow[last].destination), use as duty end airport for to_home. */
  dutyEndAirportOverride?: string | null;
  /** When set (e.g. 05:15 when out of base = first leg dep - 45 min), use for arrive-by. */
  reportTimeOverride?: string | null;
};

/** 2-leg commute option: origin → stop → destination. */
type TwoLegOption = {
  routeKey: string;
  label: "home" | "alternate";
  origin: string;
  stop: string;
  destination: string;
  leg1: CommuteFlightOption;
  leg2: CommuteFlightOption;
  depUtc: string;
  arrUtc: string;
};

/** Max connection time (minutes) for 2-leg Cards display. Connections longer than this are suppressed. */
const TWO_LEG_MAX_CONNECTION_MINUTES = 240;
/** Max onward options to show per first leg (prefer shortest connection). */
const TWO_LEG_MAX_ONWARD_PER_LEG1 = 2;

/** Temporary: sanity check for 2-leg. Suppress broken itineraries until feature is rebuilt. */
function isTwoLegOptionSane(opt: TwoLegOption): boolean {
  const leg1Dep = sortDepMs(opt.leg1);
  const leg1Arr = sortArrMs(opt.leg1);
  const leg2Dep = sortDepMs(opt.leg2);
  const leg2Arr = sortArrMs(opt.leg2);
  if (leg1Arr <= leg1Dep) return false; // leg1: arrival before departure
  if (leg2Arr <= leg2Dep) return false; // leg2: arrival before departure
  if (leg2Dep < leg1Arr) return false;  // leg2 dep before leg1 arr (negative connection)
  const connectMin = connectionMinutesBetweenLegs(opt.leg1, opt.leg2);
  if (connectMin <= 0) return false;   // connection must be positive
  return true;
}

/** Filter 2-leg options for display: sanity check, cap connection time, keep best 1–2 onward per first leg. */
function filterTwoLegOptionsForDisplay(options: TwoLegOption[]): TwoLegOption[] {
  const withSortLegs = options.map((o) => {
    const leg1 = ensureOptionSortFields(o.leg1);
    const leg2 = ensureOptionSortFields(o.leg2);
    return {
      ...o,
      leg1,
      leg2,
      depUtc: leg1.sortDepUtc,
      arrUtc: leg2.sortArrUtc,
    };
  });
  const sane = withSortLegs.filter(isTwoLegOptionSane);
  const byLeg1 = new Map<string, TwoLegOption[]>();
  for (const opt of sane) {
    const connectMin = connectionMinutesBetweenLegs(opt.leg1, opt.leg2);
    if (connectMin > TWO_LEG_MAX_CONNECTION_MINUTES) continue;
    const key = opt.leg1.id;
    if (!byLeg1.has(key)) byLeg1.set(key, []);
    byLeg1.get(key)!.push(opt);
  }
  const result: TwoLegOption[] = [];
  for (const opts of byLeg1.values()) {
    opts.sort((a, b) => {
      const ca = connectionMinutesBetweenLegs(a.leg1, a.leg2);
      const cb = connectionMinutesBetweenLegs(b.leg1, b.leg2);
      return ca - cb;
    });
    result.push(...opts.slice(0, TWO_LEG_MAX_ONWARD_PER_LEG1));
  }
  return result.sort((a, b) => sortArrMs(a.leg2) - sortArrMs(b.leg2));
}

/** Dev-only integrity: Earliest-arrival order vs adjacent sortArrUtc (same source as sort + display). */
function collectFlightsIfArrAscMismatchDirect(
  options: CommuteFlightOption[]
): { flightNumber: string; displayedArrival: string }[] | null {
  if (options.length < 2) return null;
  for (let i = 1; i < options.length; i++) {
    if (sortArrMs(options[i]) < sortArrMs(options[i - 1])) {
      return options.map((o) => {
        const e = ensureOptionSortFields(o);
        return {
          flightNumber: formatFlightLabel(e.carrier, e.flight),
          displayedArrival: e.sortArrUtc,
        };
      });
    }
  }
  return null;
}

function collectFlightsIfArrAscMismatchTwoLeg(
  options: TwoLegOption[]
): { flightNumber: string; displayedArrival: string }[] | null {
  if (options.length < 2) return null;
  for (let i = 1; i < options.length; i++) {
    if (sortArrMs(options[i].leg2) < sortArrMs(options[i - 1].leg2)) {
      return options.map((o) => {
        const leg2 = ensureOptionSortFields(o.leg2);
        return {
          flightNumber: formatFlightLabel(leg2.carrier, leg2.flight),
          displayedArrival: leg2.sortArrUtc,
        };
      });
    }
  }
  return null;
}

const PAGE_SIZE = 5;

/** Client cache TTL: 15 minutes. Avoids API calls when navigating back to Dashboard. */
const COMMUTE_CACHE_TTL_MS = 15 * 60 * 1000;
const COMMUTE_CACHE_PREFIX = "crewrules_commute_";

/** Bump when Commute Assist logic changes (times, status derivation). Invalidates stale sessionStorage. */
const COMMUTE_CLIENT_CACHE_VERSION = 3;

function getCommuteCacheKey(origin: string, destination: string, date: string, direction: string): string {
  return `${COMMUTE_CACHE_PREFIX}${origin}_${destination}_${date}_${direction}`;
}

function getCommuteCache(key: string): {
  flights: CommuteFlight[];
  originTz: string;
  destTz: string;
  fetchedAt: string | null;
  notice: string | null;
  coverage: CommuteCoverageForClient | null;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const { flights, originTz, destTz, fetchedAt, notice, coverage, cachedAt, version } = parsed;
    if (version !== COMMUTE_CLIENT_CACHE_VERSION) return null;
    if (Date.now() - (cachedAt ?? 0) > COMMUTE_CACHE_TTL_MS) return null;
    const cov =
      coverage &&
      typeof coverage === "object" &&
      coverage.coverageWarning === true &&
      Array.isArray(coverage.coverageWarningReasons)
        ? (coverage as CommuteCoverageForClient)
        : null;
    return { flights, originTz, destTz, fetchedAt, notice, coverage: cov };
  } catch {
    return null;
  }
}

function setCommuteCache(
  key: string,
  data: {
    flights: CommuteFlight[];
    originTz: string;
    destTz: string;
    fetchedAt: string | null;
    notice: string | null;
    coverage: CommuteCoverageForClient | null;
  }
) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      key,
      JSON.stringify({ ...data, cachedAt: Date.now(), version: COMMUTE_CLIENT_CACHE_VERSION })
    );
  } catch {
    // ignore
  }
}

function clearCommuteCache(key: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Resolve display timezone; fallback to airport-based lookup when stored tz is UTC. */
function resolveDisplayTz(
  storedTz: string | undefined,
  fallbackTz: string,
  airportIata: string
): string {
  const tz = storedTz ?? fallbackTz;
  return tz === "UTC" ? getTimezoneFromAirport(airportIata) : tz;
}

const riskBorderStyles = {
  recommended: "border-l-4 border-l-emerald-500",
  risky: "border-l-4 border-l-amber-500",
  not_recommended: "border-l-4 border-l-red-500",
};

function getStatusBadgeClass(label: OperationalStatus["label"]): string {
  const base = "px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ";
  switch (label) {
    case "cancelled":
      return base + "bg-red-500/20 text-red-400 border border-red-500/40";
    case "delayed":
      return base + "bg-amber-500/20 text-amber-400 border border-amber-500/40";
    case "on_time":
      return base + "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30";
    case "unknown":
      return base + "bg-slate-500/20 text-slate-300 border border-slate-500/40";
    default:
      return base + "bg-slate-500/20 text-slate-300 border border-slate-500/40";
  }
}

/** Badge text for Commute Assist. Matches direct flights: "Delayed" (no +Xm); scheduled vs actual shown in TimeBlock. */
function getStatusLabelForDisplay(os: OperationalStatus | null, legacyDi: DelayInfo | null): string {
  if (os) return operationalStatusToDisplayLabel(os.label);
  return getDelayStatusLabel(legacyDi!);
}

/** Compact leg summary for 2-leg horizontal row. Uses operationalStatus when available, else legacy computeDelayInfo. */
function TwoLegCompactLeg({
  opt,
  origin,
  destination,
  originTz,
  destTz,
  isLastFlight,
}: {
  opt: CommuteFlightOption;
  origin: string;
  destination: string;
  originTz: string;
  destTz: string;
  isLastFlight?: boolean;
}) {
  const depUtc = opt.depUtc;
  const arrUtc = opt.arrUtc;
  if (new Date(arrUtc).getTime() <= new Date(depUtc).getTime()) return null;

  const depTz = resolveDisplayTz(opt.originTz, originTz, origin);
  const arrTz = resolveDisplayTz(opt.destTz, destTz, destination);
  const depSched = formatInTimeZone(new Date(depUtc), depTz, "HH:mm");
  const arrSched = formatInTimeZone(new Date(arrUtc), arrTz, "HH:mm");
  const durMin = durationMinutesUtc(depUtc, arrUtc);
  const durStr = fmtHM(durMin);
  const dep = new Date(depUtc);
  const arr = new Date(arrUtc);
  const dateStr = formatInTimeZone(dep, depTz, "EEE • MMMM d");
  const depDateStr = formatInTimeZone(dep, depTz, "yyyy-MM-dd");
  const arrDateStr = formatInTimeZone(arr, arrTz, "yyyy-MM-dd");
  const arrivesNextDay = arrDateStr > depDateStr;
  const flightLabel = formatFlightLabel(opt.carrier, opt.flight);

  const os = opt.operationalStatus;
  const legacyDi = !os ? computeDelayInfo(opt, depTz, arrTz) : null;
  const depDisplay = os?.dep
    ? { scheduled: os.dep.scheduled, actual: os.dep.actual !== os.dep.scheduled ? os.dep.actual : undefined }
    : { scheduled: depSched, actual: undefined as string | undefined };
  const arrDisplay = os?.arr
    ? { scheduled: os.arr.scheduled, actual: os.arr.actual !== os.arr.scheduled ? os.arr.actual : undefined }
    : { scheduled: arrSched, actual: undefined as string | undefined };
  const statusLabel = getStatusLabelForDisplay(os ?? null, legacyDi);
  const statusBadgeClass = os
    ? getStatusBadgeClass(os.label)
    : legacyDi!.cancelled
      ? getStatusBadgeClass("cancelled")
      : legacyDi!.dep || legacyDi!.arr
        ? getStatusBadgeClass("delayed")
        : getStatusBadgeClass("on_time");
  const isCancelled = os ? os.label === "cancelled" : legacyDi!.cancelled;
  const isDelayed = os ? os.label === "delayed" : !!(legacyDi!.dep || legacyDi!.arr);

  return (
    <div className={`flex-1 basis-0 min-w-0 rounded-lg border border-slate-700/60 bg-slate-900/40 pl-2.5 pr-2.5 py-2 ${riskBorderStyles[opt.risk]}`}>
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-400">{dateStr}</span>
        <span className={statusBadgeClass}>
          {statusLabel}
        </span>
      </div>
      <div className="flex items-baseline gap-2 mt-0.5">
        <div className="flex flex-col items-start">
          <TimeBlock scheduled={depDisplay.scheduled} actual={depDisplay.actual} isDelayed={isDelayed} isCancelled={isCancelled} className="text-xl" />
          {isLastFlight && (
            <span className="text-xs font-semibold text-amber-400/90 mt-0.5">Last Flight</span>
          )}
        </div>
        <span className="text-[11px] tabular-nums font-medium text-slate-300 bg-slate-800/50 border border-slate-700/40 px-1.5 py-0.5 rounded">
          {origin} → {destination}
        </span>
        <div className="flex flex-col items-end">
          <TimeBlock scheduled={arrDisplay.scheduled} actual={arrDisplay.actual} isDelayed={isDelayed} isCancelled={isCancelled} className="text-xl" />
          {arrivesNextDay && (
            <span className="text-xs font-semibold text-slate-300 mt-0.5">+1 day</span>
          )}
        </div>
      </div>
      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 flex-wrap">
        <AirlineLogo carrier={(opt.carrier || flightLabel.match(/^([A-Z0-9]{2})/)?.[1]) ?? ""} size={20} />
        <span className="text-slate-400 font-medium font-mono tabular-nums">{flightLabel}</span>
        {(opt.dep_gate || opt.arr_gate) && (
          <>
            <span className="text-slate-600">•</span>
            <span className="tabular-nums">
              {[opt.dep_gate && `DEP ${opt.dep_gate}`, opt.arr_gate && `ARR ${opt.arr_gate}`].filter(Boolean).join(" • ")}
            </span>
          </>
        )}
        <span className="text-slate-600">•</span>
        <span>Flight time {durStr}</span>
        {opt.aircraft_type && (
          <>
            <span className="text-slate-600">•</span>
            <span className="tabular-nums">{opt.aircraft_type}</span>
          </>
        )}
      </div>
    </div>
  );
}

function TimeBlock({
  scheduled,
  actual,
  isDelayed,
  isCancelled,
  className = "",
}: {
  scheduled: string;
  actual?: string;
  isDelayed: boolean;
  isCancelled: boolean;
  className?: string;
}) {
  const showDelay = isDelayed && actual && actual !== scheduled;
  const showCancel = isCancelled;

  if (showCancel) {
    return (
      <span className={`tabular-nums ${className}`}>
        <span className="line-through text-red-400/90">{scheduled}</span>
      </span>
    );
  }
  if (showDelay) {
    return (
      <span className={`flex flex-col items-baseline gap-0 ${className}`}>
        <span className="line-through text-amber-400/60 opacity-70 tabular-nums text-[0.85em]">{scheduled}</span>
        <span className="text-amber-300 font-bold tracking-wide tabular-nums">{actual}</span>
      </span>
    );
  }
  return <span className={`font-bold tabular-nums text-slate-200 ${className}`}>{scheduled}</span>;
}

function CommuteFlightCard({
  opt,
  baseTz,
  origin,
  destination,
  originTz,
  destTz,
  isLastFlight,
  nested,
}: {
  opt: CommuteFlightOption;
  baseTz: string;
  origin: string;
  destination: string;
  originTz: string;
  destTz: string;
  isLastFlight?: boolean;
  nested?: boolean;
}) {
  const depTz = resolveDisplayTz(opt.originTz, originTz, origin);
  const arrTz = resolveDisplayTz(opt.destTz, destTz, destination);
  const dep = new Date(opt.depUtc);
  const arr = new Date(opt.arrUtc);
  const dateStr = formatInTimeZone(dep, depTz, "EEE • MMMM d");
  const depSched = formatInTimeZone(dep, depTz, "HH:mm");
  const arrSched = formatInTimeZone(arr, arrTz, "HH:mm");
  const durMin = durationMinutesUtc(opt.depUtc, opt.arrUtc);
  const durStr = fmtHM(durMin);
  const flightLabel = formatFlightLabel(opt.carrier, opt.flight);
  const os = opt.operationalStatus;
  const legacyDi = !os ? computeDelayInfo(opt, depTz, arrTz) : null;
  const depDisplay = os?.dep
    ? { scheduled: os.dep.scheduled, actual: os.dep.actual !== os.dep.scheduled ? os.dep.actual : undefined }
    : { scheduled: depSched, actual: undefined as string | undefined };
  const arrDisplay = os?.arr
    ? { scheduled: os.arr.scheduled, actual: os.arr.actual !== os.arr.scheduled ? os.arr.actual : undefined }
    : { scheduled: arrSched, actual: undefined as string | undefined };
  const statusLabel = getStatusLabelForDisplay(os ?? null, legacyDi);
  const statusBadgeClass = os
    ? getStatusBadgeClass(os.label)
    : legacyDi!.cancelled
      ? getStatusBadgeClass("cancelled")
      : legacyDi!.dep || legacyDi!.arr
        ? getStatusBadgeClass("delayed")
        : getStatusBadgeClass("on_time");
  const isCancelled = os ? os.label === "cancelled" : legacyDi!.cancelled;
  const isDelayed = os ? os.label === "delayed" : !!(legacyDi!.dep || legacyDi!.arr);
  const depDateStr = formatInTimeZone(dep, depTz, "yyyy-MM-dd");
  const arrDateStr = formatInTimeZone(arr, arrTz, "yyyy-MM-dd");
  const arrivesNextDay = arrDateStr > depDateStr;

  return (
    <div
      className={
        nested
          ? `pl-3 pr-3 py-2 ${riskBorderStyles[opt.risk]}`
          : `rounded-lg border border-slate-700/60 bg-slate-900/40 pl-3 pr-3 py-2.5 ${riskBorderStyles[opt.risk]}`
      }
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-400">{dateStr}</span>
        <span className={statusBadgeClass}>
          {statusLabel}
        </span>
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <div className="flex flex-col items-start">
          <TimeBlock
            scheduled={depDisplay.scheduled}
            actual={depDisplay.actual}
            isDelayed={isDelayed}
            isCancelled={isCancelled}
            className="text-2xl"
          />
          {isLastFlight && (
            <span className="text-xs font-semibold text-amber-400/90 mt-0.5">Last Flight</span>
          )}
        </div>
        <span className="text-[11px] tabular-nums font-medium text-slate-300 bg-slate-800/50 border border-slate-700/40 px-1.5 py-0.5 rounded">
          {origin} → {destination}
        </span>
        <div className="flex flex-col items-end">
          <TimeBlock
            scheduled={arrDisplay.scheduled}
            actual={arrDisplay.actual}
            isDelayed={isDelayed}
            isCancelled={isCancelled}
            className="text-2xl"
          />
          {arrivesNextDay && (
            <span className="text-xs font-semibold text-slate-300 mt-0.5">+1 day</span>
          )}
        </div>
      </div>
      <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
        <AirlineLogo carrier={(opt.carrier || flightLabel.match(/^([A-Z0-9]{2})/)?.[1]) ?? ""} size={24} />
        <span className="text-slate-300 font-medium font-mono tabular-nums">{flightLabel}</span>
        {isCancelled && (
          <span className="ml-1 px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold text-[10px] tracking-wide uppercase">
            Cancelled
          </span>
        )}
        {(opt.dep_gate || opt.arr_gate) && (
          <>
            <span className="text-slate-600">•</span>
            <span className="tabular-nums">
              {[opt.dep_gate && `DEP ${opt.dep_gate}`, opt.arr_gate && `ARR ${opt.arr_gate}`].filter(Boolean).join(" • ")}
            </span>
          </>
        )}
        <span className="text-slate-600">•</span>
        <span>Flight time {durStr}</span>
        {opt.aircraft_type && (
          <>
            <span className="text-slate-600">•</span>
            <span className="tabular-nums">{opt.aircraft_type}</span>
          </>
        )}
      </div>
    </div>
  );
}

function CommuteFlightRow({
  opt,
  baseTz,
  origin,
  destination,
  originTz,
  destTz,
  isLastFlight,
}: {
  opt: CommuteFlightOption;
  baseTz: string;
  origin: string;
  destination: string;
  originTz: string;
  destTz: string;
  isLastFlight?: boolean;
}) {
  const depTz = resolveDisplayTz(opt.originTz, originTz, origin);
  const arrTz = resolveDisplayTz(opt.destTz, destTz, destination);
  const dep = new Date(opt.depUtc);
  const arr = new Date(opt.arrUtc);
  const dateStr = formatInTimeZone(dep, depTz, "EEE • MMMM d");
  const depSched = formatInTimeZone(dep, depTz, "HH:mm");
  const arrSched = formatInTimeZone(arr, arrTz, "HH:mm");
  const durMin = durationMinutesUtc(opt.depUtc, opt.arrUtc);
  const durStr = fmtHM(durMin);
  const flightLabel = formatFlightLabel(opt.carrier, opt.flight);
  const os = opt.operationalStatus;
  const legacyDi = !os ? computeDelayInfo(opt, depTz, arrTz) : null;
  const depDisplay = os?.dep
    ? { scheduled: os.dep.scheduled, actual: os.dep.actual !== os.dep.scheduled ? os.dep.actual : undefined }
    : { scheduled: depSched, actual: undefined as string | undefined };
  const arrDisplay = os?.arr
    ? { scheduled: os.arr.scheduled, actual: os.arr.actual !== os.arr.scheduled ? os.arr.actual : undefined }
    : { scheduled: arrSched, actual: undefined as string | undefined };
  const statusLabel = getStatusLabelForDisplay(os ?? null, legacyDi);
  const statusBadgeClass = os
    ? getStatusBadgeClass(os.label)
    : legacyDi!.cancelled
      ? getStatusBadgeClass("cancelled")
      : legacyDi!.dep || legacyDi!.arr
        ? getStatusBadgeClass("delayed")
        : getStatusBadgeClass("on_time");
  const isCancelled = os ? os.label === "cancelled" : legacyDi!.cancelled;
  const isDelayed = os ? os.label === "delayed" : !!(legacyDi!.dep || legacyDi!.arr);
  const depDateStr = formatInTimeZone(dep, depTz, "yyyy-MM-dd");
  const arrDateStr = formatInTimeZone(arr, arrTz, "yyyy-MM-dd");
  const arrivesNextDay = arrDateStr > depDateStr;

  const carrierForLogo = (opt.carrier || flightLabel.match(/^([A-Z0-9]{2})/)?.[1]) ?? "";
  const flightLine = (
    <>
      <AirlineLogo carrier={carrierForLogo} size={20} />
      <span className="font-mono tabular-nums font-medium text-slate-300">{flightLabel}</span>
      {isCancelled && <><span className="text-slate-500"> </span><span className="text-red-400 font-semibold">Cancelled</span></>}
    </>
  );

  const statusBadge = (
    <span className={statusBadgeClass}>
      {statusLabel}
    </span>
  );

  const routePill = (
    <span className="text-[11px] tabular-nums font-medium text-slate-300 bg-slate-800/50 border border-slate-700/40 px-1.5 py-0.5 rounded">
      {origin} → {destination}
    </span>
  );

  return (
    <div
      className={`rounded border border-slate-700/60 bg-slate-900/40 pl-3 pr-3 py-2 ${riskBorderStyles[opt.risk]}`}
    >
      {/* Mobile: Row 1 — DEP, route, ARR; Row 2 — date, status, dur, flight */}
      <div className="md:hidden">
        <div className="grid grid-cols-[4rem_auto_4rem] gap-2 items-center">
          <div className="flex flex-col items-start">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">DEP</span>
            <TimeBlock
              scheduled={depDisplay.scheduled}
              actual={depDisplay.actual}
              isDelayed={isDelayed}
              isCancelled={isCancelled}
              className="text-xl"
            />
            {isLastFlight && (
              <span className="text-xs font-semibold text-amber-400/90 mt-0.5">Last Flight</span>
            )}
          </div>
          <div className="flex justify-center">{routePill}</div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">ARR</span>
            <TimeBlock
              scheduled={arrDisplay.scheduled}
              actual={arrDisplay.actual}
              isDelayed={isDelayed}
              isCancelled={isCancelled}
              className="text-xl"
            />
            {arrivesNextDay && (
              <span className="text-xs font-semibold text-slate-300 mt-0.5">+1 day</span>
            )}
          </div>
        </div>
        <div className="text-sm font-semibold text-slate-400 mt-1 flex flex-wrap items-center gap-1.5">
          <span>{dateStr}</span>
          {statusBadge}
          <span className="font-normal text-slate-500">
            • Flight time {durStr}
            {opt.aircraft_type && <> • {opt.aircraft_type}</>}
            {(opt.dep_gate || opt.arr_gate) && (
              <> • {[opt.dep_gate && `DEP ${opt.dep_gate}`, opt.arr_gate && `ARR ${opt.arr_gate}`].filter(Boolean).join(" • ")}</>
            )}
            {" • "}{flightLine}
          </span>
        </div>
      </div>
      {/* Desktop: date+status left | DEP route ARR grid (aligned) | duration+flight right */}
      <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-slate-400 text-sm font-semibold shrink-0">{dateStr}</span>
          {statusBadge}
        </div>
        <div className="grid grid-cols-[5rem_6.5rem_5rem] gap-3 items-center justify-items-center">
          <div className="flex flex-col items-start w-full min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">DEP</span>
            <TimeBlock
              scheduled={depDisplay.scheduled}
              actual={depDisplay.actual}
              isDelayed={isDelayed}
              isCancelled={isCancelled}
              className="text-lg font-semibold"
            />
            {isLastFlight && (
              <span className="text-xs font-semibold text-amber-400/90 mt-0.5">Last Flight</span>
            )}
          </div>
          <div className="flex justify-center">{routePill}</div>
          <div className="flex flex-col items-end w-full min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">ARR</span>
            <TimeBlock
              scheduled={arrDisplay.scheduled}
              actual={arrDisplay.actual}
              isDelayed={isDelayed}
              isCancelled={isCancelled}
              className="text-lg font-semibold"
            />
            {arrivesNextDay && (
              <span className="text-xs font-semibold text-slate-300 mt-0.5">+1 day</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 min-w-0 justify-end">
          <span className="text-slate-500 text-xs shrink-0">Flight time {durStr}</span>
          {opt.aircraft_type && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-slate-500 text-xs tabular-nums shrink-0">{opt.aircraft_type}</span>
            </>
          )}
          {(opt.dep_gate || opt.arr_gate) && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-slate-500 text-xs tabular-nums shrink-0">
                {[opt.dep_gate && `DEP ${opt.dep_gate}`, opt.arr_gate && `ARR ${opt.arr_gate}`].filter(Boolean).join(" • ")}
              </span>
            </>
          )}
          <span className="text-slate-500 text-xs flex items-center gap-1 shrink-0">{flightLine}</span>
        </div>
      </div>
    </div>
  );
}

export function CommuteAssistProContent({
  event,
  label,
  profile,
  displaySettings,
  tenant,
  portal,
  displayDateStr,
  isInPairing,
  commuteAssistDirection,
  commuteAssistReserveEarlyReleaseWindow,
  commuteAssistSuppressFlightSearch,
  dutyStartAirportOverride,
  dutyEndAirportOverride,
  reportTimeOverride,
}: Props) {
  const [commuteError, setCommuteError] = useState<string | null>(null);
  const [commuteGroups, setCommuteGroups] = useState<Record<"home" | "alternate", CommuteFlightOption[]>>({
    home: [],
    alternate: [],
  });
  const [commuteMeta, setCommuteMeta] = useState<{
    showInfo: boolean;
    arriveByFormatted: string;
    dutyOk: boolean;
  } | null>(null);
  const [source, setSource] = useState<"live" | "scheduled" | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [, setLastUpdateTick] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  /** Merged across home/alternate routes: subtle coverage sanity banner only. */
  const [commuteCoverageBanner, setCommuteCoverageBanner] = useState<CommuteCoverageForClient | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [homePage, setHomePage] = useState(1);
  const [alternatePage, setAlternatePage] = useState(1);
  const [twoLegPage, setTwoLegPage] = useState(1);
  const cardsTopRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"cards" | "board">("cards");
  const [sortBy, setSortBy] = useState<"arrAsc" | "arrDesc" | "durAsc" | "durDesc">("arrAsc");
  const [originTz, setOriginTz] = useState<string>("UTC");
  const [destTz, setDestTz] = useState<string>("UTC");
  const [twoLegOptions, setTwoLegOptions] = useState<TwoLegOption[]>([]);
  /** 2-leg first-leg only: flights from home/alternate to commute airports. Key = "home-ATL", "home-CLT", etc. */
  const [twoLegFirstLegGroups, setTwoLegFirstLegGroups] = useState<Record<string, CommuteFlightOption[]>>({});
  /** 2-leg first-leg full: leg1 + leg2 to crew base. Used when only stop1 is set. */
  const [twoLegFirstLegOptions, setTwoLegFirstLegOptions] = useState<TwoLegOption[]>([]);
  const [twoLegFirstLegPage, setTwoLegFirstLegPage] = useState(1);

  const baseTz = displaySettings.baseTimezone;
  const arrivalBuffer = profile?.commute_arrival_buffer_minutes ?? 60;

  const homeAirport = profile?.home_airport?.trim();
  const alternateHomeAirport = profile?.alternate_home_airport?.trim();
  const baseAirport = profile?.base_airport?.trim();
  const commuteTwoLegEnabled = profile?.commute_two_leg_enabled ?? false;
  const commuteTwoLegStop1 = profile?.commute_two_leg_stop_1?.trim() ?? "";
  const commuteTwoLegStop2 = profile?.commute_two_leg_stop_2?.trim() ?? "";
  const hasValidHome = !!homeAirport && homeAirport.length === 3;
  const hasValidBase = !!baseAirport && baseAirport.length === 3;
  const canUseCommute = hasValidHome && hasValidBase;

  const direction = commuteAssistDirection
    ? commuteAssistDirection
    : isInPairing !== undefined
      ? (isInPairing ? "to_home" : "to_base")
      : (label === "on_duty" ? "to_home" : "to_base");
  const dutyStart = new Date(event.start_time);
  const dutyOk = !Number.isNaN(dutyStart.getTime());

  // Compute duty date/time in base timezone; use report_time if available.
  const dutyDateTime = (() => {
    if (!dutyOk) return new Date();
    const reportTime = reportTimeOverride?.trim()
      ? (reportTimeOverride.length === 5 ? `${reportTimeOverride}:00` : reportTimeOverride)
      : event.report_time?.trim()
        ? (event.report_time.length === 5 ? `${event.report_time}:00` : event.report_time)
        : null;
    if (reportTime) {
      const reportDateStr =
        displayDateStr?.trim() ??
        (() => {
          const startDateStr = formatInTimeZone(dutyStart, baseTz, "yyyy-MM-dd");
          const startHour = parseInt(formatInTimeZone(dutyStart, baseTz, "HH"), 10);
          const reportHour = parseInt(reportTime.slice(0, 2), 10) || 0;
          return startHour >= 18 && reportHour < 12
            ? formatInTimeZone(addDays(dutyStart, 1), baseTz, "yyyy-MM-dd")
            : startDateStr;
        })();
      return fromZonedTime(`${reportDateStr}T${reportTime}`, baseTz);
    }
    return dutyStart;
  })();
  const dutyDateBase = formatInTimeZone(dutyDateTime, baseTz, "yyyy-MM-dd");
  const arriveBy = dutyOk ? subMinutes(dutyDateTime, arrivalBuffer) : null;

  // Search date for to_base: derived from user's arrival cutoff (report datetime - buffer), not a fixed rule.
  // If cutoff falls on report day → same-day flights; if on prior calendar day → day-prior flights.
  const toBaseCommuteSearchDate =
    dutyOk && arriveBy
      ? formatInTimeZone(arriveBy, baseTz, "yyyy-MM-dd")
      : new Date().toISOString().slice(0, 10);

  const [commuteExpiryTick, setCommuteExpiryTick] = useState(0);
  const arriveByTimeForExpiry = arriveBy?.getTime();
  useEffect(() => {
    if (direction !== "to_base" || arriveByTimeForExpiry == null || Number.isNaN(arriveByTimeForExpiry)) return;
    const id = window.setInterval(() => setCommuteExpiryTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [direction, arriveByTimeForExpiry]);

  const isCommuteWindowExpired = useMemo(
    () =>
      direction === "to_base" &&
      arriveByTimeForExpiry != null &&
      !Number.isNaN(arriveByTimeForExpiry) &&
      Date.now() > arriveByTimeForExpiry,
    [direction, arriveByTimeForExpiry, commuteExpiryTick]
  );

  const dutyStartAirport = dutyStartAirportOverride?.trim() || parseDutyStartAirport(event.route);
  const dutyEndAirport = (dutyEndAirportOverride?.trim() || baseAirport) ?? null;
  const dutyEndTime = event.end_time ? new Date(event.end_time) : null;
  const dutyEndDateBase = dutyEndTime && !Number.isNaN(dutyEndTime.getTime())
    ? formatInTimeZone(dutyEndTime, baseTz, "yyyy-MM-dd")
    : null;

  /** Routes to search: [{ origin, destination, label }]. label = "home" | "alternate" */
  /** When 2-leg enabled, skip direct routes—user knows there are none; loadTwoLegFlights handles first leg. */
  const routes = useMemo(() => {
    if (commuteTwoLegEnabled) return [];
    const commuteDate =
      direction === "to_base"
        ? toBaseCommuteSearchDate
        : dutyEndDateBase ?? new Date().toISOString().slice(0, 10);

    if (direction === "to_base") {
      const dest = (dutyStartAirport ?? baseAirport)?.toUpperCase() ?? "";
      const result: { origin: string; destination: string; label: "home" | "alternate"; commuteDate: string }[] = [
        { origin: homeAirport?.toUpperCase() ?? "", destination: dest, label: "home", commuteDate },
      ];
      if (alternateHomeAirport?.length === 3) {
        result.push({ origin: alternateHomeAirport.toUpperCase(), destination: dest, label: "alternate", commuteDate });
      }
      return result;
    }
    const orig = (dutyEndAirport ?? baseAirport ?? "").toUpperCase();
    const result: { origin: string; destination: string; label: "home" | "alternate"; commuteDate: string }[] = [
      { origin: orig, destination: homeAirport?.toUpperCase() ?? "", label: "home", commuteDate },
    ];
    if (alternateHomeAirport?.length === 3) {
      result.push({ origin: orig, destination: alternateHomeAirport.toUpperCase(), label: "alternate", commuteDate });
    }
    return result;
  }, [
    commuteTwoLegEnabled,
    direction,
    homeAirport,
    alternateHomeAirport,
    baseAirport,
    dutyStartAirport,
    dutyEndAirport,
    toBaseCommuteSearchDate,
    dutyEndDateBase,
  ]);

  /** 2-leg first-leg routes only: Home/Alternate → Commute Airport 1/2. Uses duty date (day of duty). Same DB as direct. */
  const twoLegFirstLegRoutes = useMemo(() => {
    if (!commuteTwoLegEnabled) return [];
    const stops = [commuteTwoLegStop1, commuteTwoLegStop2]
      .map((s) => s?.trim().toUpperCase())
      .filter((s) => s && s.length === 3);
    const uniqueStops = [...new Set(stops)];
    if (uniqueStops.length === 0) return [];

    const commuteDate =
      direction === "to_base"
        ? dutyDateBase
        : dutyEndDateBase ?? new Date().toISOString().slice(0, 10);

    const result: { origin: string; destination: string; routeKey: string; commuteDate: string }[] = [];
    const home = homeAirport?.trim().toUpperCase();
    const alternate = alternateHomeAirport?.trim().toUpperCase();
    for (const stop of uniqueStops) {
      if (home && home.length === 3) {
        result.push({ origin: home, destination: stop, routeKey: `home-${stop}`, commuteDate });
      }
      if (alternate && alternate.length === 3) {
        result.push({ origin: alternate, destination: stop, routeKey: `alternate-${stop}`, commuteDate });
      }
    }
    return result;
  }, [
    commuteTwoLegEnabled,
    commuteTwoLegStop1,
    commuteTwoLegStop2,
    homeAirport,
    alternateHomeAirport,
    direction,
    dutyDateBase,
    dutyEndDateBase,
  ]);

  /** 2-leg routes for full search: [{ origin, stop, destination, label, commuteDate }]. When 2nd commute airport is blank, return [] so we show first-leg only (Home→1st Commute Airport) via twoLegFirstLegRoutes. */
  const twoLegRoutes = useMemo(() => {
    if (!commuteTwoLegEnabled) return [];
    if (!commuteTwoLegStop2?.trim()) return [];
    const stops = [commuteTwoLegStop1, commuteTwoLegStop2]
      .map((s) => s?.trim().toUpperCase())
      .filter((s) => s && s.length === 3);
    const uniqueStops = [...new Set(stops)];
    if (uniqueStops.length === 0) return [];

    const commuteDate =
      direction === "to_base"
        ? toBaseCommuteSearchDate
        : dutyEndDateBase ?? new Date().toISOString().slice(0, 10);

    if (direction === "to_base") {
      const dest = (dutyStartAirport ?? baseAirport)?.toUpperCase() ?? "";
      if (!dest || dest.length !== 3) return [];
      const result: { origin: string; stop: string; destination: string; label: "home" | "alternate"; commuteDate: string }[] = [];
      const home = homeAirport?.trim().toUpperCase();
      const alternate = alternateHomeAirport?.trim().toUpperCase();
      for (const stop of uniqueStops) {
        if (home && home.length === 3) {
          result.push({ origin: home, stop, destination: dest, label: "home", commuteDate });
        }
        if (alternate && alternate.length === 3) {
          result.push({ origin: alternate, stop, destination: dest, label: "alternate", commuteDate });
        }
      }
      return result;
    }
    const orig = (dutyEndAirport ?? baseAirport ?? "").toUpperCase();
    if (!orig || orig.length !== 3) return [];
    const result: { origin: string; stop: string; destination: string; label: "home" | "alternate"; commuteDate: string }[] = [];
    const home = homeAirport?.trim().toUpperCase();
    const alternate = alternateHomeAirport?.trim().toUpperCase();
    for (const stop of uniqueStops) {
      if (home && home.length === 3 && stop !== home && stop !== orig) {
        result.push({ origin: orig, stop, destination: home, label: "home", commuteDate });
      }
      if (alternate && alternate.length === 3 && stop !== alternate && stop !== orig) {
        result.push({ origin: orig, stop, destination: alternate, label: "alternate", commuteDate });
      }
    }
    return result;
  }, [
    direction,
    toBaseCommuteSearchDate,
    dutyEndDateBase,
    homeAirport,
    alternateHomeAirport,
    dutyStartAirport,
    dutyEndAirport,
    baseAirport,
    commuteTwoLegEnabled,
    commuteTwoLegStop1,
    commuteTwoLegStop2,
  ]);

  const noCommuteNeeded =
    direction === "to_base" &&
    !!homeAirport &&
    !!dutyStartAirport &&
    dutyStartAirport.toUpperCase() === homeAirport.toUpperCase();

  /** Apply flights + metadata to state. Reused for API response and sessionStorage restore. */
  const applyFlightsToState = useCallback(
    (
      flights: CommuteFlight[],
      originTzVal: string,
      destTzVal: string,
      fetchedAtVal: string | null,
      noticeVal: string | null,
      destinationLabel: "home" | "alternate"
    ) => {
      const dutyStart = new Date(event.start_time);
      const dutyOkLocal = !Number.isNaN(dutyStart.getTime());
      const dutyDateBaseLocal = formatInTimeZone(dutyStart, baseTz, "yyyy-MM-dd");
      let reportAtIso: string;
      if (dutyOkLocal && event.report_time?.trim()) {
        const startDateStr = formatInTimeZone(dutyStart, baseTz, "yyyy-MM-dd");
        const startHour = parseInt(formatInTimeZone(dutyStart, baseTz, "HH"), 10);
        const reportTime = event.report_time.length === 5 ? `${event.report_time}:00` : event.report_time;
        const reportHour = parseInt(reportTime.slice(0, 2), 10) || 0;
        const reportDateStr =
          startHour >= 18 && reportHour < 12
            ? formatInTimeZone(addDays(dutyStart, 1), baseTz, "yyyy-MM-dd")
            : startDateStr;
        reportAtIso = fromZonedTime(`${reportDateStr}T${reportTime}`, baseTz).toISOString();
      } else {
        reportAtIso = dutyOkLocal ? dutyStart.toISOString() : `${dutyDateBaseLocal}T12:00:00Z`;
      }
      const isReturn = direction === "to_home";
      const releaseEarliestDepIso =
        isReturn && event.end_time
          ? roundDownToHour(event.end_time, baseTz)
          : null;
      const options: CommuteFlightOption[] = [];
      for (let i = 0; i < flights.length; i++) {
        const f = flights[i];
        const baseOpt = commuteFlightToOption(f, originTzVal, destTzVal, `${destinationLabel}-${f.flightNumber}-${f.departureTime}-${i}`);
        if (!baseOpt) continue;
        if (releaseEarliestDepIso && baseOpt.sortDepUtc < releaseEarliestDepIso) continue;
        let risk: "recommended" | "risky" | "not_recommended" = "recommended";
        let reason = "";
        if (isReturn) {
          reason = `Return home • ${fmtHM(f.durationMinutes)}`;
        } else {
          const bufferMin = minutesBetween(baseOpt.sortArrUtc, reportAtIso);
          if (bufferMin < arrivalBuffer) {
            risk = "not_recommended";
            reason = `Arrives after cutoff (${bufferMin}m < ${arrivalBuffer}m)`;
          } else if (bufferMin < arrivalBuffer + 60) {
            risk = "risky";
            reason = `Meets cutoff but tight (${bufferMin}m)`;
          } else {
            reason = `Good buffer (${bufferMin}m)`;
          }
          reason = `${reason} • ${fmtHM(f.durationMinutes)}`;
        }
        options.push({ ...baseOpt, risk, reason });
      }
      const hasLiveTiming = options.some(
        (o) => o.arr_estimated_raw || o.arr_actual_raw || o.dep_estimated_raw || o.dep_actual_raw
      );
      const arriveByFormatted = dutyOkLocal ? formatInTimeZone(subMinutes(dutyStart, arrivalBuffer), baseTz, "HH:mm") : "";
      setOriginTz((prev) => (prev === "UTC" ? originTzVal : prev));
      setDestTz((prev) => (prev === "UTC" ? destTzVal : prev));
      setSource((prev) => (hasLiveTiming ? "live" : prev ?? "scheduled"));
      setLastFetchedAt((prev) => fetchedAtVal ?? prev);
      setCommuteGroups((prev) => ({ ...prev, [destinationLabel]: options }));
      setCommuteMeta({ showInfo: dutyOk, arriveByFormatted, dutyOk });
      setNotice((prev) => noticeVal ?? prev ?? null);
      setHomePage(1);
      setAlternatePage(1);
    },
    [direction, dutyOk, event.start_time, event.end_time, event.report_time, baseTz, arrivalBuffer]
  );

  const loadFlights = useCallback(
    async (opts?: { forceRefresh?: boolean }) => {
      if (!canUseCommute || routes.length === 0) return null;

      if (process.env.NODE_ENV === "development") {
        for (const r of routes) {
          const tpaFallback =
            (direction === "to_base" && r.origin === "TPA" && homeAirport?.toUpperCase() !== "TPA") ||
            (direction === "to_home" && r.destination === "TPA" && homeAirport?.toUpperCase() !== "TPA");
          const sjuFallback =
            direction === "to_home" &&
            r.origin === "SJU" &&
            (dutyEndAirport ?? baseAirport)?.toUpperCase() !== "SJU";
          if (tpaFallback || sjuFallback) {
            throw new Error("Commute Assist: TPA/SJU must not be used as fallbacks. Use profile.home_airport and profile.base_airport only.");
          }
        }
      }

      try {
        setCommuteError(null);
        setNotice(null);
        setCommuteCoverageBanner(null);
        if (opts?.forceRefresh) {
          setRefreshing(true);
          setCommuteGroups({ home: [], alternate: [] });
        }

        type FetchLegCoverage = {
          flights: CommuteFlight[] | null;
          coverage: CommuteCoverageForClient | null;
        };
        const fetchOne = async (route: (typeof routes)[0]): Promise<FetchLegCoverage> => {
          const cacheKey = getCommuteCacheKey(route.origin, route.destination, route.commuteDate, direction);
          if (!opts?.forceRefresh) {
            const cached = getCommuteCache(cacheKey);
            if (cached) {
              if (route.origin === "TPA" && route.destination === "SJU") {
                console.log("[Commute Assist] TPA→SJU from sessionStorage", {
                  source: "sessionStorage",
                  flightCount: cached.flights?.length ?? 0,
                  first3: cached.flights?.slice(0, 3).map((f: CommuteFlight) => ({ flightNumber: f.flightNumber, dep: f.departureTime, arr: f.arrivalTime })),
                });
              }
              applyFlightsToState(cached.flights, cached.originTz, cached.destTz, cached.fetchedAt, cached.notice, route.label);
              return { flights: cached.flights, coverage: cached.coverage };
            }
          }
          const res = await getCommuteFlights({
            origin: route.origin,
            destination: route.destination,
            date: route.commuteDate,
            forceRefresh: opts?.forceRefresh ?? false,
          });
          if (res.ok) {
            if (route.origin === "TPA" && route.destination === "SJU") {
              console.log("[Commute Assist] TPA→SJU from API", {
                source: res.source,
                flightCount: res.flights?.length ?? 0,
                first3: res.flights?.slice(0, 3).map((f: CommuteFlight) => ({ flightNumber: f.flightNumber, dep: f.departureTime, arr: f.arrivalTime })),
              });
            }
            const displayFetchedAt = opts?.forceRefresh ? new Date().toISOString() : (res.fetchedAt ?? null);
            const cov = pickCoverageFromCommuteResponse(res);
            applyFlightsToState(res.flights, res.originTz, res.destTz, displayFetchedAt, res.notice ?? null, route.label);
            setCommuteCache(cacheKey, {
              flights: res.flights,
              originTz: res.originTz,
              destTz: res.destTz,
              fetchedAt: res.fetchedAt ?? null,
              notice: res.notice ?? null,
              coverage: cov,
            });
            return { flights: res.flights, coverage: cov };
          }
          setNotice(res.message);
          return { flights: null, coverage: null };
        };

        const results = await Promise.all(routes.map(fetchOne));
        const mergedBanner = results.reduce<CommuteCoverageForClient | null>(
          (acc, row) => mergeCoverageWarnings(acc, row.coverage),
          null
        );
        setCommuteCoverageBanner(mergedBanner);
        const dutyStart = new Date(event.start_time);
        const arriveByFormatted = dutyOk ? formatInTimeZone(subMinutes(dutyStart, arrivalBuffer), baseTz, "HH:mm") : "";
        setCommuteMeta({ showInfo: dutyOk, arriveByFormatted, dutyOk });
        if (results.every((r) => r.flights === null) && routes.length > 0) {
          setSource(null);
          setLastFetchedAt(null);
        }
        return results;
      } catch (err) {
        console.error("Commute Assist failed", err);
        setCommuteError("Commute Assist temporarily unavailable.");
        setSource(null);
        setLastFetchedAt(null);
        return null;
      } finally {
        setRefreshing(false);
      }
    },
    [
      canUseCommute,
      routes,
      direction,
      homeAirport,
      dutyEndAirport,
      baseAirport,
      event.start_time,
      baseTz,
      dutyOk,
      arrivalBuffer,
      applyFlightsToState,
    ]
  );

  /** 2-leg first-leg only: fetch Home/Alternate → Commute Airport via same getCommuteFlights (same DB as direct). Also fetches leg2 (stop → crew base) and builds full TwoLegOption[] for leg1+leg2 display. */
  const loadTwoLegFirstLegFlights = useCallback(
    async (opts?: { forceRefresh?: boolean }) => {
      if (twoLegFirstLegRoutes.length === 0) {
        setTwoLegFirstLegGroups({});
        setTwoLegFirstLegOptions([]);
        return;
      }
      const MIN_CONNECTION_MINUTES = 30;
      const forceRefresh = opts?.forceRefresh ?? false;
      if (forceRefresh) setRefreshing(true);
      try {
      const groups: Record<string, CommuteFlightOption[]> = {};
      const allOptions: TwoLegOption[] = [];
      const crewBase = (direction === "to_base"
        ? (dutyStartAirport ?? baseAirport)?.toUpperCase() ?? ""
        : "").trim();
      const home = homeAirport?.trim().toUpperCase();
      const alternate = alternateHomeAirport?.trim().toUpperCase();

      for (const route of twoLegFirstLegRoutes) {
        const [labelPart] = route.routeKey.split("-");
        const leg2Dest = direction === "to_base"
          ? crewBase
          : (labelPart === "home" ? home : alternate) ?? "";
        if (!leg2Dest || leg2Dest.length !== 3) continue;

        const cacheKeyLeg1 = getCommuteCacheKey(route.origin, route.destination, route.commuteDate, direction);
        let leg1Flights: CommuteFlight[] | null = null;
        let leg1OriginTz = "UTC";
        let leg1DestTz = "UTC";
        if (!forceRefresh) {
          const cached = getCommuteCache(cacheKeyLeg1);
          if (cached) {
            leg1Flights = cached.flights;
            leg1OriginTz = cached.originTz;
            leg1DestTz = cached.destTz;
            setOriginTz((prev) => (prev === "UTC" ? leg1OriginTz : prev));
            setDestTz((prev) => (prev === "UTC" ? leg1DestTz : prev));
          }
        }
        if (!leg1Flights) {
          const res = await getCommuteFlights({
            origin: route.origin,
            destination: route.destination,
            date: route.commuteDate,
            forceRefresh,
          });
          if (!res.ok) continue;
          leg1Flights = res.flights;
          leg1OriginTz = res.originTz;
          leg1DestTz = res.destTz;
          setCommuteCache(cacheKeyLeg1, {
            flights: res.flights,
            originTz: res.originTz,
            destTz: res.destTz,
            fetchedAt: res.fetchedAt ?? null,
            notice: res.notice ?? null,
            coverage: pickCoverageFromCommuteResponse(res),
          });
        }
        const leg1Opts = convertRawFlightsToLegOptions(leg1Flights, leg1OriginTz, leg1DestTz, `2leg-${route.routeKey}`);
        groups[route.routeKey] = leg1Opts;
        setOriginTz((prev) => (prev === "UTC" ? leg1OriginTz : prev));
        setDestTz((prev) => (prev === "UTC" ? leg1DestTz : prev));

        const cacheKeyLeg2 = getCommuteCacheKey(route.destination, leg2Dest, route.commuteDate, direction);
        let leg2Flights: CommuteFlight[] | null = null;
        let leg2OriginTz = "UTC";
        let leg2DestTz = "UTC";
        if (!forceRefresh) {
          const cached = getCommuteCache(cacheKeyLeg2);
          if (cached) {
            leg2Flights = cached.flights;
            leg2OriginTz = cached.originTz;
            leg2DestTz = cached.destTz;
          }
        }
        if (!leg2Flights) {
          const res2 = await getCommuteFlights({
            origin: route.destination,
            destination: leg2Dest,
            date: route.commuteDate,
            forceRefresh,
          });
          if (!res2.ok) continue;
          leg2Flights = res2.flights;
          leg2OriginTz = res2.originTz;
          leg2DestTz = res2.destTz;
          setCommuteCache(cacheKeyLeg2, {
            flights: res2.flights,
            originTz: res2.originTz,
            destTz: res2.destTz,
            fetchedAt: res2.fetchedAt ?? null,
            notice: res2.notice ?? null,
            coverage: pickCoverageFromCommuteResponse(res2),
          });
        }
        const leg2Opts = convertRawFlightsToLegOptions(leg2Flights, leg2OriginTz, leg2DestTz, `2leg-${route.routeKey}-leg2`);
        const minLeg2DepMs = MIN_CONNECTION_MINUTES * 60 * 1000;
        const label = labelPart === "home" ? "home" : "alternate";
        for (const leg1 of leg1Opts) {
          const leg1LandIso = leg1.sortArrUtc;
          const minLeg2DepIso = new Date(new Date(leg1LandIso).getTime() + minLeg2DepMs).toISOString();
          for (const leg2 of leg2Opts) {
            const leg2DepIso = leg2.sortDepUtc;
            if (leg2DepIso >= minLeg2DepIso) {
              allOptions.push({
                routeKey: route.routeKey,
                label,
                origin: route.origin,
                stop: route.destination,
                destination: leg2Dest,
                leg1,
                leg2,
                depUtc: leg1.sortDepUtc,
                arrUtc: leg2.sortArrUtc,
              });
              // Debug: DL 1946 ATL-SJU 2-leg option trace (remove after root cause found)
              if (
                route.destination === "ATL" &&
                leg2Dest === "SJU" &&
                (leg2.carrier === "DL" || leg2.carrier === "dl") &&
                /1946/.test(leg2.flight ?? "")
              ) {
                const connectMin = connectionMinutesBetweenLegs(leg1, leg2);
                console.log("[Commute Assist] DL 1946 ATL→SJU 2-leg option (loadTwoLegFirstLegFlights)", {
                  leg1ArrUtc: leg1LandIso,
                  leg2DepUtc: leg2DepIso,
                  leg2ArrUtc: leg2.arrUtc,
                  connectMin,
                  leg2DurationMin: durationMinutesUtc(leg2.depUtc, leg2.arrUtc),
                });
              }
            }
          }
        }
      }
      setTwoLegFirstLegGroups(groups);
      setTwoLegFirstLegOptions(allOptions);
      setTwoLegFirstLegPage(1);
      setLastFetchedAt(forceRefresh ? new Date().toISOString() : null);
      } finally {
        if (forceRefresh) setRefreshing(false);
      }
    },
    [twoLegFirstLegRoutes, direction, dutyStartAirport, baseAirport, homeAirport, alternateHomeAirport]
  );

  const loadTwoLegFlights = useCallback(
    async (opts?: { forceRefresh?: boolean }) => {
      if (twoLegRoutes.length === 0) {
        setTwoLegOptions([]);
        setTwoLegPage(1);
        return;
      }
      const MIN_CONNECTION_MINUTES = 30;
      const forceRefresh = opts?.forceRefresh ?? false;
      const allOptions: TwoLegOption[] = [];
      const arriveByMs = arriveBy?.getTime() ?? null;
      const tryDayPrior =
        direction === "to_base" && arriveByMs != null && dutyDateBase;

      for (const route of twoLegRoutes) {
        const leg1Date = route.commuteDate;
        const leg2Date = route.commuteDate;
        let leg1Flights: CommuteFlight[] | null = null;
        let leg1OriginTz = "UTC";
        let leg1DestTz = "UTC";
        let leg2Flights: CommuteFlight[] | null = null;
        let leg2OriginTz = "UTC";
        let leg2DestTz = "UTC";

        const fetchLeg1 = async (date: string) => {
          const cacheKey = getCommuteCacheKey(route.origin, route.stop, date, direction);
          if (!forceRefresh) {
            const cached = getCommuteCache(cacheKey);
            if (cached) return { flights: cached.flights, originTz: cached.originTz, destTz: cached.destTz };
          }
          const res = await getCommuteFlights({ origin: route.origin, destination: route.stop, date, forceRefresh });
          if (!res.ok) return null;
          setCommuteCache(cacheKey, {
            flights: res.flights,
            originTz: res.originTz,
            destTz: res.destTz,
            fetchedAt: res.fetchedAt ?? null,
            notice: res.notice ?? null,
            coverage: pickCoverageFromCommuteResponse(res),
          });
          return { flights: res.flights, originTz: res.originTz, destTz: res.destTz };
        };

        const fetchLeg2 = async (date: string) => {
          const cacheKey = getCommuteCacheKey(route.stop, route.destination, date, direction);
          if (!forceRefresh) {
            const cached = getCommuteCache(cacheKey);
            if (cached) return { flights: cached.flights, originTz: cached.originTz, destTz: cached.destTz };
          }
          const res = await getCommuteFlights({
            origin: route.stop,
            destination: route.destination,
            date,
            forceRefresh,
          });
          if (!res.ok) return null;
          setCommuteCache(cacheKey, {
            flights: res.flights,
            originTz: res.originTz,
            destTz: res.destTz,
            fetchedAt: res.fetchedAt ?? null,
            notice: res.notice ?? null,
            coverage: pickCoverageFromCommuteResponse(res),
          });
          return { flights: res.flights, originTz: res.originTz, destTz: res.destTz };
        };

        const buildOptions = (
          l1: CommuteFlight[],
          l1Tz: string,
          l1DestTz: string,
          l2: CommuteFlight[],
          l2Tz: string,
          l2DestTz: string
        ): TwoLegOption[] => {
          const l1Opts = convertRawFlightsToLegOptions(l1, l1Tz, l1DestTz, `2leg-${route.label}-${route.stop}-leg1`);
          const l2Opts = convertRawFlightsToLegOptions(l2, l2Tz, l2DestTz, `2leg-${route.label}-${route.stop}-leg2`);
          const minLeg2DepMs = MIN_CONNECTION_MINUTES * 60 * 1000;
          const opts: TwoLegOption[] = [];
          for (const leg1 of l1Opts) {
            const leg1LandIso = leg1.sortArrUtc;
            const minLeg2DepIso = new Date(new Date(leg1LandIso).getTime() + minLeg2DepMs).toISOString();
            for (const leg2 of l2Opts) {
              const leg2DepIso = leg2.sortDepUtc;
              if (leg2DepIso >= minLeg2DepIso) {
                const opt = {
                  routeKey: `${route.label}-${route.stop}`,
                  label: route.label,
                  origin: route.origin,
                  stop: route.stop,
                  destination: route.destination,
                  leg1,
                  leg2,
                  depUtc: leg1.sortDepUtc,
                  arrUtc: leg2.sortArrUtc,
                };
                opts.push(opt);
                // Debug: DL 1946 ATL-SJU 2-leg option trace (remove after root cause found)
                if (
                  route.stop === "ATL" &&
                  route.destination === "SJU" &&
                  (leg2.carrier === "DL" || leg2.carrier === "dl") &&
                  /1946/.test(leg2.flight ?? "")
                ) {
                  const connectMin = connectionMinutesBetweenLegs(leg1, leg2);
                  console.log("[Commute Assist] DL 1946 ATL→SJU 2-leg option (loadTwoLegFlights)", {
                    leg1ArrUtc: leg1LandIso,
                    leg2DepUtc: leg2DepIso,
                    leg2ArrUtc: leg2.arrUtc,
                    connectMin,
                    leg2DurationMin: durationMinutesUtc(leg2.depUtc, leg2.arrUtc),
                  });
                }
              }
            }
          }
          return opts;
        };

        let leg1Result = await fetchLeg1(leg1Date);
        if (!leg1Result) continue;
        leg1Flights = leg1Result.flights;
        leg1OriginTz = leg1Result.originTz;
        leg1DestTz = leg1Result.destTz;

        let leg2Result = await fetchLeg2(leg2Date);
        if (!leg2Result) continue;
        leg2Flights = leg2Result.flights;
        leg2OriginTz = leg2Result.originTz;
        leg2DestTz = leg2Result.destTz;

        let routeOptions = buildOptions(
          leg1Flights,
          leg1OriginTz,
          leg1DestTz,
          leg2Flights,
          leg2OriginTz,
          leg2DestTz
        );

        if (tryDayPrior && routeOptions.length > 0) {
          const anyArriveByCutoff = routeOptions.some((o) => sortArrMs(o.leg2) <= arriveByMs);
          if (!anyArriveByCutoff) {
            const dayPrior = subtractDay(dutyDateBase);
            const leg1Prior = await fetchLeg1(dayPrior);
            const leg2Prior = await fetchLeg2(dutyDateBase);
            if (leg1Prior && leg2Prior) {
              const fallbackOptions = buildOptions(
                leg1Prior.flights,
                leg1Prior.originTz,
                leg1Prior.destTz,
                leg2Prior.flights,
                leg2Prior.originTz,
                leg2Prior.destTz
              );
              const anyFallbackArriveByCutoff = fallbackOptions.some((o) => sortArrMs(o.leg2) <= arriveByMs);
              if (anyFallbackArriveByCutoff || fallbackOptions.length > 0) {
                routeOptions = fallbackOptions;
              }
            }
          }
        }

        allOptions.push(...routeOptions);
      }
      setTwoLegOptions(allOptions);
      setTwoLegPage(1);
    },
    [twoLegRoutes, direction, arriveBy?.getTime(), dutyDateBase, event.start_time, event.end_time, baseTz]
  );

  useEffect(() => {
    if (canUseCommute && !noCommuteNeeded && !commuteAssistSuppressFlightSearch) {
      loadFlights().catch((err) => {
        console.error("Commute Assist loadFlights failed", err);
        setCommuteError("Commute Assist temporarily unavailable.");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadFlights omitted to avoid infinite loop; we re-run when routes change
  }, [routes, direction, canUseCommute, noCommuteNeeded, commuteAssistSuppressFlightSearch]);

  useEffect(() => {
    if (commuteTwoLegEnabled && dutyOk && !commuteMeta) {
      const dutyStart = new Date(event.start_time);
      const arriveByFormatted = formatInTimeZone(subMinutes(dutyStart, arrivalBuffer), baseTz, "HH:mm");
      setCommuteMeta({ showInfo: dutyOk, arriveByFormatted, dutyOk });
    }
  }, [commuteTwoLegEnabled, dutyOk, commuteMeta, event.start_time, arrivalBuffer, baseTz]);

  useEffect(() => {
    if (
      canUseCommute &&
      !noCommuteNeeded &&
      !commuteAssistSuppressFlightSearch &&
      commuteTwoLegEnabled &&
      twoLegFirstLegRoutes.length > 0
    ) {
      loadTwoLegFirstLegFlights().catch((err) => {
        console.error("Commute Assist loadTwoLegFirstLegFlights failed", err);
      });
    }
  }, [
    canUseCommute,
    noCommuteNeeded,
    commuteAssistSuppressFlightSearch,
    commuteTwoLegEnabled,
    twoLegFirstLegRoutes,
    loadTwoLegFirstLegFlights,
  ]);

  useEffect(() => {
    const hasDutyInfo = commuteMeta || (commuteTwoLegEnabled && dutyOk);
    if (
      canUseCommute &&
      !noCommuteNeeded &&
      !commuteAssistSuppressFlightSearch &&
      hasDutyInfo &&
      twoLegRoutes.length > 0 &&
      commuteTwoLegEnabled
    ) {
      loadTwoLegFlights().catch((err) => {
        console.error("Commute Assist loadTwoLegFlights failed", err);
      });
    }
  }, [
    commuteMeta,
    commuteTwoLegEnabled,
    dutyOk,
    canUseCommute,
    noCommuteNeeded,
    commuteAssistSuppressFlightSearch,
    twoLegRoutes,
    loadTwoLegFlights,
  ]);

  // Tick every 60s when we have lastFetchedAt, so "Updated just now" transitions to timestamp
  useEffect(() => {
    if (!lastFetchedAt) return;
    const id = setInterval(() => setLastUpdateTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [lastFetchedAt]);

  useEffect(() => {
    setHomePage(1);
    setAlternatePage(1);
  }, [sortBy]);

  const homeList = sortFlights(commuteGroups.home ?? [], sortBy);
  const alternateList = sortFlights(commuteGroups.alternate ?? [], sortBy);
  const homeLastFlightId =
    homeList.length > 0
      ? homeList.reduce((best, f) => (sortDepMs(f) > sortDepMs(best) ? f : best)).id
      : null;
  const alternateLastFlightId =
    alternateList.length > 0
      ? alternateList.reduce((best, f) => (sortDepMs(f) > sortDepMs(best) ? f : best)).id
      : null;
  const homeTotalPages = Math.max(1, Math.ceil(homeList.length / PAGE_SIZE));
  const alternateTotalPages = Math.max(1, Math.ceil(alternateList.length / PAGE_SIZE));
  const homePageItems = homeList.slice((homePage - 1) * PAGE_SIZE, homePage * PAGE_SIZE);
  const alternatePageItems = alternateList.slice((alternatePage - 1) * PAGE_SIZE, alternatePage * PAGE_SIZE);
  const filteredTwoLegOptions = useMemo(
    () => filterTwoLegOptionsForDisplay(twoLegOptions),
    [twoLegOptions]
  );
  const twoLegTotalPages = Math.max(1, Math.ceil(filteredTwoLegOptions.length / PAGE_SIZE));
  const twoLegPageItems = filteredTwoLegOptions.slice((twoLegPage - 1) * PAGE_SIZE, twoLegPage * PAGE_SIZE);
  const twoLegLastFlightId =
    filteredTwoLegOptions.length > 0
      ? filteredTwoLegOptions.reduce((best, o) => (sortArrMs(o.leg2) > sortArrMs(best.leg2) ? o : best)).leg2.id
      : null;

  const filteredTwoLegFirstLegOptions = useMemo(
    () => filterTwoLegOptionsForDisplay(twoLegFirstLegOptions),
    [twoLegFirstLegOptions]
  );
  const twoLegFirstLegTotalPages = Math.max(1, Math.ceil(filteredTwoLegFirstLegOptions.length / PAGE_SIZE));
  const twoLegFirstLegPageItems = filteredTwoLegFirstLegOptions.slice(
    (twoLegFirstLegPage - 1) * PAGE_SIZE,
    twoLegFirstLegPage * PAGE_SIZE
  );
  const twoLegFirstLegLastFlightId =
    filteredTwoLegFirstLegOptions.length > 0
      ? filteredTwoLegFirstLegOptions.reduce((best, o) =>
          sortArrMs(o.leg2) > sortArrMs(best.leg2) ? o : best
        ).leg2.id
      : null;

  useEffect(() => {
    if (homeList.length === 0) setHomePage(1);
    else if (homePage > homeTotalPages) setHomePage(homeTotalPages);
  }, [homeList.length, homePage, homeTotalPages]);

  useEffect(() => {
    if (alternateList.length === 0) setAlternatePage(1);
    else if (alternatePage > alternateTotalPages) setAlternatePage(alternateTotalPages);
  }, [alternateList.length, alternatePage, alternateTotalPages]);

  useEffect(() => {
    if (filteredTwoLegOptions.length === 0) setTwoLegPage(1);
    else if (twoLegPage > twoLegTotalPages) setTwoLegPage(twoLegTotalPages);
  }, [filteredTwoLegOptions.length, twoLegPage, twoLegTotalPages]);

  useEffect(() => {
    if (filteredTwoLegFirstLegOptions.length === 0) setTwoLegFirstLegPage(1);
    else if (twoLegFirstLegPage > twoLegFirstLegTotalPages) setTwoLegFirstLegPage(twoLegFirstLegTotalPages);
  }, [filteredTwoLegFirstLegOptions.length, twoLegFirstLegPage, twoLegFirstLegTotalPages]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" || sortBy !== "arrAsc") return;

    const primaryRoute =
      commuteTwoLegEnabled && twoLegFirstLegRoutes[0] ? twoLegFirstLegRoutes[0] : routes[0];
    const route = `${primaryRoute?.origin ?? ""} → ${primaryRoute?.destination ?? ""}`;
    const date =
      primaryRoute?.commuteDate ?? new Date().toISOString().slice(0, 10);

    const reportMismatch = (
      flights: { flightNumber: string; displayedArrival: string }[]
    ) => {
      const payload = {
        type: "COMMUTE_SORT_MISMATCH" as const,
        route,
        date,
        flights,
      };
      console.warn(payload);
      void fetch("/api/debug/commute-integrity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "COMMUTE_SORT_MISMATCH",
          route,
          date,
          userId: profile.id,
          flightsSnapshot: flights,
        }),
      }).catch(() => {});
    };

    const homeSorted = sortFlights(commuteGroups.home ?? [], sortBy);
    const homeMismatch = collectFlightsIfArrAscMismatchDirect(homeSorted);
    if (homeMismatch) reportMismatch(homeMismatch);

    const altSorted = sortFlights(commuteGroups.alternate ?? [], sortBy);
    const altMismatch = collectFlightsIfArrAscMismatchDirect(altSorted);
    if (altMismatch) reportMismatch(altMismatch);

    const twoLegFiltered = filterTwoLegOptionsForDisplay(twoLegOptions);
    const twoLegMismatch = collectFlightsIfArrAscMismatchTwoLeg(twoLegFiltered);
    if (twoLegMismatch) reportMismatch(twoLegMismatch);

    const twoLegFirstFiltered = filterTwoLegOptionsForDisplay(twoLegFirstLegOptions);
    const firstMismatch = collectFlightsIfArrAscMismatchTwoLeg(twoLegFirstFiltered);
    if (firstMismatch) reportMismatch(firstMismatch);
  }, [
    sortBy,
    commuteGroups.home,
    commuteGroups.alternate,
    twoLegOptions,
    twoLegFirstLegOptions,
    profile.id,
    commuteTwoLegEnabled,
    twoLegFirstLegRoutes,
    routes,
  ]);

  const didPaginateRef = useRef(false);
  useEffect(() => {
    if (!didPaginateRef.current) {
      didPaginateRef.current = true;
      return;
    }
    cardsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [homePage, alternatePage, twoLegPage, twoLegFirstLegPage]);

  const primaryRoute = commuteTwoLegEnabled && twoLegFirstLegRoutes[0] ? twoLegFirstLegRoutes[0] : routes[0];
  const displayOrigin = primaryRoute?.origin ?? "";
  const displayDestination = primaryRoute?.destination ?? "";

  if (!hasValidHome) {
    return (
      <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
        Set Home Airport (3-letter IATA) in Profile to use Commute{" "}
        <span className="text-[#75C043]">Assist</span>
        <span className="align-super text-[10px]">™</span>.
      </div>
    );
  }

  if (!hasValidBase) {
    return (
      <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
        Set Crew Base (3-letter IATA) in Profile to use Commute{" "}
        <span className="text-[#75C043]">Assist</span>
        <span className="align-super text-[10px]">™</span>.
      </div>
    );
  }

  if (noCommuteNeeded) {
    return (
      <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200/90">
        No flight commute needed — Next Duty Report starts at your home airport.
      </div>
    );
  }

  if (commuteAssistSuppressFlightSearch) {
    return (
      <div className="mt-3 rounded-xl border border-slate-600/40 bg-slate-800/40 px-3 py-2 text-sm text-slate-200">
        You are currently on duty assignment — No commute search needed.
      </div>
    );
  }

  const routeLabelItems =
    twoLegRoutes.length > 0
      ? twoLegRoutes.map((r, i) => ({
          ...r,
          routeText: `${r.origin} → ${r.stop} → ${r.destination}`,
          key: `${r.label}-${r.stop}`,
          routeLabel: `Commute ${i + 1}`,
        }))
      : commuteTwoLegEnabled && twoLegFirstLegRoutes.length > 0
        ? twoLegFirstLegRoutes.map((r) => {
            const [labelPart] = r.routeKey.split("-");
            const label = labelPart === "home" ? "home" : "alternate";
            return {
              ...r,
              label,
              routeText: `${r.origin} → ${r.destination}`,
              key: r.routeKey,
              routeLabel: label === "home" ? "Home Airport" : "Alternate Option",
            };
          })
        : routes.map((r) => ({
            ...r,
            routeText: `${r.origin} → ${r.destination}`,
            key: r.label,
            routeLabel: r.label === "home" ? "Commute from Home" : "Commute from Alternate",
          }));

  if (commuteError) {
    return (
      <div className="mt-3 space-y-2">
        <div className="text-sm text-slate-300 space-y-0.5">
          {routeLabelItems.map((r) => (
            <p key={r.key} className="flex items-center gap-2">
              {r.label === "home" ? "🏠" : "🅰️"} {r.routeLabel}: {r.routeText}
            </p>
          ))}
        </div>
        <p className="text-xs text-amber-200/90">{commuteError}</p>
      </div>
    );
  }

  if (!commuteMeta) {
    return (
      <div className="mt-3 space-y-2">
        <div className="text-sm text-slate-300 space-y-0.5">
          {routeLabelItems.map((r) => (
            <p key={r.key} className="flex items-center gap-2">
              {r.label === "home" ? "🏠" : "🅰️"} {r.routeLabel}: {r.routeText}
            </p>
          ))}
        </div>
        <p className="text-xs text-slate-500">Loading commute options…</p>
      </div>
    );
  }

  const { showInfo, arriveByFormatted } = commuteMeta;
  const commuteDate = primaryRoute?.commuteDate ?? new Date().toISOString().slice(0, 10);
  // Parse commuteDate as local date in baseTz (noon avoids UTC-midnight → wrong-day display)
  const commuteDateObj = fromZonedTime(`${commuteDate}T12:00:00`, baseTz);
  const commuteDateFormatted = formatInTimeZone(commuteDateObj, baseTz, "EEE MMMM d, yyyy");
  const tzMissing = originTz === "UTC" || destTz === "UTC";
  const commuteWindowValue = direction === "to_base"
    ? (dutyOk ? (toBaseCommuteSearchDate === dutyDateBase ? "Same Day" : "Day Prior") : "Same-day flights")
    : (dutyEndDateBase ? "Day of Release" : "Same-day flights");

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          {routeLabelItems.map((r) => (
            <p key={r.key} className="flex items-center gap-2 text-base font-medium text-slate-300">
              {r.label === "home" ? "🏠" : "🅰️"} {r.routeLabel}: {r.routeText}
            </p>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isCommuteWindowExpired && (
            <>
              <div className="flex rounded border border-slate-700/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`touch-target touch-pad px-2 py-1 text-[11px] ${viewMode === "cards" ? "bg-slate-600 text-white" : "text-slate-400 hover:bg-slate-800/60"}`}
                >
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("board")}
                  className={`touch-target touch-pad px-2 py-1 text-[11px] ${viewMode === "board" ? "bg-slate-600 text-white" : "text-slate-400 hover:bg-slate-800/60"}`}
                >
                  Board
                </button>
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "arrAsc" | "arrDesc" | "durAsc" | "durDesc")}
                className="touch-input rounded border border-slate-700/60 bg-slate-900/60 text-xs text-slate-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-500"
              >
                <option value="arrAsc">Earliest arrival</option>
                <option value="arrDesc">Latest arrival</option>
                <option value="durAsc">Shortest flight</option>
                <option value="durDesc">Longest flight</option>
              </select>
              {source && (
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">
                  {source === "live" ? "Live" : "Scheduled"}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  routes.forEach((r) => clearCommuteCache(getCommuteCacheKey(r.origin, r.destination, r.commuteDate, direction)));
                  twoLegFirstLegRoutes.forEach((r) => {
                    clearCommuteCache(getCommuteCacheKey(r.origin, r.destination, r.commuteDate, direction));
                    const [labelPart] = r.routeKey.split("-");
                    const leg2Dest = direction === "to_base"
                      ? (dutyStartAirport ?? baseAirport)?.toUpperCase() ?? ""
                      : (labelPart === "home" ? homeAirport : alternateHomeAirport)?.toUpperCase() ?? "";
                    if (leg2Dest.length === 3) {
                      clearCommuteCache(getCommuteCacheKey(r.destination, leg2Dest, r.commuteDate, direction));
                    }
                  });
                  twoLegRoutes.forEach((r) => {
                    clearCommuteCache(getCommuteCacheKey(r.origin, r.stop, r.commuteDate, direction));
                    clearCommuteCache(getCommuteCacheKey(r.stop, r.destination, r.commuteDate, direction));
                  });
                  loadFlights({ forceRefresh: true }).catch((err) => { console.error("Commute Assist refresh failed", err); setCommuteError("Refresh failed."); });
                  if (commuteTwoLegEnabled && twoLegFirstLegRoutes.length > 0) {
                    loadTwoLegFirstLegFlights({ forceRefresh: true }).catch((err) => { console.error("Commute Assist 2-leg first-leg refresh failed", err); setCommuteError("Refresh failed."); });
                  } else if (twoLegRoutes.length > 0) {
                    loadTwoLegFlights({ forceRefresh: true }).catch((err) => { console.error("Commute Assist 2-leg refresh failed", err); setCommuteError("Refresh failed."); });
                  }
                }}
                disabled={refreshing}
                className="touch-target touch-pad rounded-full border border-slate-700/60 bg-slate-900/40 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-900/70 disabled:opacity-50"
              >
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
              {lastFetchedAt && (
                <span className="text-[11px] text-slate-500">
                  {formatLastUpdate(lastFetchedAt, baseTz)}
                </span>
              )}
            </>
          )}
        </div>
      </div>
      {notice && (
        <div className="mt-2 rounded-xl border border-slate-600/40 bg-slate-800/40 px-3 py-2 text-xs text-slate-300">
          {notice}
        </div>
      )}
      {!isCommuteWindowExpired && (twoLegRoutes.length > 0 || twoLegOptions.length > 0) && (
        <p className="text-xs text-slate-500">
          2-Leg Debug • Routes: {twoLegRoutes.length} • Options: {twoLegOptions.length}
        </p>
      )}
      {showInfo ? (
        <>
          <p className="text-xs text-slate-400">
            Commute Date  •  {commuteDateFormatted}
          </p>
          <p className="text-xs text-slate-400">
            Search Window •  {commuteWindowValue}
          </p>
          {direction === "to_base" && (
            <p className="text-xs text-slate-400">
              Arrive by: {arriveByFormatted} ({(baseAirport ?? "base").toUpperCase()})
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-slate-400">Commute timing unavailable for this event.</p>
      )}
      {commuteAssistReserveEarlyReleaseWindow && (
        <p className="text-xs text-amber-200/90 mt-1">
          Possible commute home if released early or on schedule — actual release time may differ.
        </p>
      )}
      {commuteCoverageBanner?.coverageWarning && !isCommuteWindowExpired && (
        <div
          className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2.5"
          role="status"
        >
          <p className="text-xs font-medium text-amber-100/90">{commuteCoverageBanner.coverageWarningTitle}</p>
          <p className="mt-1 text-[11px] leading-snug text-slate-400">
            {commuteCoverageBanner.coverageWarningMessage}
          </p>
        </div>
      )}
      {dutyOk && (
        <div className="mt-6 space-y-4">
          {isCommuteWindowExpired ? (
            <div className="rounded-xl border border-slate-600/50 bg-slate-900/40 px-4 py-4">
              <p className="text-sm font-semibold text-slate-200">Commute window closed</p>
              <p className="mt-2 text-xs text-slate-400">
                This commute needed arrival by {arriveByFormatted} ({(baseAirport ?? "base").toUpperCase()}).
              </p>
            </div>
          ) : (
            <>
          {tzMissing && (
            <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
              Timezone data missing for route. Ask an admin to add it in Airports.
            </div>
          )}
          {!homeList.length && !alternateList.length && !twoLegOptions.length && !(commuteTwoLegEnabled && twoLegFirstLegRoutes.length > 0) ? (
            <p className="text-xs text-slate-500">
              {notice ? "No matching flights in this window." : "No commute options found in this window."}
            </p>
          ) : (
            <div ref={cardsTopRef} className="min-w-0 space-y-6">
              {homeList.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <span aria-hidden>✈️</span>
                    {direction === "to_home" ? "Flights to Home Airport" : "Flights from Home Airport"}
                  </p>
                  <div className="space-y-2">
                    {homePageItems.map((opt) =>
                      viewMode === "cards" ? (
                        <CommuteFlightCard
                          key={opt.id}
                          opt={opt}
                          baseTz={baseTz}
                          origin={primaryRoute?.origin ?? displayOrigin}
                          destination={primaryRoute?.destination ?? displayDestination}
                          originTz={opt.originTz ?? originTz}
                          destTz={opt.destTz ?? destTz}
                          isLastFlight={opt.id === homeLastFlightId}
                        />
                      ) : (
                        <CommuteFlightRow
                          key={opt.id}
                          opt={opt}
                          baseTz={baseTz}
                          origin={primaryRoute?.origin ?? displayOrigin}
                          destination={primaryRoute?.destination ?? displayDestination}
                          originTz={opt.originTz ?? originTz}
                          destTz={opt.destTz ?? destTz}
                          isLastFlight={opt.id === homeLastFlightId}
                        />
                      )
                    )}
                  </div>
                  {homeTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setHomePage((p) => Math.max(1, p - 1))}
                        disabled={homePage <= 1}
                        className="touch-target touch-pad rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Prev
                      </button>
                      {Array.from({ length: homeTotalPages }, (_, i) => i + 1).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setHomePage(p)}
                          className={`touch-target touch-pad rounded px-2 py-1 text-xs ${p === homePage ? "bg-slate-600 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}
                        >
                          {p}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setHomePage((p) => Math.min(homeTotalPages, p + 1))}
                        disabled={homePage >= homeTotalPages}
                        className="touch-target touch-pad rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
              {alternateList.length > 0 && routes.length > 1 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <span aria-hidden>✈️</span>
                    {direction === "to_home" ? "Flights to Alternate Airport" : "Flights from Alternate Airport"}
                  </p>
                  <div className="space-y-2">
                    {alternatePageItems.map((opt) => {
                      const altRoute = routes.find((r) => r.label === "alternate");
                      return viewMode === "cards" ? (
                        <CommuteFlightCard
                          key={opt.id}
                          opt={opt}
                          baseTz={baseTz}
                          origin={altRoute?.origin ?? ""}
                          destination={altRoute?.destination ?? ""}
                          originTz={opt.originTz ?? originTz}
                          destTz={opt.destTz ?? destTz}
                          isLastFlight={opt.id === alternateLastFlightId}
                        />
                      ) : (
                        <CommuteFlightRow
                          key={opt.id}
                          opt={opt}
                          baseTz={baseTz}
                          origin={altRoute?.origin ?? ""}
                          destination={altRoute?.destination ?? ""}
                          originTz={opt.originTz ?? originTz}
                          destTz={opt.destTz ?? destTz}
                          isLastFlight={opt.id === alternateLastFlightId}
                        />
                      );
                    })}
                  </div>
                  {alternateTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setAlternatePage((p) => Math.max(1, p - 1))}
                        disabled={alternatePage <= 1}
                        className="touch-target touch-pad rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Prev
                      </button>
                      {Array.from({ length: alternateTotalPages }, (_, i) => i + 1).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setAlternatePage(p)}
                          className={`touch-target touch-pad rounded px-2 py-1 text-xs ${p === alternatePage ? "bg-slate-600 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}
                        >
                          {p}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setAlternatePage((p) => Math.min(alternateTotalPages, p + 1))}
                        disabled={alternatePage >= alternateTotalPages}
                        className="touch-target touch-pad rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
              {twoLegOptions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <span aria-hidden>✈️</span>
                    2-Leg Commute Options from Home
                  </p>
                  {twoLegRoutes.length > 0 && (
                    <p className="text-xs text-slate-400">
                      {twoLegRoutes[0].origin} → {twoLegRoutes[0].stop} → {twoLegRoutes[0].destination}
                    </p>
                  )}
                  <div className="min-w-0 space-y-2">
                    {twoLegPageItems.map((opt) => {
                      const connectMin = connectionMinutesBetweenLegs(opt.leg1, opt.leg2);
                      return (
                        <div key={`${opt.routeKey}-${opt.leg1.id}-${opt.leg2.id}`} className="min-w-0 w-full rounded-lg border border-slate-700/60 bg-slate-900/40 p-2">
                          <div className="flex flex-col sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch gap-2 min-w-0">
                            <TwoLegCompactLeg
                              opt={opt.leg1}
                              origin={opt.origin}
                              destination={opt.stop}
                              originTz={opt.leg1.originTz ?? originTz}
                              destTz={opt.leg1.destTz ?? destTz}
                              isLastFlight={false}
                            />
                            <div className="shrink-0 self-center inline-flex items-center justify-center rounded-md border border-slate-700/40 bg-slate-800/50 px-2.5 py-1.5 text-xs text-slate-400">
                              {fmtHM(connectMin)} connect
                            </div>
                            <TwoLegCompactLeg
                              opt={opt.leg2}
                              origin={opt.stop}
                              destination={opt.destination}
                              originTz={opt.leg2.originTz ?? originTz}
                              destTz={opt.leg2.destTz ?? destTz}
                              isLastFlight={opt.leg2.id === twoLegLastFlightId}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {twoLegTotalPages > 1 && (
                    <div className="flex justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setTwoLegPage((p) => Math.max(1, p - 1))}
                        disabled={twoLegPage <= 1}
                        className="touch-target touch-pad rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Prev
                      </button>
                      {Array.from({ length: twoLegTotalPages }, (_, i) => i + 1).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setTwoLegPage(p)}
                          className={`touch-target touch-pad rounded px-2 py-1 text-xs ${p === twoLegPage ? "bg-slate-600 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}
                        >
                          {p}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setTwoLegPage((p) => Math.min(twoLegTotalPages, p + 1))}
                        disabled={twoLegPage >= twoLegTotalPages}
                        className="touch-target touch-pad rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
              {(commuteTwoLegEnabled && twoLegFirstLegRoutes.length > 0) && (() => {
                const hasFullOptions = filteredTwoLegFirstLegOptions.length > 0;
                const routeOrder = twoLegFirstLegRoutes.map((r) => r.routeKey);
                const hasAnyLeg1Flights = routeOrder.some((k) => (twoLegFirstLegGroups[k]?.length ?? 0) > 0);
                if (!hasFullOptions && !hasAnyLeg1Flights) {
                  return (
                    <div className="space-y-2">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                        {direction === "to_home" ? "🅰️" : "✈️"} Flights to Commute Airports
                      </p>
                      <p className="text-xs text-slate-500">
                        No flights found. Try Refresh or check the date.
                      </p>
                    </div>
                  );
                }
                if (hasFullOptions) {
                  const firstOpt = twoLegFirstLegPageItems[0];
                  const firstRoute = twoLegFirstLegRoutes.find((r) => r.routeKey === firstOpt?.routeKey) ?? twoLegFirstLegRoutes[0];
                  const hasHome = filteredTwoLegFirstLegOptions.some((o) => o.label === "home");
                  const hasAlternate = filteredTwoLegFirstLegOptions.some((o) => o.label === "alternate");
                  const sectionLabel = hasHome && hasAlternate ? "" : hasHome ? " from Home" : " from Alternate";
                  return (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                        <span aria-hidden>✈️</span>
                        2-Leg Commute Options{sectionLabel}
                      </p>
                      <p className="text-xs text-slate-400">
                        {firstRoute.origin} → {firstRoute.destination} → {direction === "to_base" ? ((dutyStartAirport ?? baseAirport) ?? "").toUpperCase() : (firstRoute.routeKey.startsWith("home") ? homeAirport : alternateHomeAirport) ?? ""}
                      </p>
                      <div className="min-w-0 space-y-2">
                        {twoLegFirstLegPageItems.map((opt) => {
                          const connectMin = connectionMinutesBetweenLegs(opt.leg1, opt.leg2);
                          return (
                            <div key={`${opt.routeKey}-${opt.leg1.id}-${opt.leg2.id}`} className="min-w-0 w-full rounded-lg border border-slate-700/60 bg-slate-900/40 p-2">
                              <div className="flex flex-col sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-stretch gap-2 min-w-0">
                                <TwoLegCompactLeg
                                  opt={opt.leg1}
                                  origin={opt.origin}
                                  destination={opt.stop}
                                  originTz={opt.leg1.originTz ?? originTz}
                                  destTz={opt.leg1.destTz ?? destTz}
                                  isLastFlight={false}
                                />
                                <div className="shrink-0 self-center inline-flex items-center justify-center rounded-md border border-slate-700/40 bg-slate-800/50 px-2.5 py-1.5 text-xs text-slate-400">
                                  {fmtHM(connectMin)} connect
                                </div>
                                <TwoLegCompactLeg
                                  opt={opt.leg2}
                                  origin={opt.stop}
                                  destination={opt.destination}
                                  originTz={opt.leg2.originTz ?? originTz}
                                  destTz={opt.leg2.destTz ?? destTz}
                                  isLastFlight={opt.leg2.id === twoLegFirstLegLastFlightId}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {twoLegFirstLegTotalPages > 1 && (
                        <div className="flex justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setTwoLegFirstLegPage((p) => Math.max(1, p - 1))}
                            disabled={twoLegFirstLegPage <= 1}
                            className="touch-target touch-pad rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Prev
                          </button>
                          {Array.from({ length: twoLegFirstLegTotalPages }, (_, i) => i + 1).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setTwoLegFirstLegPage(p)}
                              className={`touch-target touch-pad rounded px-2 py-1 text-xs ${p === twoLegFirstLegPage ? "bg-slate-600 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}
                            >
                              {p}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setTwoLegFirstLegPage((p) => Math.min(twoLegFirstLegTotalPages, p + 1))}
                            disabled={twoLegFirstLegPage >= twoLegFirstLegTotalPages}
                            className="touch-target touch-pad rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                  );
                }
                return (
                  <div className="space-y-4">
                    {routeOrder.map((routeKey) => {
                      const opts = twoLegFirstLegGroups[routeKey] ?? [];
                      if (opts.length === 0) return null;
                      const route = twoLegFirstLegRoutes.find((r) => r.routeKey === routeKey)!;
                      const [labelPart, stop] = routeKey.split("-");
                      const sectionTitle =
                        labelPart === "home"
                          ? `Flights from Home to Commute Airport (${stop})`
                          : `Flights from Alternate to Commute Airport (${stop})`;
                      return (
                        <div key={routeKey} className="space-y-2">
                          <p className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                            <span aria-hidden>✈️</span>
                            {sectionTitle}
                          </p>
                          <div className="space-y-2">
                            {opts.map((opt) =>
                              viewMode === "cards" ? (
                                <CommuteFlightCard
                                  key={opt.id}
                                  opt={opt}
                                  baseTz={baseTz}
                                  origin={route.origin}
                                  destination={route.destination}
                                  originTz={opt.originTz ?? originTz}
                                  destTz={opt.destTz ?? destTz}
                                  isLastFlight={false}
                                />
                              ) : (
                                <CommuteFlightRow
                                  key={opt.id}
                                  opt={opt}
                                  baseTz={baseTz}
                                  origin={route.origin}
                                  destination={route.destination}
                                  originTz={opt.originTz ?? originTz}
                                  destTz={opt.destTz ?? destTz}
                                  isLastFlight={false}
                                />
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
          <div className="pt-3 border-t border-slate-700/50 space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Legend</p>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-emerald-500" aria-hidden />
                <span className="text-[11px] text-slate-400">Most forgiving buffer (best chance to make duty if delays happen)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-amber-500" aria-hidden />
                <span className="text-[11px] text-slate-400">Tighter buffer (workable, but delays may impact you)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm bg-red-500" aria-hidden />
                <span className="text-[11px] text-slate-400">Higher risk (small buffer—consider alternate option)</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Colors reflect schedule buffer / reliability vs duty window — not seat availability.
            </p>
          </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
