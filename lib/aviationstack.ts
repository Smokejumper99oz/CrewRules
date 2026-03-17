/**
 * AviationStack API client for flight data.
 * @see https://aviationstack.com/documentation
 */

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { addDays } from "date-fns";
import { getRouteTzs } from "@/lib/airports";

export type CommuteFlight = {
  carrier: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  origin: string;
  destination: string;
  durationMinutes: number;
  /** IANA timezone for departure airport (from API or lookup). */
  origin_tz?: string;
  /** IANA timezone for arrival airport (from API or lookup). */
  dest_tz?: string;
  /** Live timing from /v1/flights (for delay Was/Now display). */
  dep_scheduled_raw?: string;
  dep_estimated_raw?: string;
  dep_actual_raw?: string;
  dep_delay_min?: number | null;
  arr_scheduled_raw?: string;
  arr_estimated_raw?: string;
  arr_actual_raw?: string;
  arr_delay_min?: number | null;
  status?: string;
  /** Departure gate (e.g. D11). */
  dep_gate?: string | null;
  /** Arrival gate (e.g. A22). */
  arr_gate?: string | null;
  /** Aircraft type (e.g. A320, B737). */
  aircraft_type?: string | null;
};

export type FetchFlightsResult = {
  flights: CommuteFlight[];
  notice?: string;
};

/** Strip timezone offset from AviationStack timestamp (scheduled times are airport-local). */
function stripOffset(s: string): string {
  return s.replace(/[+-]\d{2}:\d{2}$|Z$/i, "").trim();
}

/** Parse AviationStack timestamp (airport-local) to Date. Fixes +00:00 misinterpretation. */
export function parseAviationstackTs(ts: string, tz: string): Date {
  return fromZonedTime(stripOffset(ts), tz);
}

function calculateDurationMinutes(
  dep: string,
  arr: string,
  originTz: string,
  destTz: string
): number {
  const depUtc = fromZonedTime(stripOffset(dep), originTz).getTime();
  const arrUtc = fromZonedTime(stripOffset(arr), destTz).getTime();
  return Math.max(0, Math.round((arrUtc - depUtc) / 60000));
}

const devCache = new Map<string, { expiresAt: number; data: FetchFlightsResult }>();

/** In-flight request deduplication: identical AviationStack calls reuse the same promise. */
const inflightAviationRequests = new Map<string, Promise<FetchFlightsResult>>();

/** Minimum ms between outbound AviationStack requests. Serialized via queue. */
const MIN_MS_BETWEEN_AVIATIONSTACK_REQUESTS = 250;

/** Queue tail: each request chains after the previous so only one runs at a time. */
let aviationstackQueueTail: Promise<unknown> = Promise.resolve();

/** Next timestamp when an AviationStack request is allowed to start. */
let nextAviationstackAllowedAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * AviationStack-only throttled fetch. Serializes requests and enforces minimum delay.
 * Uses AbortController timeout (20s) so the queue cannot hang forever.
 */
async function aviationstackFetch(url: string, options?: RequestInit): Promise<Response> {
  const prev = aviationstackQueueTail;
  const runRequest = async (): Promise<Response> => {
    const now = Date.now();
    if (now < nextAviationstackAllowedAt) {
      await sleep(nextAviationstackAllowedAt - now);
    }
    nextAviationstackAllowedAt = Date.now() + MIN_MS_BETWEEN_AVIATIONSTACK_REQUESTS;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20_000);
    const mergedOptions: RequestInit = { ...options, signal: controller.signal };
    try {
      const res = await fetch(url, mergedOptions);
      clearTimeout(timeoutId);
      return res;
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  };
  const myPromise = prev.then(runRequest, runRequest);
  aviationstackQueueTail = myPromise;
  return myPromise as Promise<Response>;
}

/** Extract aircraft type from AviationStack aircraft object. Prefers icao (B737), then iata, modelCode, modelText. */
function extractAircraftType(f: {
  aircraft?: { iata?: string; icao?: string; modelCode?: string; modelText?: string };
}): string | null {
  const a = f?.aircraft;
  if (!a) return null;
  const icao = (a as { icao?: string }).icao?.trim().toUpperCase();
  if (icao && /^[AB]\d{3,4}$/.test(icao)) return icao;
  if (a.iata) return a.iata.trim().toUpperCase();
  const code = a.modelCode?.trim().toUpperCase();
  if (code) return code;
  const text = a.modelText?.trim();
  if (!text) return null;
  const lower = text.toLowerCase();
  const numMatch = text.match(/(\d{3,4})/);
  if (numMatch) {
    const num = numMatch[1];
    if (lower.includes("boeing")) return `B${num}`;
    if (lower.includes("airbus")) return `A${num}`;
    return num;
  }
  return text.length <= 12 ? text.toUpperCase() : null;
}

