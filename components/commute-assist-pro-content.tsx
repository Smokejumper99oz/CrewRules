"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { subMinutes, subDays, addDays } from "date-fns";
import type { CommuteFlightOption } from "@/lib/commute/providers/types";
import { parseAviationstackTs } from "@/lib/aviationstack";
import { getCommuteFlights } from "@/app/frontier/pilots/portal/commute/actions";
import type { CommuteFlight } from "@/lib/aviationstack";
import type { ScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";
import type { Profile } from "@/lib/profile";
import { AirlineLogo } from "@/components/airline-logo";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";

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

function parseDutyStartAirport(route?: string | null): string | null {
  if (!route) return null;
  const m = route.toUpperCase().match(/([A-Z]{3})\s*(?:→|->|-)/);
  return m?.[1] ?? null;
}

function sortFlights(
  list: CommuteFlightOption[],
  sortBy: "arrAsc" | "arrDesc" | "durAsc" | "durDesc"
): CommuteFlightOption[] {
  return [...list].sort((a, b) => {
    const arrA = new Date(a.arrUtc).getTime();
    const arrB = new Date(b.arrUtc).getTime();
    const depA = new Date(a.depUtc).getTime();
    const depB = new Date(b.depUtc).getTime();
    const durA = arrA - depA;
    const durB = arrB - depB;
    if (sortBy === "arrAsc") return arrA - arrB;
    if (sortBy === "arrDesc") return arrB - arrA;
    if (sortBy === "durAsc") return durA - durB;
    return durB - durA; // durDesc
  });
}

type Props = {
  event: { start_time: string; end_time?: string; report_time?: string | null; route?: string | null };
  label?: "on_duty" | "later_today" | "next_duty";
  profile: NonNullable<Profile>;
  displaySettings: ScheduleDisplaySettings;
  tenant: string;
  portal: string;
  /** When set, use as duty date for to_base (dayPriorBase = displayDateStr - 1). */
  displayDateStr?: string | null;
  /** When true, show to_home (return when pairing ends); when false, show to_base (commute to duty). */
  isInPairing?: boolean;
  /** When set (e.g. from legsToShow[0].origin), use as duty start airport for to_base. */
  dutyStartAirportOverride?: string | null;
  /** When set (e.g. 05:15 when out of base = first leg dep - 45 min), use for arrive-by. */
  reportTimeOverride?: string | null;
};

const PAGE_SIZE = 5;

/** Client cache TTL: 15 minutes. Avoids API calls when navigating back to Dashboard. */
const COMMUTE_CACHE_TTL_MS = 15 * 60 * 1000;
const COMMUTE_CACHE_PREFIX = "crewrules_commute_";

function getCommuteCacheKey(origin: string, destination: string, date: string, direction: string): string {
  return `${COMMUTE_CACHE_PREFIX}${origin}_${destination}_${date}_${direction}`;
}

function getCommuteCache(key: string): { flights: CommuteFlight[]; originTz: string; destTz: string; fetchedAt: string | null; notice: string | null } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { flights, originTz, destTz, fetchedAt, notice, cachedAt } = JSON.parse(raw);
    if (Date.now() - cachedAt > COMMUTE_CACHE_TTL_MS) return null;
    return { flights, originTz, destTz, fetchedAt, notice };
  } catch {
    return null;
  }
}

function setCommuteCache(key: string, data: { flights: CommuteFlight[]; originTz: string; destTz: string; fetchedAt: string | null; notice: string | null }) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ ...data, cachedAt: Date.now() }));
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

/** Inline delay/cancel display: original crossed out, new time below (amber for delay, red for cancel). */
type DelayInfo = {
  cancelled: boolean;
  dep?: { scheduled: string; actual: string };
  arr?: { scheduled: string; actual: string };
};

