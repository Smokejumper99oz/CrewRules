/**
 * AviationStack API client for flight data.
 * @see https://aviationstack.com/documentation
 */

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { OperationalStatus } from "@/lib/commute/operational-status-types";
import { createAdminClient } from "@/lib/supabase/admin";
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
  /** Canonical operational status (derived once in data layer). */
  operationalStatus?: OperationalStatus;
};

export type FetchFlightsResult = {
  flights: CommuteFlight[];
  notice?: string;
};

/** Shown when AviationStack returns access/subscription blocks (avoid crashing dashboard / SSR). */
const AVIATIONSTACK_UNAVAILABLE_NOTICE =
  "Live flight data is temporarily unavailable. Commute assist and schedule details may be limited until service is restored.";

/**
 * When the provider blocks access (quota, subscription, disabled key), return empty flights + notice
 * instead of throwing. Returns null if the response should be handled elsewhere (e.g. validation_error).
 */
function tryAviationStackUnavailableResult(status: number, body: string): FetchFlightsResult | null {
  if (status === 401 || status === 403) {
    return { flights: [], notice: AVIATIONSTACK_UNAVAILABLE_NOTICE };
  }
  if (status !== 400 && status !== 402) {
    return null;
  }
  try {
    const parsed = JSON.parse(body) as { error?: { code?: string; message?: string } };
    const code = String(parsed?.error?.code ?? "").toLowerCase();
    const msg = String(parsed?.error?.message ?? "").toLowerCase();
    if (
      code === "api_access_blocked" ||
      code.includes("access_restricted") ||
      code.includes("function_access") ||
      (msg.includes("subscription") && (msg.includes("upgrade") || msg.includes("plan"))) ||
      (msg.includes("api access") && msg.includes("disabled")) ||
      msg.includes("temporarily disabled")
    ) {
      return { flights: [], notice: AVIATIONSTACK_UNAVAILABLE_NOTICE };
    }
  } catch {
    /* not JSON */
  }
  return null;
}

/** Strip timezone offset from AviationStack timestamp (scheduled times are airport-local). */
function stripOffset(s: string): string {
  return s.replace(/[+-]\d{2}:\d{2}$|Z$/i, "").trim();
}

/** Whether a timestamp has explicit UTC/offset (Z or ±HH:MM). */
function hasOffsetOrZ(s: string): boolean {
  return !!(s?.trim() && (s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s)));
}

/**
 * Normalize AviationStack scheduled value to UTC ISO string.
 * AviationStack sometimes sends local airport times mislabeled with +00:00 or Z.
 * For America/* timezones, treat +00:00/Z as local naive time; otherwise parse as UTC.
 * Offsetless: treat as local airport time (same-day API returns local without offset).
 */
