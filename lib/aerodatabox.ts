/**
 * AerodataBox API client for flight data (via RapidAPI).
 * FIDS endpoint: airport departures filtered by destination.
 * API requires time window: positive, max 12 hours.
 * @see https://doc.aerodatabox.com/rapidapi.html
 */

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { CommuteFlight, FetchFlightsResult } from "@/lib/aviationstack";
import { getRouteTzs } from "@/lib/airports";

/** Serializes AeroDataBox calls so multiple routes are not fetched in parallel. */
let adbQueue = Promise.resolve<FetchFlightsResult>({ flights: [] });

/** Minimum ms between AeroDataBox HTTP requests (windows + routes). */
const ADB_REQUEST_DELAY_MS = 1500;
let lastAdbRequestAt = 0;

async function waitBeforeAdbRequest(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastAdbRequestAt;
  if (elapsed < ADB_REQUEST_DELAY_MS && lastAdbRequestAt > 0) {
    await new Promise((r) => setTimeout(r, ADB_REQUEST_DELAY_MS - elapsed));
  }
  lastAdbRequestAt = Date.now();
}

function formatLocalForApi(d: Date, tz: string): string {
  return formatInTimeZone(d, tz, "yyyy-MM-dd'T'HH:mm");
}

/** Strip timezone offset from timestamp. Coerce non-strings safely. */
function stripOffset(s: unknown): string {
  if (s == null) return "";
  let str: string;
  if (typeof s === "string") str = s;
  else if (s instanceof Date) str = s.toISOString();
  else str = String(s);
  return str.replace(/[+-]\d{2}:\d{2}$|Z$/i, "").trim();
}

function calculateDurationMinutes(depUtc: string, arrUtc: string): number {
  const depMs = new Date(depUtc).getTime();
  const arrMs = new Date(arrUtc).getTime();
  return Math.max(0, Math.round((arrMs - depMs) / 60000));
}

/** Extract IATA from nested airport object. */
function getIata(obj: unknown): string {
  if (!obj || typeof obj !== "object") return "";
  const o = obj as Record<string, unknown>;
  const code = o.iataCode ?? o.iata ?? (o.airport && getIata(o.airport));
  return typeof code === "string" ? code.toUpperCase() : "";
}

function hasOffsetOrZ(s: string): boolean {
  return !!(s?.trim() && (s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s)));
}

/**
 * Extract time from movement object and normalize to UTC ISO string.
 * Prefer local (scheduledTimeLocal, scheduledTime.local) then UTC (scheduledTime.utc, or string with Z/offset).
 * Ensures downstream always receives UTC ISO strings.
 */
function getTimeAsUtc(obj: unknown, tz: string): string {
  if (!obj || typeof obj !== "object") return "";
  const o = obj as Record<string, unknown>;
  const raw =
    o.scheduledTimeLocal ??
    o.scheduledTime ??
    o.ScheduledTime ??
    o.scheduled ??
    o.estimatedTime ??
    o.actualTime;

  let localVal: string | undefined;
  let utcVal: string | undefined;

  if (typeof raw === "string") {
    if (hasOffsetOrZ(raw)) {
      utcVal = raw;
    } else {
      localVal = raw;
    }
  } else if (raw && typeof raw === "object") {
    const dt = raw as Record<string, unknown>;
    const local = dt.local ?? dt.Local;
    const utc = dt.utc ?? dt.Utc;
    if (typeof local === "string") localVal = local;
    if (typeof utc === "string") utcVal = utc;
  }

  if (localVal) {
    try {
      return fromZonedTime(stripOffset(localVal), tz).toISOString();
    } catch {
      if (utcVal) return new Date(utcVal).toISOString();
      return "";
    }
  }
  if (utcVal) return new Date(utcVal).toISOString();
  return "";
}

/** Return local time string for _raw fields (delay display). Prefer explicit local. */
function getLocalTimeForRaw(obj: unknown): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  const raw = o.scheduledTimeLocal ?? o.scheduledTime ?? o.ScheduledTime ?? o.scheduled;
  if (typeof raw === "string" && !hasOffsetOrZ(raw)) return raw;
  if (raw && typeof raw === "object") {
    const dt = raw as Record<string, unknown>;
    const local = dt.local ?? dt.Local;
    if (typeof local === "string") return local;
  }
  return undefined;
}

/**
 * Fetch flights from AerodataBox FIDS (airport departures).
 * Returns flights from origin to destination on the given date.
 * Serialized so multiple routes are not called in parallel (avoids rate limit).
 */
export async function fetchFlightsFromAerodataBox(
  origin: string,
  destination: string,
  date: string
): Promise<FetchFlightsResult> {
  const prev = adbQueue;
  adbQueue = prev.then(() => fetchFlightsFromAerodataBoxImpl(origin, destination, date));
  return adbQueue;
}