function computeDelayInfo(
  opt: CommuteFlightOption,
  originTz: string,
  destTz: string
): DelayInfo {
  const depTz = opt.originTz ?? originTz;
  const arrTz = opt.destTz ?? destTz;

  if (opt.status === "cancelled") {
    const depSched = opt.dep_scheduled_raw
      ? formatInTimeZone(parseAviationstackTs(opt.dep_scheduled_raw, depTz), depTz, "HH:mm")
      : formatInTimeZone(new Date(opt.depUtc), depTz, "HH:mm");
    const arrSched = opt.arr_scheduled_raw
      ? formatInTimeZone(parseAviationstackTs(opt.arr_scheduled_raw, arrTz), arrTz, "HH:mm")
      : formatInTimeZone(new Date(opt.arrUtc), arrTz, "HH:mm");
    return { cancelled: true, dep: { scheduled: depSched, actual: depSched }, arr: { scheduled: arrSched, actual: arrSched } };
  }

  const result: DelayInfo = { cancelled: false };

  const depWasRaw = opt.dep_scheduled_raw;
  const depNowRaw = opt.dep_actual_raw ?? opt.dep_estimated_raw;
  if (depWasRaw && depNowRaw) {
    const wasMs = parseAviationstackTs(depWasRaw, depTz).getTime();
    const nowMs = parseAviationstackTs(depNowRaw, depTz).getTime();
    if (!Number.isNaN(wasMs) && !Number.isNaN(nowMs) && nowMs - wasMs >= 60000) {
      result.dep = {
        scheduled: formatInTimeZone(parseAviationstackTs(depWasRaw, depTz), depTz, "HH:mm"),
        actual: formatInTimeZone(parseAviationstackTs(depNowRaw, depTz), depTz, "HH:mm"),
      };
    }
  }

  const arrWasRaw = opt.arr_scheduled_raw;
  const arrNowRaw = opt.arr_actual_raw ?? opt.arr_estimated_raw;
  if (arrWasRaw && arrNowRaw) {
    const wasMs = parseAviationstackTs(arrWasRaw, arrTz).getTime();
    const nowMs = parseAviationstackTs(arrNowRaw, arrTz).getTime();
    if (!Number.isNaN(wasMs) && !Number.isNaN(nowMs) && nowMs - wasMs >= 60000) {
      result.arr = {
        scheduled: formatInTimeZone(parseAviationstackTs(arrWasRaw, arrTz), arrTz, "HH:mm"),
        actual: formatInTimeZone(parseAviationstackTs(arrNowRaw, arrTz), arrTz, "HH:mm"),
      };
    }
  }

  return result;
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
  const dateStr = formatInTimeZone(dep, depTz, "EEE • MMM d");
  const depSched = formatInTimeZone(dep, depTz, "HH:mm");
  const arrSched = formatInTimeZone(arr, arrTz, "HH:mm");
  const durMin = durationMinutesUtc(opt.depUtc, opt.arrUtc);
  const durStr = fmtHM(durMin);
  const flightLabel = formatFlightLabel(opt.carrier, opt.flight);
  const delayInfo = computeDelayInfo(opt, depTz, arrTz);

  const depDisplay = delayInfo.dep ?? { scheduled: depSched, actual: undefined };
  const arrDisplay = delayInfo.arr ?? { scheduled: arrSched, actual: undefined };
  const depDateStr = formatInTimeZone(dep, depTz, "yyyy-MM-dd");
  const arrDateStr = formatInTimeZone(arr, arrTz, "yyyy-MM-dd");
  const arrivesNextDay = arrDateStr > depDateStr;

  return (
    <div
      className={`rounded-lg border border-slate-700/60 bg-slate-900/40 pl-3 pr-3 py-2.5 ${riskBorderStyles[opt.risk]}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-400">{dateStr}</span>
        <span
          className={[
            "px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase",
            delayInfo.cancelled
              ? "bg-red-500/20 text-red-400 border border-red-500/40"
              : (delayInfo.dep || delayInfo.arr)
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                : "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30",
          ].join(" ")}
        >
          {delayInfo.cancelled ? "Cancelled" : (delayInfo.dep || delayInfo.arr) ? "Delayed" : "On time"}
        </span>
      </div>
      <div className="flex items-baseline gap-2 mt-1">
        <div className="flex flex-col items-start">
          <TimeBlock
            scheduled={depDisplay.scheduled}
            actual={depDisplay.actual}
            isDelayed={!!delayInfo.dep}
            isCancelled={delayInfo.cancelled}
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
            isDelayed={!!delayInfo.arr}
            isCancelled={delayInfo.cancelled}
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
        {delayInfo.cancelled && (
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
  const dateStr = formatInTimeZone(dep, depTz, "EEE • MMM d");
  const depSched = formatInTimeZone(dep, depTz, "HH:mm");
  const arrSched = formatInTimeZone(arr, arrTz, "HH:mm");
  const durMin = durationMinutesUtc(opt.depUtc, opt.arrUtc);
  const durStr = fmtHM(durMin);
  const flightLabel = formatFlightLabel(opt.carrier, opt.flight);
  const delayInfo = computeDelayInfo(opt, depTz, arrTz);

  const depDisplay = delayInfo.dep ?? { scheduled: depSched, actual: undefined };
  const arrDisplay = delayInfo.arr ?? { scheduled: arrSched, actual: undefined };
  const depDateStr = formatInTimeZone(dep, depTz, "yyyy-MM-dd");
  const arrDateStr = formatInTimeZone(arr, arrTz, "yyyy-MM-dd");
  const arrivesNextDay = arrDateStr > depDateStr;

  const carrierForLogo = (opt.carrier || flightLabel.match(/^([A-Z0-9]{2})/)?.[1]) ?? "";
  const flightLine = (
    <>
      <AirlineLogo carrier={carrierForLogo} size={20} />
      <span className="font-mono tabular-nums font-medium text-slate-300">{flightLabel}</span>
      {delayInfo.cancelled && <><span className="text-slate-500"> </span><span className="text-red-400 font-semibold">Cancelled</span></>}
    </>
  );

  const statusBadge = (
    <span
      className={[
        "px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase",
        delayInfo.cancelled
          ? "bg-red-500/20 text-red-400 border border-red-500/40"
          : (delayInfo.dep || delayInfo.arr)
            ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
            : "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30",
      ].join(" ")}
    >
      {delayInfo.cancelled ? "Cancelled" : (delayInfo.dep || delayInfo.arr) ? "Delayed" : "On time"}
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
              isDelayed={!!delayInfo.dep}
              isCancelled={delayInfo.cancelled}
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
              isDelayed={!!delayInfo.arr}
              isCancelled={delayInfo.cancelled}
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
              isDelayed={!!delayInfo.dep}
              isCancelled={delayInfo.cancelled}
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
              isDelayed={!!delayInfo.arr}
              isCancelled={delayInfo.cancelled}
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

export function CommuteAssistProContent({ event, label, profile, displaySettings, tenant, portal, displayDateStr, isInPairing, dutyStartAirportOverride, reportTimeOverride }: Props) {
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
  const [refreshing, setRefreshing] = useState(false);
  const [homePage, setHomePage] = useState(1);
  const [alternatePage, setAlternatePage] = useState(1);
  const cardsTopRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"cards" | "board">("cards");
  const [sortBy, setSortBy] = useState<"arrAsc" | "arrDesc" | "durAsc" | "durDesc">("arrAsc");
  const [originTz, setOriginTz] = useState<string>("UTC");
  const [destTz, setDestTz] = useState<string>("UTC");

  const baseTz = displaySettings.baseTimezone;
  const arrivalBuffer = profile?.commute_arrival_buffer_minutes ?? 60;

  const homeAirport = profile?.home_airport?.trim();
  const alternateHomeAirport = profile?.alternate_home_airport?.trim();
  const baseAirport = profile?.base_airport?.trim();
  const hasValidHome = !!homeAirport && homeAirport.length === 3;
  const hasValidBase = !!baseAirport && baseAirport.length === 3;
  const canUseCommute = hasValidHome && hasValidBase;

  const direction = isInPairing !== undefined
    ? (isInPairing ? "to_home" : "to_base")
    : (label === "on_duty" ? "to_home" : "to_base");
  const dutyStart = new Date(event.start_time);
  const dutyOk = !Number.isNaN(dutyStart.getTime());

  // When displayDateStr is set (e.g. next duty's date), use it for to_base commute date.
  // dayPriorBase = day before duty start (fly in the day before to report).
  const dayPriorBase = (() => {
    if (direction === "to_base" && displayDateStr?.trim()) {
      const dutyDate = fromZonedTime(`${displayDateStr.trim()}T12:00:00`, baseTz);
      return formatInTimeZone(subDays(dutyDate, 1), baseTz, "yyyy-MM-dd");
    }
    if (!dutyOk) return new Date().toISOString().slice(0, 10);
    const dutyDateTime = (() => {
      if (event.report_time?.trim()) {
        const startDateStr = formatInTimeZone(dutyStart, baseTz, "yyyy-MM-dd");
        const startHour = parseInt(formatInTimeZone(dutyStart, baseTz, "HH"), 10);
        const reportTime = event.report_time.length === 5 ? `${event.report_time}:00` : event.report_time;
        const reportHour = parseInt(reportTime.slice(0, 2), 10) || 0;
        const reportDateStr =
          startHour >= 18 && reportHour < 12
            ? formatInTimeZone(addDays(dutyStart, 1), baseTz, "yyyy-MM-dd")
            : startDateStr;
        return fromZonedTime(`${reportDateStr}T${reportTime}`, baseTz);
      }
      return dutyStart;
    })();
    return formatInTimeZone(subDays(dutyDateTime, 1), baseTz, "yyyy-MM-dd");
  })();

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

  const dutyStartAirport = dutyStartAirportOverride?.trim() || parseDutyStartAirport(event.route);
  const dutyEndAirport = baseAirport ?? null;
  const dutyEndTime = event.end_time ? new Date(event.end_time) : null;
  const dutyEndDateBase = dutyEndTime && !Number.isNaN(dutyEndTime.getTime())
    ? formatInTimeZone(dutyEndTime, baseTz, "yyyy-MM-dd")
    : null;

  /** Routes to search: [{ origin, destination, label }]. label = "home" | "alternate" */
  const routes = useMemo(() => {
    const commuteDate =
      direction === "to_base"
        ? dutyOk ? dayPriorBase : new Date().toISOString().slice(0, 10)
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
    direction,
    homeAirport,
    alternateHomeAirport,
    baseAirport,
    dutyStartAirport,
    dutyEndAirport,
    dutyOk,
    dayPriorBase,
    dutyEndDateBase,
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
      const stripOffset = (s: string) => s.replace(/[+-]\d{2}:\d{2}$|Z$/i, "").trim();
      const isReturn = direction === "to_home";
      const releaseEarliestDepIso =
        isReturn && event.end_time
          ? roundDownToHour(event.end_time, baseTz)
          : null;
      const options: CommuteFlightOption[] = [];
      console.log("[Commute Assist] applyFlightsToState called\n" + JSON.stringify({
        destinationLabel,
        rawFlightsCount: flights.length,
        firstFlightDep: flights[0]?.departureTime,
        firstFlightArr: flights[0]?.arrivalTime,
      }, null, 2));
      for (let i = 0; i < flights.length; i++) {
        const f = flights[i];
        const depTz = f.origin_tz ?? originTzVal;
        const arrTz = f.dest_tz ?? destTzVal;
        const depRaw = f.departureTime ?? "";
        const arrRaw = f.arrivalTime ?? "";
        const depClean = stripOffset(depRaw);
        const arrClean = stripOffset(arrRaw);
        if (!depClean || !arrClean) continue;
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
          continue;
        }
        if (releaseEarliestDepIso && depUtc < releaseEarliestDepIso) continue;
        let risk: "recommended" | "risky" | "not_recommended" = "recommended";
        let reason = "";
        if (isReturn) {
          reason = `Return home • ${fmtHM(f.durationMinutes)}`;
        } else {
          const bufferMin = minutesBetween(arrUtc, reportAtIso);
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
        options.push({
          id: `${destinationLabel}-${f.flightNumber}-${f.departureTime}-${i}`,
          carrier: f.carrier,
          flight: stripCarrierFromFlight(f.flightNumber, f.carrier),
          depUtc,
          arrUtc,
          nonstop: true,
          risk,
          reason,
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
        });
      }
      const hasLiveTiming = options.some(
        (o) => o.arr_estimated_raw || o.arr_actual_raw || o.dep_estimated_raw || o.dep_actual_raw
      );
      const arriveByFormatted = dutyOkLocal ? formatInTimeZone(subMinutes(dutyStart, arrivalBuffer), baseTz, "HH:mm") : "";
      console.log("[Commute Assist] options before setState\n" + JSON.stringify({
        destinationLabel,
        optionsCount: options.length,
        skipped: flights.length - options.length,
      }, null, 2));
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
        if (opts?.forceRefresh) {
          setRefreshing(true);
          setCommuteGroups({ home: [], alternate: [] });
        }

        const fetchOne = async (route: (typeof routes)[0]) => {
          const cacheKey = getCommuteCacheKey(route.origin, route.destination, route.commuteDate, direction);
          if (!opts?.forceRefresh) {
            const cached = getCommuteCache(cacheKey);
            if (cached) {
              applyFlightsToState(cached.flights, cached.originTz, cached.destTz, cached.fetchedAt, cached.notice, route.label);
              return cached.flights;
            }
          }
          const res = await getCommuteFlights({
            origin: route.origin,
            destination: route.destination,
            date: route.commuteDate,
            forceRefresh: opts?.forceRefresh ?? false,
          });
          if (res.ok) {
            applyFlightsToState(res.flights, res.originTz, res.destTz, res.fetchedAt ?? null, res.notice ?? null, route.label);
            setCommuteCache(cacheKey, {
              flights: res.flights,
              originTz: res.originTz,
              destTz: res.destTz,
              fetchedAt: res.fetchedAt ?? null,
              notice: res.notice ?? null,
            });
            return res.flights;
          }
          setNotice(res.message);
          return null;
        };

        console.log("[Commute Assist] BEFORE Promise.all\n" + JSON.stringify({
          direction,
          routes: routes.map((r) => ({
            origin: r.origin,
            destination: r.destination,
            commuteDate: r.commuteDate,
            label: r.label,
          })),
        }, null, 2));
        const results = await Promise.all(routes.map(fetchOne));
        routes.forEach((route, idx) => {
          const res = results[idx];
          const flights = Array.isArray(res) ? res : [];
          const first3 = flights.slice(0, 3).map((f) =>
            f ? `${(f as any).carrier}${(f as any).flightNumber}-${(f as any).departureTime}` : null
          );
          console.log("[Commute Assist] ROUTE RESULT\n" + JSON.stringify({
            destination: route.destination,
            label: route.label,
            ok: Array.isArray(res),
            flightCount: flights.length,
            first3Ids: first3,
          }, null, 2));
        });
        const dutyStart = new Date(event.start_time);
        const arriveByFormatted = dutyOk ? formatInTimeZone(subMinutes(dutyStart, arrivalBuffer), baseTz, "HH:mm") : "";
        setCommuteMeta({ showInfo: dutyOk, arriveByFormatted, dutyOk });
        if (results.every((r) => r === null) && routes.length > 0) {
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

  useEffect(() => {
    if (canUseCommute && !noCommuteNeeded) {
      loadFlights().catch((err) => {
        console.error("Commute Assist loadFlights failed", err);
        setCommuteError("Commute Assist temporarily unavailable.");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadFlights omitted to avoid infinite loop; we re-run when routes change
  }, [routes, direction, canUseCommute, noCommuteNeeded]);

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
      ? homeList.reduce((best, f) =>
          new Date(f.depUtc).getTime() > new Date(best.depUtc).getTime() ? f : best
        ).id
      : null;
  const alternateLastFlightId =
    alternateList.length > 0
      ? alternateList.reduce((best, f) =>
          new Date(f.depUtc).getTime() > new Date(best.depUtc).getTime() ? f : best
        ).id
      : null;
  const homeTotalPages = Math.max(1, Math.ceil(homeList.length / PAGE_SIZE));
  const alternateTotalPages = Math.max(1, Math.ceil(alternateList.length / PAGE_SIZE));
  const homePageItems = homeList.slice((homePage - 1) * PAGE_SIZE, homePage * PAGE_SIZE);
  const alternatePageItems = alternateList.slice((alternatePage - 1) * PAGE_SIZE, alternatePage * PAGE_SIZE);

  useEffect(() => {
    if (homeList.length === 0) setHomePage(1);
    else if (homePage > homeTotalPages) setHomePage(homeTotalPages);
  }, [homeList.length, homePage, homeTotalPages]);

  useEffect(() => {
    if (alternateList.length === 0) setAlternatePage(1);
    else if (alternatePage > alternateTotalPages) setAlternatePage(alternateTotalPages);
  }, [alternateList.length, alternatePage, alternateTotalPages]);

  const didPaginateRef = useRef(false);
  useEffect(() => {
    if (!didPaginateRef.current) {
      didPaginateRef.current = true;
      return;
    }
    cardsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [homePage, alternatePage]);

  const primaryRoute = routes[0];
  const displayOrigin = primaryRoute?.origin ?? "";
  const displayDestination = primaryRoute?.destination ?? "";

  if (!hasValidHome) {
    return (
      <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
        Set Home Airport (3-letter IATA) in Profile to use Commute Assist.
      </div>
    );
  }

  if (!hasValidBase) {
    return (
      <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200/90">
        Set Crew Base (3-letter IATA) in Profile to use Commute Assist.
      </div>
    );
  }

  if (noCommuteNeeded) {
    return (
      <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200/90">
        No commute needed — duty starts at your home airport.
      </div>
    );
  }

  if (commuteError) {
    return (
      <div className="mt-3 space-y-2">
        <div className="text-sm text-slate-300 space-y-0.5">
          {routes.map((r) => (
            <p key={r.label}>
              {r.label === "home" ? "🏠" : "🅰️"} {r.origin} → {r.destination} • {r.label === "home" ? "Home Airport" : "Alternate Option"}
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
          {routes.map((r) => (
            <p key={r.label}>
              {r.label === "home" ? "🏠" : "🅰️"} {r.origin} → {r.destination} • {r.label === "home" ? "Home Airport" : "Alternate Option"}
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
  const commuteDateFormatted = formatInTimeZone(commuteDateObj, baseTz, "EEE MMM d, yyyy");
  const tzMissing = originTz === "UTC" || destTz === "UTC";
  const commuteWindowValue = direction === "to_base"
    ? (dutyOk ? "Day Prior" : "Same-day flights")
    : (dutyEndDateBase ? "Day of Release" : "Same-day flights");

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          {routes.map((r) => (
            <p key={r.label} className="text-base font-medium text-slate-300">
              {r.label === "home" ? "🏠" : "🅰️"} {r.origin} → {r.destination} • {r.label === "home" ? "Home Airport" : "Alternate Option"}
            </p>
          ))}
        </div>
        <div className="flex items-center gap-2">
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
            onClick={() => loadFlights({ forceRefresh: true }).catch((err) => { console.error("Commute Assist refresh failed", err); setCommuteError("Refresh failed."); })}
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
        </div>
      </div>
      {notice && (
        <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {notice}
        </div>
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
      {dutyOk && (
        <div className="mt-6 space-y-4">
          {tzMissing && (
            <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
              Timezone data missing for route. Ask an admin to add it in Airports.
            </div>
          )}
          {(() => {
            console.log("[Commute Assist] EMPTY CHECK\n" + JSON.stringify({
              commuteGroupsHomeLength: (commuteGroups.home ?? []).length,
              commuteGroupsAlternateLength: (commuteGroups.alternate ?? []).length,
              homeListLength: homeList.length,
              alternateListLength: alternateList.length,
              isEmpty: !homeList.length && !alternateList.length,
            }, null, 2));
            return null;
          })()}
          {!homeList.length && !alternateList.length ? (
            <p className="text-xs text-slate-500">No commute options found in this window.</p>
          ) : (
            <div ref={cardsTopRef} className="space-y-6">
              {homeList.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-300">
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
                  <p className="text-sm font-semibold text-slate-300">
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
        </div>
      )}
    </div>
  );
}