function scheduledToUtcIso(s: string, tz: string): string {
  if (!s?.trim()) return "";
  if (hasOffsetOrZ(s)) {
    const clean = stripOffset(s);
    if (tz.startsWith("America/")) {
      return fromZonedTime(clean, tz).toISOString();
    }
    return new Date(s).toISOString();
  }
  const clean = stripOffset(s);
  return fromZonedTime(clean, tz).toISOString();
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

/** Duration in minutes from UTC ISO strings. */
function durationMinutesFromUtcIso(depUtc: string, arrUtc: string): number {
  if (!depUtc || !arrUtc) return 0;
  const depMs = new Date(depUtc).getTime();
  const arrMs = new Date(arrUtc).getTime();
  return Math.max(0, Math.round((arrMs - depMs) / 60000));
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

/** Log AviationStack usage for Super Admin cost reporting. Never throws. */
function logAviationStackUsage(url: string): void {
  void (async () => {
    try {
      let endpoint: string | null = null;
      try {
        endpoint = new URL(url).pathname;
      } catch {
        endpoint = "request";
      }
      const admin = createAdminClient();
      const { error } = await admin.from("aviationstack_usage").insert({
        endpoint: endpoint ?? "request",
        request_count: 1,
      });
      if (error) console.error("[aviationstack] usage log failed:", error.message);
    } catch (err) {
      console.error("[aviationstack] usage log failed:", err);
    }
  })();
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
      logAviationStackUsage(url);
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
      headers: { "User-Agent": "CrewRules™/1.0 (CommuteAssist)" },
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) {
        return { flights: [], notice: "Flight data temporarily unavailable. Try again in a few minutes." };
      }
      const unavailable = tryAviationStackUnavailableResult(res.status, body);
      if (unavailable) return unavailable;
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

      const hasOffsetOrZ = (s: string) =>
        !!(s?.trim() && (s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s)));
      const depUtc = depTime
        ? (hasOffsetOrZ(depTime)
            ? new Date(depTime).toISOString()
            : fromZonedTime(stripOffset(depTime), originTz).toISOString())
        : "";
      const arrUtc = arrTime
        ? (hasOffsetOrZ(arrTime)
            ? new Date(arrTime).toISOString()
            : fromZonedTime(stripOffset(arrTime), destTz).toISOString())
        : "";

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
    .sort((a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime());

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
      headers: { "User-Agent": "CrewRules™/1.0 (CommuteAssist)" },
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
          notice: "Flight data temporarily unavailable. Try again in a few minutes.",
        };
      }
      const unavailable = tryAviationStackUnavailableResult(res.status, body);
      if (unavailable) return unavailable;
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
      const depTzFilter = f?.departure?.timezone ?? originTz;
      const arrTzFilter = originTz === destTz ? originTz : (f?.arrival?.timezone ?? destTz);
      try {
        const depUtcForDate = scheduledToUtcIso(depTime, depTzFilter);
        const depLocalDateStr = formatInTimeZone(new Date(depUtcForDate), originTz, "yyyy-MM-dd");
        if (depLocalDateStr !== date) {
          droppedBadDate++;
          return false;
        }
        const depClean = stripOffset(depTime);
        const arrClean = stripOffset(arrTime);
        fromZonedTime(depClean, depTzFilter);
        fromZonedTime(arrClean, arrTzFilter);
      } catch {
        droppedParseFail++;
        return false;
      }
      return true;
    })
    .map((f) => {
      const depRaw = f?.departure?.scheduled ?? "";
      const arrRaw = f?.arrival?.scheduled ?? "";
      // Prefer route timezones when origin and dest share same TZ (e.g. SAV-CLT both Eastern).
      // AviationStack can return wrong arrival.timezone for some airports, causing arr < dep.
      const depTz = f?.departure?.timezone ?? originTz;
      const arrTz =
        originTz === destTz
          ? originTz
          : (f?.arrival?.timezone ?? destTz);
      const depUtc = scheduledToUtcIso(depRaw, depTz);
      let arrUtc = scheduledToUtcIso(arrRaw, arrTz);
      // Sanity: never allow arrival before departure. If invalid, derive arr from dep + duration.
      const depMs = new Date(depUtc).getTime();
      const arrMs = new Date(arrUtc).getTime();
      if (arrMs < depMs) {
        const durMin = 60; // SAV-CLT ~1h; avoid impossible times
        arrUtc = new Date(depMs + durMin * 60_000).toISOString();
      }
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

      const rec = {
        carrier,
        flightNumber,
        departureTime: depUtc,
        arrivalTime: arrUtc,
        origin: (f?.departure?.iataCode ?? f?.departure?.iata ?? origin).toUpperCase(),
        destination: (f?.arrival?.iataCode ?? f?.arrival?.iata ?? destination).toUpperCase(),
        durationMinutes: depUtc && arrUtc ? durationMinutesFromUtcIso(depUtc, arrUtc) : 0,
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
      if (o === "SAV" && d === "CLT" && carrier === "AA" && /1352/.test(flightNumber)) {
        console.log("[Commute Assist] AA1352 SAV→CLT AS", {
          provider: "AS",
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
      if (o === "ATL" && d === "SJU" && carrier === "DL" && /1946/.test(flightNumber) && process.env.NODE_ENV !== "production") {
        console.log("[Commute Assist] DL 1946 ATL→SJU AviationStack raw", {
          provider: "AviationStack",
          dep_scheduled_raw: f?.departure?.scheduled,
          arr_scheduled_raw: f?.arrival?.scheduled,
          dep_timezone: f?.departure?.timezone,
          arr_timezone: f?.arrival?.timezone,
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
    headers: { "User-Agent": "CrewRules™/1.0 (CommuteAssist)" },
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
        notice: "Flight data temporarily unavailable. Try again in a few minutes.",
      };
    }

    const unavailable = tryAviationStackUnavailableResult(res.status, body);
    if (unavailable) return unavailable;

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
      let arrUtc = fromZonedTime(arrLocal, destTz).toISOString();
      // Sanity: never allow arrival before departure
      const depMs = new Date(depUtc).getTime();
      const arrMs = new Date(arrUtc).getTime();
      if (arrMs < depMs) {
        const durMin = 60;
        arrUtc = new Date(depMs + durMin * 60_000).toISOString();
      }

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
    headers: { "User-Agent": "CrewRules™/1.0 (CommuteAssist)" },
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
          notice: "Flight data temporarily unavailable. Try again in a few minutes.",
        };
      }
      const unavailable = tryAviationStackUnavailableResult(res.status, body);
      if (unavailable) return unavailable;
      throw new Error(`AviationStack flights failed: ${res.status} - ${body.slice(0, 200)}`);
    }

  const json = await res.json();
  if (!json.data) return { flights: [] };

  const mapped = (json.data as any[]).map((f) => {
    const depRaw = f?.departure?.scheduled ?? "";
    const arrRaw = f?.arrival?.scheduled ?? "";
    const depTz = f?.departure?.timezone ?? originTz;
    const arrTz =
      originTz === destTz ? originTz : (f?.arrival?.timezone ?? destTz);
    const depUtc = scheduledToUtcIso(depRaw, depTz);
    let arrUtc = scheduledToUtcIso(arrRaw, arrTz);
    const depMs = new Date(depUtc).getTime();
    const arrMs = new Date(arrUtc).getTime();
    if (arrMs < depMs) {
      arrUtc = new Date(depMs + 60 * 60_000).toISOString();
    }
    const carrier = (f?.airline?.iataCode ?? "").toUpperCase();
    const number = String(f?.flight?.number ?? "").trim();
    const flightIata = (f?.flight?.iata ?? "").toUpperCase();
    let flightNumber = carrier && number ? `${carrier}${number}` : flightIata ? flightIata : "";
    if (!carrier && flightNumber) {
      const m = flightNumber.match(/^([A-Z]{2})(\d+)$/);
      if (m) {
        flightNumber = m[1] + m[2];
      }
    }

    return {
      carrier,
      flightNumber,
      departureTime: depUtc,
      arrivalTime: arrUtc,
      origin: (f?.departure?.iataCode ?? origin).toUpperCase(),
      destination: (f?.arrival?.iataCode ?? destination).toUpperCase(),
      durationMinutes: depUtc && arrUtc ? durationMinutesFromUtcIso(depUtc, arrUtc) : 0,
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
  });

  const filtered = mapped
    .filter((f) => {
      if (!f.departureTime) return false;
      const depMs = new Date(f.departureTime).getTime();
      if (Number.isNaN(depMs)) return false;
      const depLocalDateStr = formatInTimeZone(new Date(f.departureTime), originTz, "yyyy-MM-dd");
      return depLocalDateStr === date;
    })
    .sort((a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime());

  return { flights: filtered };
  })();

  inflightAviationRequests.set(key, requestPromise);
  return requestPromise.finally(() => {
    inflightAviationRequests.delete(key);
  });
}
