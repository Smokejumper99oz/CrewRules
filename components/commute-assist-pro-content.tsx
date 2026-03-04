"use client";

import { useState, useEffect } from "react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { subMinutes, subDays, addDays } from "date-fns";
import type { CommuteFlightOption } from "@/lib/commute/providers/types";
import { parseAviationstackTs } from "@/lib/aviationstack";
import { getCommuteFlights } from "@/app/frontier/pilots/portal/commute/actions";
import type { CommuteFlight } from "@/lib/aviationstack";
import type { ScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";
import type { Profile } from "@/lib/profile";

function fmtHM(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function minutesBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
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
  profile: NonNullable<Profile>;
  displaySettings: ScheduleDisplaySettings;
  tenant: string;
  portal: string;
};

const PAGE_SIZE = 5;

const riskBorderStyles = {
  recommended: "border-l-4 border-l-emerald-500",
  risky: "border-l-4 border-l-amber-500",
  not_recommended: "border-l-4 border-l-red-500",
};

type DelayBanner =
  | { type: "cancelled" }
  | { type: "delayed"; wasTxt: string; nowTxt: string; delayMin: number; variant: "arrival" | "departure" }
  | null;

/** Arrival-first delay banner; falls back to departure when arrival data is weird. */
function computeDelayBanner(
  opt: CommuteFlightOption,
  originTz: string,
  destTz: string
): DelayBanner {
  if (opt.status === "cancelled") return { type: "cancelled" };
  const depTz = opt.originTz ?? originTz;
  const arrTz = opt.destTz ?? destTz;

  // 1) Try arrival delay
  const arrWasRaw = opt.arr_scheduled_raw;
  const arrNowRaw = opt.arr_actual_raw ?? opt.arr_estimated_raw;
  if (arrWasRaw && arrNowRaw) {
    const wasMs = parseAviationstackTs(arrWasRaw, arrTz).getTime();
    const nowMs = parseAviationstackTs(arrNowRaw, arrTz).getTime();
    if (!Number.isNaN(wasMs) && !Number.isNaN(nowMs)) {
      const delayMin = Math.round((nowMs - wasMs) / 60000);
      if (delayMin >= 1) {
        const wasTxt = formatInTimeZone(parseAviationstackTs(arrWasRaw, arrTz), arrTz, "HH:mm");
        const nowTxt = formatInTimeZone(parseAviationstackTs(arrNowRaw, arrTz), arrTz, "HH:mm");
        return { type: "delayed", wasTxt, nowTxt, delayMin, variant: "arrival" };
      }
    }
  }

  // 2) Fallback: departure delay
  const depWasRaw = opt.dep_scheduled_raw;
  const depNowRaw = opt.dep_actual_raw ?? opt.dep_estimated_raw;
  if (depWasRaw && depNowRaw) {
    const wasMs = parseAviationstackTs(depWasRaw, depTz).getTime();
    const nowMs = parseAviationstackTs(depNowRaw, depTz).getTime();
    if (!Number.isNaN(wasMs) && !Number.isNaN(nowMs)) {
      const delayMin = Math.round((nowMs - wasMs) / 60000);
      if (delayMin >= 1) {
        const wasTxt = formatInTimeZone(parseAviationstackTs(depWasRaw, depTz), depTz, "HH:mm");
        const nowTxt = formatInTimeZone(parseAviationstackTs(depNowRaw, depTz), depTz, "HH:mm");
        return { type: "delayed", wasTxt, nowTxt, delayMin, variant: "departure" };
      }
    }
  }

  return null;
}

function CommuteFlightCard({
  opt,
  baseTz,
  origin,
  destination,
  originTz,
  destTz,
}: {
  opt: CommuteFlightOption;
  baseTz: string;
  origin: string;
  destination: string;
  originTz: string;
  destTz: string;
}) {
  const depTz = opt.originTz ?? originTz;
  const arrTz = opt.destTz ?? destTz;
  const dep = new Date(opt.depUtc);
  const arr = new Date(opt.arrUtc);
  const dateStr = formatInTimeZone(dep, depTz, "EEE • MMM d");
  const depTime = formatInTimeZone(dep, depTz, "HH:mm");
  const arrTime = formatInTimeZone(arr, arrTz, "HH:mm");
  const flightLabel = `${opt.carrier} ${opt.flight ?? ""}`.trim();
  const delayBanner = computeDelayBanner(opt, originTz, destTz);

  return (
    <div
      className={`rounded-lg border border-slate-700/60 bg-slate-900/40 pl-3 pr-3 py-2.5 ${riskBorderStyles[opt.risk]}`}
    >
      {delayBanner && (
        <div
          className={`mb-2 rounded px-2 py-1 text-[11px] ${
            delayBanner.type === "cancelled"
              ? "border border-red-500/40 bg-red-500/10 text-red-200/90"
              : "border border-amber-500/40 bg-amber-500/10 text-amber-200/90"
          }`}
        >
          {delayBanner.type === "cancelled"
            ? "Cancelled"
            : delayBanner.variant === "departure"
              ? `Departure delayed ${delayBanner.delayMin}m / Was: ${delayBanner.wasTxt} – Now: ${delayBanner.nowTxt}`
              : `1st Leg Arrival Delayed ${delayBanner.delayMin}m / Was: ${delayBanner.wasTxt} – Now: ${delayBanner.nowTxt}`}
        </div>
      )}
      <div className="text-sm font-semibold text-slate-400">{dateStr}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-2xl font-bold tabular-nums text-slate-200">{depTime}</span>
        <span className="text-[11px] text-slate-500">{origin} → {destination}</span>
        <span className="text-2xl font-bold tabular-nums text-slate-200">{arrTime}</span>
      </div>
      <div className="text-xs text-slate-500 mt-1">{flightLabel}</div>
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
}: {
  opt: CommuteFlightOption;
  baseTz: string;
  origin: string;
  destination: string;
  originTz: string;
  destTz: string;
}) {
  const depTz = opt.originTz ?? originTz;
  const arrTz = opt.destTz ?? destTz;
  const dep = new Date(opt.depUtc);
  const arr = new Date(opt.arrUtc);
  const dateStr = formatInTimeZone(dep, depTz, "EEE • MMM d");
  const depTime = formatInTimeZone(dep, depTz, "HH:mm");
  const arrTime = formatInTimeZone(arr, arrTz, "HH:mm");
  const durMin = minutesBetween(opt.depUtc, opt.arrUtc);
  const durStr = fmtHM(durMin);
  const flightLabel = `${opt.carrier} ${opt.flight ?? ""}`.trim();
  const delayBanner = computeDelayBanner(opt, originTz, destTz);

  return (
    <div
      className={`rounded border border-slate-700/60 bg-slate-900/40 pl-3 pr-3 py-2 ${riskBorderStyles[opt.risk]}`}
    >
      {delayBanner && (
        <div
          className={`mb-1.5 rounded px-2 py-0.5 text-[11px] ${
            delayBanner.type === "cancelled"
              ? "border border-red-500/40 bg-red-500/10 text-red-200/90"
              : "border border-amber-500/40 bg-amber-500/10 text-amber-200/90"
          }`}
        >
          {delayBanner.type === "cancelled"
            ? "Cancelled"
            : delayBanner.variant === "departure"
              ? `Departure delayed ${delayBanner.delayMin}m / Was: ${delayBanner.wasTxt} – Now: ${delayBanner.nowTxt}`
              : `1st Leg Arrival Delayed ${delayBanner.delayMin}m / Was: ${delayBanner.wasTxt} – Now: ${delayBanner.nowTxt}`}
        </div>
      )}
      {/* Mobile: Row 1 — DEP left, ARR right (big); Row 2 — date • dur • carrier flt */}
      <div className="md:hidden">
        <div className="flex justify-between items-baseline">
          <span className="text-xl font-bold tabular-nums text-slate-200">{depTime}</span>
          <span className="text-xl font-bold tabular-nums text-slate-200">{arrTime}</span>
        </div>
        <div className="text-sm font-semibold text-slate-400 mt-0.5">
          <span>{dateStr}</span>
          <span className="font-normal text-slate-500"> • {durStr} • {flightLabel}</span>
        </div>
      </div>
      {/* Desktop: grid DATE | DEP | ARR | DUR | FLT */}
      <div className="hidden md:grid md:grid-cols-[auto_1fr_1fr_auto_auto] md:items-center md:gap-4">
        <span className="text-slate-400 text-sm font-semibold">{dateStr}</span>
        <span className="text-slate-200 font-semibold tabular-nums">{depTime}</span>
        <span className="text-slate-200 font-semibold tabular-nums">{arrTime}</span>
        <span className="text-slate-500 text-xs">{durStr}</span>
        <span className="text-slate-500 text-xs">{flightLabel}</span>
      </div>
    </div>
  );
}

export function CommuteAssistProContent({ event, profile, displaySettings, tenant, portal }: Props) {
  const [commuteError, setCommuteError] = useState<string | null>(null);
  const [commuteGroups, setCommuteGroups] = useState<Record<string, CommuteFlightOption[]>>({
    day_prior: [],
    same_day: [],
  });
  const [commuteMeta, setCommuteMeta] = useState<{
    showInfo: boolean;
    arriveByFormatted: string;
    dutyOk: boolean;
  } | null>(null);
  const [source, setSource] = useState<"live" | "scheduled" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dayPriorPage, setDayPriorPage] = useState(1);
  const [sameDayPage, setSameDayPage] = useState(1);
  const [viewMode, setViewMode] = useState<"cards" | "board">("cards");
  const [sortBy, setSortBy] = useState<"arrAsc" | "arrDesc" | "durAsc" | "durDesc">("arrAsc");
  const [originTz, setOriginTz] = useState<string>("UTC");
  const [destTz, setDestTz] = useState<string>("UTC");

  const baseTz = displaySettings.baseTimezone;
  const arrivalBuffer = profile?.commute_arrival_buffer_minutes ?? 60;

  const homeAirport = profile?.home_airport?.trim();
  const baseAirport = profile?.base_airport?.trim();
  const hasValidHome = !!homeAirport && homeAirport.length === 3;
  const hasValidBase = !!baseAirport && baseAirport.length === 3;
  const canUseCommute = hasValidHome && hasValidBase;

  const [direction, setDirection] = useState<"to_base" | "to_home">("to_base");
  const dutyStart = new Date(event.start_time);
  const dutyOk = !Number.isNaN(dutyStart.getTime());

  // Compute duty date/time in base timezone; use report_time if available.
  // When duty spans midnight (event starts late night, report is early morning), use the next
  // calendar day as the report date so commute = day prior to report, not day prior to event start.
  const dutyDateTime = (() => {
    if (!dutyOk) return new Date();
    if (event.report_time?.trim()) {
      const startDateStr = formatInTimeZone(dutyStart, baseTz, "yyyy-MM-dd");
      const startHour = parseInt(formatInTimeZone(dutyStart, baseTz, "HH"), 10);
      const reportTime = event.report_time.length === 5 ? `${event.report_time}:00` : event.report_time;
      const reportHour = parseInt(reportTime.slice(0, 2), 10) || 0;
      // Report is next day if event starts late (>=18) and report is early morning (<12)
      const reportDateStr =
        startHour >= 18 && reportHour < 12
          ? formatInTimeZone(addDays(dutyStart, 1), baseTz, "yyyy-MM-dd")
          : startDateStr;
      return fromZonedTime(`${reportDateStr}T${reportTime}`, baseTz);
    }
    return dutyStart;
  })();
  const dutyDateBase = formatInTimeZone(dutyDateTime, baseTz, "yyyy-MM-dd");
  const dayPriorBase = formatInTimeZone(subDays(dutyDateTime, 1), baseTz, "yyyy-MM-dd");
  const arriveBy = dutyOk ? subMinutes(dutyDateTime, arrivalBuffer) : null;

  const dutyStartAirport = parseDutyStartAirport(event.route);
  const dutyEndAirport = baseAirport ?? null;
  const dutyEndTime = event.end_time ? new Date(event.end_time) : null;
  const dutyEndDateBase = dutyEndTime && !Number.isNaN(dutyEndTime.getTime())
    ? formatInTimeZone(dutyEndTime, baseTz, "yyyy-MM-dd")
    : null;

  const { origin, destination, commuteDate } = (() => {
    if (direction === "to_base") {
      const dest = (dutyStartAirport ?? baseAirport)?.toUpperCase() ?? "";
      return {
        origin: homeAirport?.toUpperCase() ?? "",
        destination: dest,
        commuteDate: dutyOk ? dayPriorBase : new Date().toISOString().slice(0, 10),
      };
    }
    return {
      origin: (dutyEndAirport ?? baseAirport ?? "").toUpperCase(),
      destination: homeAirport?.toUpperCase() ?? "",
      commuteDate: dutyEndDateBase ?? new Date().toISOString().slice(0, 10),
    };
  })();

  const noCommuteNeeded =
    direction === "to_base" &&
    !!homeAirport &&
    !!dutyStartAirport &&
    dutyStartAirport.toUpperCase() === homeAirport.toUpperCase();

  async function loadFlights(opts?: { forceRefresh?: boolean }) {
    if (!canUseCommute) return null;
    if (origin.length !== 3 || destination.length !== 3) return null;

    if (process.env.NODE_ENV === "development") {
      const tpaFallback =
        (direction === "to_base" && origin === "TPA" && homeAirport?.toUpperCase() !== "TPA") ||
        (direction === "to_home" && destination === "TPA" && homeAirport?.toUpperCase() !== "TPA");
      const sjuFallback =
        direction === "to_home" &&
        origin === "SJU" &&
        (dutyEndAirport ?? baseAirport)?.toUpperCase() !== "SJU";
      if (tpaFallback || sjuFallback) {
        throw new Error("Commute Assist: TPA/SJU must not be used as fallbacks. Use profile.home_airport and profile.base_airport only.");
      }
    }

    try {
      setCommuteError(null);
      setNotice(null);
      if (opts?.forceRefresh) setRefreshing(true);

      const res = await getCommuteFlights({
        origin,
        destination,
        date: commuteDate,
        forceRefresh: opts?.forceRefresh ?? false,
      });

      const arriveByFormatted = arriveBy ? formatInTimeZone(arriveBy, baseTz, "HH:mm") : "";
      const showInfo = dutyOk;

      if (res.ok) {
        setOriginTz(res.originTz);
        setDestTz(res.destTz);
        const flights = res.flights;
        const reportAtIso = dutyOk ? dutyDateTime.toISOString() : `${dutyDateBase}T12:00:00Z`;

        const stripOffset = (s: string) => s.replace(/[+-]\d{2}:\d{2}$|Z$/i, "").trim();
        const isReturn = direction === "to_home";
        const options: CommuteFlightOption[] = (flights as CommuteFlight[]).map((f, i) => {
          const depTz = f.origin_tz ?? res.originTz;
          const arrTz = f.dest_tz ?? res.destTz;
          const depClean = stripOffset(f.departureTime);
          const arrClean = stripOffset(f.arrivalTime);
          const depUtc = fromZonedTime(depClean, depTz).toISOString();
          const arrUtc = fromZonedTime(arrClean, arrTz).toISOString();
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

          return {
            id: `${f.flightNumber}-${f.departureTime}-${i}`,
            carrier: f.carrier,
            flight: f.flightNumber.replace(f.carrier, "").trim() || f.flightNumber,
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
          };
        });

        const grouped: Record<string, CommuteFlightOption[]> = {
          day_prior: options,
          same_day: [],
        };

        const hasLiveTiming = options.some(
          (o) =>
            o.arr_estimated_raw ||
            o.arr_actual_raw ||
            o.dep_estimated_raw ||
            o.dep_actual_raw
        );
        setSource(hasLiveTiming ? "live" : "scheduled");

        setCommuteGroups(grouped);
        setCommuteMeta({ showInfo, arriveByFormatted, dutyOk });
        setNotice(res.notice ?? null);
        setDayPriorPage(1);
        setSameDayPage(1);
        return res.flights;
      } else {
        setNotice(res.message);
        setSource(null);
        setCommuteMeta({ showInfo, arriveByFormatted, dutyOk });
        return null;
      }
    } catch (err) {
      console.error("Commute Assist failed", err);
      setCommuteError("Commute Assist temporarily unavailable.");
      setSource(null);
      return null;
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (canUseCommute && !noCommuteNeeded) void loadFlights();
  }, [event.start_time, event.end_time, event.report_time, event.route, profile, displaySettings, tenant, portal, direction]);

  useEffect(() => {
    setDayPriorPage(1);
    setSameDayPage(1);
  }, [sortBy]);

  const dayPriorList = sortFlights(commuteGroups.day_prior ?? [], sortBy);
  const sameDayList = sortFlights(commuteGroups.same_day ?? [], sortBy);
  const dayPriorDisplayList = dayPriorList;
  const sameDayDisplayList = sameDayList;
  const dayPriorTotalPages = Math.max(1, Math.ceil(dayPriorDisplayList.length / PAGE_SIZE));
  const sameDayTotalPages = Math.max(1, Math.ceil(sameDayDisplayList.length / PAGE_SIZE));
  const dayPriorPageItems = dayPriorDisplayList.slice((dayPriorPage - 1) * PAGE_SIZE, dayPriorPage * PAGE_SIZE);
  const sameDayPageItems = sameDayDisplayList.slice((sameDayPage - 1) * PAGE_SIZE, sameDayPage * PAGE_SIZE);

  useEffect(() => {
    if (dayPriorDisplayList.length === 0) setDayPriorPage(1);
    else if (dayPriorPage > dayPriorTotalPages) setDayPriorPage(dayPriorTotalPages);
  }, [dayPriorDisplayList.length, dayPriorPage, dayPriorTotalPages]);

  useEffect(() => {
    if (sameDayDisplayList.length === 0) setSameDayPage(1);
    else if (sameDayPage > sameDayTotalPages) setSameDayPage(sameDayTotalPages);
  }, [sameDayDisplayList.length, sameDayPage, sameDayTotalPages]);

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
        <p className="text-sm text-slate-300">
          {origin} → {destination}
        </p>
        <p className="text-xs text-amber-200/90">{commuteError}</p>
      </div>
    );
  }

  if (!commuteMeta) {
    return (
      <div className="mt-3 space-y-2">
        <p className="text-sm text-slate-300">
          {origin} → {destination}
        </p>
        <p className="text-xs text-slate-500">Loading commute options…</p>
      </div>
    );
  }

  const { showInfo, arriveByFormatted } = commuteMeta;
  // Parse commuteDate as local date in baseTz (noon avoids UTC-midnight → wrong-day display)
  const commuteDateObj = fromZonedTime(`${commuteDate}T12:00:00`, baseTz);
  const commuteDateFormatted = formatInTimeZone(commuteDateObj, baseTz, "EEE MMM d, yyyy");
  const tzMissing = originTz === "UTC" || destTz === "UTC";
  const commuteWindowLabel = direction === "to_base"
    ? (dutyOk ? "Commute window: Day prior" : "Search window: Same-day flights")
    : (dutyEndDateBase ? "Commute window: Day of release" : "Search window: Same-day flights");

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex rounded border border-slate-700/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setDirection("to_base")}
              className={`px-2 py-1 text-[11px] ${direction === "to_base" ? "bg-slate-600 text-white" : "text-slate-400 hover:bg-slate-800/60"}`}
            >
              To base
            </button>
            <button
              type="button"
              onClick={() => setDirection("to_home")}
              className={`px-2 py-1 text-[11px] ${direction === "to_home" ? "bg-slate-600 text-white" : "text-slate-400 hover:bg-slate-800/60"}`}
            >
              Return home
            </button>
          </div>
          <p className="text-sm text-slate-300">
            {origin} → {destination}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded border border-slate-700/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`px-2 py-1 text-[11px] ${viewMode === "cards" ? "bg-slate-600 text-white" : "text-slate-400 hover:bg-slate-800/60"}`}
            >
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode("board")}
              className={`px-2 py-1 text-[11px] ${viewMode === "board" ? "bg-slate-600 text-white" : "text-slate-400 hover:bg-slate-800/60"}`}
            >
              Board
            </button>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "arrAsc" | "arrDesc" | "durAsc" | "durDesc")}
            className="rounded border border-slate-700/60 bg-slate-900/60 text-xs text-slate-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-500"
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
            onClick={() => void loadFlights({ forceRefresh: true })}
            disabled={refreshing}
            className="rounded-full border border-slate-700/60 bg-slate-900/40 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-900/70 disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
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
            Commute date: {commuteDateFormatted}
          </p>
          <p className="text-xs text-slate-400">
            {commuteWindowLabel}
          </p>
          {direction === "to_base" && (
            <p className="text-xs text-slate-400">
              Arrive by: {arriveByFormatted} (base)
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-slate-400">Commute timing unavailable for this event.</p>
      )}
      {dutyOk && (
        <div className="space-y-4">
          {tzMissing && (
            <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
              Timezone data missing for {origin} or {destination}. Ask an admin to add it in Airports.
            </div>
          )}
          {(!dayPriorList.length && !sameDayList.length) ? (
            <p className="text-xs text-slate-500">No commute options found in this window.</p>
          ) : (
            <>
              {dayPriorList.length ? (
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Day prior</p>
                  <div className="space-y-2">
                    {dayPriorPageItems.map((opt, idx) =>
                      viewMode === "cards" ? (
                        <CommuteFlightCard
                          key={opt.id}
                          opt={opt}
                          baseTz={baseTz}
                          origin={origin}
                          destination={destination}
                          originTz={originTz}
                          destTz={destTz}
                        />
                      ) : (
                        <CommuteFlightRow
                          key={opt.id}
                          opt={opt}
                          baseTz={baseTz}
                          origin={origin}
                          destination={destination}
                          originTz={originTz}
                          destTz={destTz}
                        />
                      )
                    )}
                  </div>
                  {dayPriorTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setDayPriorPage((p) => Math.max(1, p - 1))}
                        disabled={dayPriorPage <= 1}
                        className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Prev
                      </button>
                      {Array.from({ length: dayPriorTotalPages }, (_, i) => i + 1).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setDayPriorPage(p)}
                          className={`rounded px-2 py-1 text-xs ${p === dayPriorPage ? "bg-slate-600 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}
                        >
                          {p}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setDayPriorPage((p) => Math.min(dayPriorTotalPages, p + 1))}
                        disabled={dayPriorPage >= dayPriorTotalPages}
                        className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
              {sameDayList.length ? (
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Day of (before duty)</p>
                  <div className="space-y-2">
                    {sameDayPageItems.map((opt, idx) =>
                      viewMode === "cards" ? (
                        <CommuteFlightCard
                          key={opt.id}
                          opt={opt}
                          baseTz={baseTz}
                          origin={origin}
                          destination={destination}
                          originTz={originTz}
                          destTz={destTz}
                        />
                      ) : (
                        <CommuteFlightRow
                          key={opt.id}
                          opt={opt}
                          baseTz={baseTz}
                          origin={origin}
                          destination={destination}
                          originTz={originTz}
                          destTz={destTz}
                        />
                      )
                    )}
                  </div>
                  {sameDayTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSameDayPage((p) => Math.max(1, p - 1))}
                        disabled={sameDayPage <= 1}
                        className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Prev
                      </button>
                      {Array.from({ length: sameDayTotalPages }, (_, i) => i + 1).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setSameDayPage(p)}
                          className={`rounded px-2 py-1 text-xs ${p === sameDayPage ? "bg-slate-600 text-white" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}
                        >
                          {p}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSameDayPage((p) => Math.min(sameDayTotalPages, p + 1))}
                        disabled={sameDayPage >= sameDayTotalPages}
                        className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </>
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