/** Pad time-only string (e.g. "06:15") to "06:15:00" for ISO datetime. */
function padTimeToSeconds(t: string): string {
  if (!t) return "";
  const parts = t.split(":");
  if (parts.length >= 3) return t;
  if (parts.length === 2) return `${t}:00`;
  if (parts.length === 1) return `${t.padStart(2, "0")}:00:00`;
  return t;
}

export async function fetchFlightsFromAviationStack(
  origin: string,
  destination: string,
  date: string,
  opts?: { noCache?: boolean }
): Promise<FetchFlightsResult> {
  const apiKey = process.env.AVIATIONSTACK_API_KEY;

  if (!apiKey) {
    throw new Error("Missing AVIATIONSTACK_API_KEY");
  }

  const { originTz, destTz } = await getRouteTzs(origin, destination);

  // Compute today in origin timezone and days ahead
  const todayInOrigin = formatInTimeZone(new Date(), originTz, "yyyy-MM-dd");
  const todayStart = fromZonedTime(`${todayInOrigin}T00:00:00`, originTz).getTime();
  const reqStart = fromZonedTime(`${date}T00:00:00`, originTz).getTime();
  const daysAhead = Math.round((reqStart - todayStart) / (24 * 60 * 60 * 1000));

  const key = `${origin.toUpperCase()}-${destination.toUpperCase()}-${date}`;
  if (process.env.NODE_ENV !== "production" && !opts?.noCache) {
    const cached = devCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  let result: FetchFlightsResult;

  // /flights with dep_iata+arr_iata works for same-day and near-term (0–7 days).
  // /flightsFuture requires date > 7 days ahead and is origin-only (fewer results).
  if (daysAhead >= 0 && daysAhead <= 7) {
    result = await fetchFlightsSameDay(apiKey, origin, destination, date, originTz, destTz);
  } else if (daysAhead > 7) {
    result = await fetchFlightsFuture(apiKey, origin, destination, date, originTz, destTz);
  } else {
    // daysAhead < 0 (past date) — use /flights for historical (last 3 months)
    result = await fetchFlightsHistorical(apiKey, origin, destination, date, originTz, destTz);
  }

  if (process.env.NODE_ENV !== "production" && !opts?.noCache) {
    devCache.set(key, { expiresAt: Date.now() + 10 * 60 * 1000, data: result });
  }

  return result;
}

async function fetchTimetable(
  apiKey: string,
  origin: string,
  destination: string,
  date: string,
  originTz: string,
  destTz: string
): Promise<FetchFlightsResult> {
  const limit = 100;
  const allData: any[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * limit;
    const url = new URL("https://api.aviationstack.com/v1/timetable");
    url.searchParams.set("access_key", apiKey);
    url.searchParams.set("iataCode", origin);
    url.searchParams.set("type", "departure");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));

    const res = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      headers: { "User-Agent": "CrewRules/1.0 (CommuteAssist)" },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AviationStack timetable failed: ${res.status} - ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    const pageData = (json.data ?? []) as any[];
    allData.push(...pageData);

    const total = json.pagination?.total ?? 0;
    const count = json.pagination?.count ?? pageData.length;
    if (total <= 0 || offset + count >= total || pageData.length < limit) break;
  }

  const destUpper = destination.toUpperCase();
  const flights: CommuteFlight[] = (allData as any[])
    .filter((f) => (f?.arrival?.iataCode ?? "").toUpperCase() === destUpper)
    .map((f) => {
      const depTime = f?.departure?.scheduledTime ?? "";
      const arrTime = f?.arrival?.scheduledTime ?? "";
      const carrier = (f?.airline?.iataCode ?? "").toUpperCase();
      const number = f?.flight?.number ?? "";
      const flightNumber = carrier && number ? `${carrier}${number}` : "";

      const depUtc = depTime ? fromZonedTime(stripOffset(depTime), originTz).toISOString() : "";
      const arrUtc = arrTime ? fromZonedTime(stripOffset(arrTime), destTz).toISOString() : "";

      return {
        carrier,
        flightNumber,
        departureTime: depUtc,
        arrivalTime: arrUtc,
        origin: (f?.departure?.iataCode ?? origin).toUpperCase(),
        destination: (f?.arrival?.iataCode ?? destination).toUpperCase(),
        durationMinutes:
          depTime && arrTime ? calculateDurationMinutes(depTime, arrTime, originTz, destTz) : 0,
        dep_gate: f?.departure?.gate ?? null,
        arr_gate: f?.arrival?.gate ?? null,
        aircraft_type: extractAircraftType(f),
      };
    })
    .sort(
      (a, b) =>
        fromZonedTime(stripOffset(a.arrivalTime), destTz).getTime() -
        fromZonedTime(stripOffset(b.arrivalTime), destTz).getTime()
    );

  return { flights };
}