async function fetchFlightsFromAerodataBoxImpl(
  origin: string,
  destination: string,
  date: string
): Promise<FetchFlightsResult> {
  try {
    const apiKey = process.env.RAPIDAPI_KEY;
    const host =
      process.env.AERODATABOX_RAPIDAPI_HOST ?? "aerodatabox.p.rapidapi.com";

    if (!apiKey) {
      return { flights: [] };
    }

    const { originTz, destTz } = await getRouteTzs(origin, destination);

    // AeroDataBox FIDS requires: positive window, max 12 hours. Clamp each request.
    const MAX_HOURS = 12;
    const dateStr = date.slice(0, 10);
    const startOfDay = fromZonedTime(`${dateStr}T00:00:00`, originTz);
    const endOfDay = fromZonedTime(`${dateStr}T23:59:00`, originTz);

    const windows: { start: Date; end: Date; fromLocal: string; toLocal: string }[] = [];
    let windowStart = startOfDay.getTime();
    const endOfDayMs = endOfDay.getTime();

    while (windowStart < endOfDayMs) {
      const maxEnd = Math.min(endOfDayMs, windowStart + MAX_HOURS * 60 * 60 * 1000);
      const end = maxEnd;
      const start = new Date(windowStart);
      const endDate = new Date(end);
      const fromLocal = formatLocalForApi(start, originTz);
      const toLocal = formatLocalForApi(endDate, originTz);
      const hours = (end - windowStart) / (1000 * 60 * 60);
      if (hours <= 0) break;

      console.log("[Commute Assist] ADB WINDOW", {
        origin,
        destination,
        start: fromLocal,
        end: toLocal,
        hours: Math.round(hours * 100) / 100,
      });

      windows.push({ start, end: endDate, fromLocal, toLocal });
      windowStart = end;
    }

    const allDepartures: unknown[] = [];
    for (const { fromLocal, toLocal } of windows) {
      await waitBeforeAdbRequest();

      const url = new URL(
        `https://${host}/flights/airports/iata/${origin}/${fromLocal}/${toLocal}`
      );
      url.searchParams.set("direction", "Departure");
      url.searchParams.set("withLeg", "true");

      console.log("[Commute Assist] ADB REQUEST", {
        url: url.toString(),
        origin,
        destination,
        windowStart: fromLocal,
        windowEnd: toLocal,
        sentAt: new Date().toISOString(),
      });

      const res = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": host,
          "User-Agent": "CrewRules/1.0 (CommuteAssist; https://crewrules.com)",
        },
      });

      if (!res.ok) {
        const body = await res.text();
        console.log("[Commute Assist] ADB ERROR", `${res.status} - ${body.slice(0, 200)}`);
        continue;
      }

      const json = (await res.json()) as unknown;

      const topLevelKeys = json && typeof json === "object" ? Object.keys(json as object) : [];
      const obj = json as Record<string, unknown>;
      const departuresRaw = obj?.departures ?? obj?.Departures;
      const arrivalsRaw = obj?.arrivals ?? obj?.Arrivals;
      const dataRaw = obj?.data;
      const departuresArr = Array.isArray(departuresRaw) ? departuresRaw : [];
      const arrivalsArr = Array.isArray(arrivalsRaw) ? arrivalsRaw : [];
      const dataArr = Array.isArray(dataRaw) ? dataRaw : [];

      console.log("[Commute Assist] ADB RESPONSE", {
        topLevelKeys,
        departuresLength: departuresArr.length,
        arrivalsLength: arrivalsArr.length,
        dataLength: dataArr.length,
      });

      const pageDepartures = departuresArr.length > 0
        ? departuresArr
        : dataArr.length > 0
          ? dataArr
          : Array.isArray(json)
            ? json
            : [];
      allDepartures.push(...(pageDepartures as unknown[]));
    }

    const destUpper = destination.toUpperCase();

    const flights: CommuteFlight[] = (allDepartures as unknown[])
    .filter((f) => {
      const dest = getDestIata(f);
      if (dest !== destUpper) return false;
      const depTime = getTimeAsUtc(getDep(f), originTz);
      const arrTime = getTimeAsUtc(getArr(f), destTz);
      if (!depTime || !arrTime) return false;
      const depLocalDateStr = formatInTimeZone(new Date(depTime), originTz, "yyyy-MM-dd");
      return depLocalDateStr === dateStr;
    })
    .map((f) => {
      const dep = getDep(f);
      const arr = getArr(f);
      const depTime = getTimeAsUtc(dep, originTz);
      const arrTime = getTimeAsUtc(arr, destTz);
      const carrier = getCarrier(f);
      const number = getFlightNumber(f);
      const flightNumber = buildFlightNumber(carrier, number);

      const rec = {
        carrier,
        flightNumber,
        departureTime: depTime,
        arrivalTime: arrTime,
        origin: getIata(dep) || origin,
        destination: getIata(arr) || destination,
        durationMinutes:
          depTime && arrTime ? calculateDurationMinutes(depTime, arrTime) : 0,
        origin_tz: (dep as Record<string, string>)?.timezone ?? originTz,
        dest_tz: (arr as Record<string, string>)?.timezone ?? destTz,
        dep_scheduled_raw: getLocalTimeForRaw(dep) ?? undefined,
        dep_estimated_raw: (dep as Record<string, string>)?.estimatedTimeLocal ?? undefined,
        dep_actual_raw: (dep as Record<string, string>)?.actualTimeLocal ?? undefined,
        dep_delay_min: (dep as Record<string, number>)?.delay != null
          ? Number((dep as Record<string, number>).delay)
          : null,
        arr_scheduled_raw: getLocalTimeForRaw(arr) ?? undefined,
        arr_estimated_raw: (arr as Record<string, string>)?.estimatedTimeLocal ?? undefined,
        arr_actual_raw: (arr as Record<string, string>)?.actualTimeLocal ?? undefined,
        arr_delay_min: (arr as Record<string, number>)?.delay != null
          ? Number((arr as Record<string, number>).delay)
          : null,
        status: (f as Record<string, string>)?.status ?? undefined,
        dep_gate: (dep as Record<string, string>)?.gate ?? null,
        arr_gate: (arr as Record<string, string>)?.gate ?? null,
        aircraft_type: getAircraftType(f),
      };
      if (carrier === "AA" && /1352/.test(flightNumber) && origin.toUpperCase() === "SAV" && destination.toUpperCase() === "CLT") {
        console.log("[Commute Assist] AA1352 SAV→CLT ADB", {
          provider: "ADB",
          carrier: rec.carrier,
          flightNumber: rec.flightNumber,
          origin: rec.origin,
          destination: rec.destination,
          departureTime: rec.departureTime,
          arrivalTime: rec.arrivalTime,
          dep_scheduled_raw: rec.dep_scheduled_raw,
          dep_estimated_raw: rec.dep_estimated_raw,
          dep_delay_min: rec.dep_delay_min,
        });
      }
      if (carrier === "DL" && /1946/.test(flightNumber) && origin.toUpperCase() === "ATL" && destination.toUpperCase() === "SJU" && process.env.NODE_ENV !== "production") {
        console.log("[Commute Assist] DL 1946 ATL→SJU AeroDataBox raw", {
          provider: "AeroDataBox",
          dep_scheduled_raw: rec.dep_scheduled_raw,
          arr_scheduled_raw: rec.arr_scheduled_raw,
          output: {
            departureTime: rec.departureTime,
            arrivalTime: rec.arrivalTime,
            durationMinutes: rec.durationMinutes,
          },
        });
      }
      return rec;
    })
    .sort((a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime());

    return { flights };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("[Commute Assist] ADB ERROR", msg);
    return { flights: [] };
  }
}