const MAX_PAGES = 5;

/**
 * Same-day flights using /v1/flights with city-pair filtering (dep_iata + arr_iata).
 * Returns whatever /v1/flights returns (no timetable fallback).
 */
async function fetchFlightsSameDay(
  apiKey: string,
  origin: string,
  destination: string,
  date: string,
  originTz: string,
  destTz: string
): Promise<FetchFlightsResult> {
  const o = origin.toUpperCase();
  const d = destination.toUpperCase();
  const key = `sameDay:${o}:${d}:${date}`;
  if (inflightAviationRequests.has(key)) {
    return inflightAviationRequests.get(key)!;
  }

  const requestPromise = (async (): Promise<FetchFlightsResult> => {
  const limit = 100;
  const allData: any[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * limit;
    const url = new URL("https://api.aviationstack.com/v1/flights");
    url.searchParams.set("access_key", apiKey);
    url.searchParams.set("dep_iata", origin);
    url.searchParams.set("arr_iata", destination);
    url.searchParams.set("flight_date", date);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));

    const res = await aviationstackFetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      headers: { "User-Agent": "CrewRules/1.0 (CommuteAssist)" },
    });

    if (res == null || typeof res.ok !== "boolean") {
      return {
        flights: [],
        notice: "Flight data temporarily unavailable. Please try again later.",
      };
    }
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) {
        return {
          flights: [],
          notice: "Flight data temporarily unavailable (API rate limit). Please try again later.",
        };
      }
      throw new Error(`AviationStack flights (same-day) failed: ${res.status} - ${body.slice(0, 200)}`);
    }

    const json = await res.json();
    const raw = json?.data;
    const pageData = Array.isArray(raw) ? raw : raw ? [raw] : [];
    allData.push(...pageData);

    const total = json.pagination?.total ?? 0;
    const count = json.pagination?.count ?? pageData.length;
    if (total <= 0 || offset + count >= total || pageData.length < limit) break;
  }

  let droppedMissingDepTs = 0;
  let droppedMissingArrTs = 0;
  let droppedBadDate = 0;
  let droppedParseFail = 0;

  const flightsA: CommuteFlight[] = (allData as any[])
    .filter((f) => {
      const depTime = f?.departure?.scheduled ?? "";
      const arrTime = f?.arrival?.scheduled ?? "";
      if (!depTime) {
        droppedMissingDepTs++;
        return false;
      }
      if (!arrTime) {
        droppedMissingArrTs++;
        return false;
      }
      const depClean = stripOffset(depTime);
      const arrClean = stripOffset(arrTime);
      const depDateStr = depClean.slice(0, 10);
      if (depDateStr !== date) {
        droppedBadDate++;
        return false;
      }
      try {
        fromZonedTime(depClean, f?.departure?.timezone ?? originTz);
        fromZonedTime(arrClean, f?.arrival?.timezone ?? destTz);
      } catch {
        droppedParseFail++;
        return false;
      }
      return true;
    })
    .map((f) => {
      const depTime = f?.departure?.scheduled ?? "";
      const arrTime = f?.arrival?.scheduled ?? "";
      let carrier = (f?.airline?.iataCode ?? "").toUpperCase();
      let number = String(f?.flight?.number ?? "").trim();
      const flightIata = (f?.flight?.iata ?? "").toUpperCase();
      let flightNumber =
        carrier && number ? `${carrier}${number}` : flightIata ? flightIata : "";

      // When carrier is empty but flightIata is "B62751", parse carrier and number
      if (!carrier && flightNumber) {
        const m = flightNumber.match(/^([A-Z]{2})(\d+)$/);
        if (m) {
          carrier = m[1];
          flightNumber = carrier + m[2];
        }
      }
      // When number already starts with carrier (e.g. number="B62751", carrier="B6"), strip it
      if (carrier && number && number.toUpperCase().startsWith(carrier)) {
        number = number.slice(carrier.length).trim() || number;
        flightNumber = carrier + number;
      }

      return {
        carrier,
        flightNumber,
        departureTime: depTime,
        arrivalTime: arrTime,
        origin: (f?.departure?.iataCode ?? f?.departure?.iata ?? origin).toUpperCase(),
        destination: (f?.arrival?.iataCode ?? f?.arrival?.iata ?? destination).toUpperCase(),
        durationMinutes:
          depTime && arrTime
            ? calculateDurationMinutes(depTime, arrTime, originTz, destTz)
            : 0,
        origin_tz: f?.departure?.timezone ?? originTz,
        dest_tz: f?.arrival?.timezone ?? destTz,
        dep_scheduled_raw: f?.departure?.scheduled ?? undefined,
        dep_estimated_raw: f?.departure?.estimated ?? undefined,
        dep_actual_raw: f?.departure?.actual ?? undefined,
        dep_delay_min: f?.departure?.delay != null ? Number(f.departure.delay) : null,
        arr_scheduled_raw: f?.arrival?.scheduled ?? undefined,
        arr_estimated_raw: f?.arrival?.estimated ?? undefined,
        arr_actual_raw: f?.arrival?.actual ?? undefined,
        arr_delay_min: f?.arrival?.delay != null ? Number(f.arrival.delay) : null,
        status: f?.flight_status ?? undefined,
        dep_gate: f?.departure?.gate ?? null,
        arr_gate: f?.arrival?.gate ?? null,
        aircraft_type: extractAircraftType(f),
      };
    })
    .sort(
      (a, b) =>
        fromZonedTime(stripOffset(a.arrivalTime), a.dest_tz ?? destTz).getTime() -
        fromZonedTime(stripOffset(b.arrivalTime), b.dest_tz ?? destTz).getTime()
    );

  return { flights: flightsA };
  })();

  inflightAviationRequests.set(key, requestPromise);
  return requestPromise.finally(() => {
    inflightAviationRequests.delete(key);
  });
}