/** With withLeg=true, each item has Departure and Arrival for the leg. */
function getDep(f: unknown): unknown {
  const o = f as Record<string, unknown>;
  return o.Departure ?? o.departure ?? o.dep;
}

function getArr(f: unknown): unknown {
  const o = f as Record<string, unknown>;
  return o.Arrival ?? o.arrival ?? o.arr;
}

function getDestIata(f: unknown): string {
  const arr = getArr(f);
  return getIata(arr);
}

function getCarrier(f: unknown): string {
  const o = f as Record<string, unknown>;
  const airline = o.airline ?? o.Airline;
  return getIata(airline);
}

function getFlightNumber(f: unknown): string {
  const o = f as Record<string, unknown>;
  const n = o.number ?? o.Number ?? o.flightNumber;
  return typeof n === "string" ? n : String(n ?? "");
}

/** Extract aircraft type (e.g. B737, A320). AeroDataBox uses aircraft.iata, icao, or model. */
function getAircraftType(f: unknown): string | null {
  const o = f as Record<string, unknown>;
  const ac = o?.aircraft ?? o?.Aircraft;
  if (!ac || typeof ac !== "object") return null;
  const a = ac as Record<string, unknown>;
  const iata = a.iata ?? a.Iata;
  if (typeof iata === "string" && iata.trim()) return iata.trim().toUpperCase();
  const icao = a.icao ?? a.Icao;
  if (typeof icao === "string" && icao.trim()) return icao.trim().toUpperCase();
  const model = a.model ?? a.Model ?? a.modelCode ?? a.ModelCode;
  if (typeof model !== "string" || !model.trim()) return null;
  const m = model.trim();
  const numMatch = m.match(/(\d{3,4})/);
  if (numMatch) {
    const num = numMatch[1];
    const lower = m.toLowerCase();
    if (lower.includes("boeing") || lower.includes("b7")) return `B${num}`;
    if (lower.includes("airbus") || lower.includes("a3")) return `A${num}`;
    if (m.length <= 6) return m.toUpperCase();
  }
  return m.length <= 8 ? m.toUpperCase() : null;
}

/** Build flightNumber without duplicating carrier. AeroDataBox number often includes carrier (e.g. "B6 2752"). */
function buildFlightNumber(carrier: string, number: string): string {
  if (!number) return "";
  const num = String(number).trim();
  const carrierUp = (carrier || "").toUpperCase();
  const numNoSpace = num.replace(/\s/g, "");
  if (carrierUp && numNoSpace.toUpperCase().startsWith(carrierUp)) {
    const numericPart = numNoSpace.slice(carrierUp.length);
    return carrierUp + (numericPart ? " " + numericPart : "");
  }
  return carrierUp ? `${carrierUp} ${num}` : num;
}