async function fetchFlightsFuture(
  apiKey: string,
  origin: string,
  destination: string,
  date: string,
  originTz: string,
  destTz: string
): Promise<FetchFlightsResult> {
  const o = origin.toUpperCase();
  const d = destination.toUpperCase();
  const key = `future:${o}:${d}:${date}`;
  if (inflightAviationRequests.has(key)) {
    return inflightAviationRequests.get(key)!;
  }

  const requestPromise = (async (): Promise<FetchFlightsResult> => {
  const url = new URL("https://api.aviationstack.com/v1/flightsFuture");
  url.searchParams.set("access_key", apiKey);
  url.searchParams.set("iataCode", origin);
  url.searchParams.set("type", "departure");
  url.searchParams.set("date", date);

  const res = await aviationstackFetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: { "User-Agent": "CrewRules/1.0 (CommuteAssist)" },
  });

  if (res == null || typeof res.ok !== "boolean") {
    return {
      flights: [],
      notice: "Flight data temporarily unavailable. Please try again later.",
    };
  }
  if (!res.ok) {
    const body = await res.text();

    // Gracefully handle rate limit (429) — return empty instead of throwing
    if (res.status === 429) {
      return {
        flights: [],
        notice: "Flight data temporarily unavailable (API rate limit). Please try again later.",
      };
    }

    // Gracefully handle Aviationstack future-date validation:
    // {"error":{"code":"validation_error","message":"Request failed with validation error","context":{"date":[{"key":"invalid_future_date","message":"The date must be above 2026-03-10"}]}}}
    if (res.status === 400) {
      try {
        const parsed = JSON.parse(body);
        const key = parsed?.error?.context?.date?.[0]?.key;
        const msg = parsed?.error?.context?.date?.[0]?.message;

        if (key === "invalid_future_date" && typeof msg === "string") {
          const after = msg.split("above")[1]?.trim();
          return {
            flights: [],
            notice: after
              ? `Provider limit: Aviationstack future schedules require date > ${after}.`
              : `Provider limit: Aviationstack future schedules require a later date.`,
          };
        }
      } catch {
        // fall through to generic error
      }
    }

    throw new Error(`AviationStack flightsFuture failed: ${res.status} - ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  if (!json.data) return { flights: [] };

  const destUpper = destination.toUpperCase();
  const flights: CommuteFlight[] = (json.data as any[])
    .filter((f) => (f?.arrival?.iataCode ?? "").toUpperCase() === destUpper)
    .map((f) => {
      const depTimeRaw = f?.departure?.scheduledTime ?? "";
      const arrTimeRaw = f?.arrival?.scheduledTime ?? "";
      const depTime = padTimeToSeconds(depTimeRaw);
      const arrTime = padTimeToSeconds(arrTimeRaw);

      const depLocal = `${date}T${depTime}`;
      let arrDate = date;
      // Overnight: if arrival time is earlier than departure time, add +1 day
      if (depTime && arrTime) {
        const depMinutes = parseTimeToMinutes(depTime);
        const arrMinutes = parseTimeToMinutes(arrTime);
        if (arrMinutes < depMinutes) {
          arrDate = addDays(new Date(date), 1).toISOString().slice(0, 10);
        }
      }
      const arrLocal = `${arrDate}T${arrTime}`;

      const depUtc = fromZonedTime(depLocal, originTz).toISOString();
      const arrUtc = fromZonedTime(arrLocal, destTz).toISOString();

      const carrier = (f?.airline?.iataCode ?? "").toUpperCase();
      const number = f?.flight?.number ?? "";
      const flightNumber = carrier && number ? `${carrier}${number}` : "";

      return {
        carrier,
        flightNumber,
        departureTime: depUtc,
        arrivalTime: arrUtc,
        origin: (f?.departure?.iataCode ?? origin).toUpperCase(),
        destination: (f?.arrival?.iataCode ?? destination).toUpperCase(),
        durationMinutes: calculateDurationMinutes(depUtc, arrUtc, "UTC", "UTC"),
        origin_tz: f?.departure?.timezone ?? originTz,
        dest_tz: f?.arrival?.timezone ?? destTz,
        dep_gate: f?.departure?.gate ?? null,
        arr_gate: f?.arrival?.gate ?? null,
        aircraft_type: extractAircraftType(f),
      };
    })
    .sort((a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime());

  return { flights };
  })();

  inflightAviationRequests.set(key, requestPromise);
  return requestPromise.finally(() => {
    inflightAviationRequests.delete(key);
  });
}

function parseTimeToMinutes(t: string): number {
  const parts = t.split(":").map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const s = parts[2] ?? 0;
  return h * 60 + m + s / 60;
}

async function fetchFlightsHistorical(
  apiKey: string,
  origin: string,
  destination: string,
  date: string,
  originTz: string,
  destTz: string
): Promise<FetchFlightsResult> {
  const o = origin.toUpperCase();
  const d = destination.toUpperCase();
  const key = `historical:${o}:${d}:${date}`;
  if (inflightAviationRequests.has(key)) {
    return inflightAviationRequests.get(key)!;
  }

  const requestPromise = (async (): Promise<FetchFlightsResult> => {
  const url = new URL("https://api.aviationstack.com/v1/flights");
  url.searchParams.set("access_key", apiKey);
  url.searchParams.set("flight_date", date);
  url.searchParams.set("dep_iata", origin);
  url.searchParams.set("arr_iata", destination);

  const res = await aviationstackFetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: { "User-Agent": "CrewRules/1.0 (CommuteAssist)" },
  });

  if (res == null || typeof res.ok !== "boolean") {
    return {
      flights: [],
      notice: "Flight data temporarily unavailable. Please try again later.",
    };
  }
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) {
      return {
        flights: [],
        notice: "Flight data temporarily unavailable (API rate limit). Please try again later.",
      };
    }
    throw new Error(`AviationStack flights failed: ${res.status} - ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  if (!json.data) return { flights: [] };

  const mapped = (json.data as any[]).map((f) => {
    const depTime = f?.departure?.scheduled ?? "";
    const arrTime = f?.arrival?.scheduled ?? "";
    const carrier = (f?.airline?.iataCode ?? "").toUpperCase();
    const number = f?.flight?.number ?? "";
    const flightNumber = carrier && number ? `${carrier}${number}` : "";

    return {
      carrier,
      flightNumber,
      departureTime: depTime,
      arrivalTime: arrTime,
      origin: (f?.departure?.iataCode ?? origin).toUpperCase(),
      destination: (f?.arrival?.iataCode ?? destination).toUpperCase(),
      durationMinutes:
        depTime && arrTime ? calculateDurationMinutes(depTime, arrTime, originTz, destTz) : 0,
      origin_tz: f?.departure?.timezone ?? originTz,
      dest_tz: f?.arrival?.timezone ?? destTz,
      dep_gate: f?.departure?.gate ?? null,
      arr_gate: f?.arrival?.gate ?? null,
      aircraft_type: extractAircraftType(f),
    };
  });

  const filtered = mapped
    .filter((f) => {
      if (!f.departureTime) return false;
      const depClean = stripOffset(f.departureTime);
      return depClean.slice(0, 10) === date;
    })
    .sort((a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime());

  return { flights: filtered };
  })();

  inflightAviationRequests.set(key, requestPromise);
  return requestPromise.finally(() => {
    inflightAviationRequests.delete(key);
  });
}
