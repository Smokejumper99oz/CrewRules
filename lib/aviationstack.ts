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
};

export type FetchFlightsResult = {
  flights: CommuteFlight[];
  notice?: string;
};

function calculateDurationMinutes(dep: string, arr: string) {
  const departure = new Date(dep).getTime();
  const arrival = new Date(arr).getTime();
  return Math.max(0, Math.round((arrival - departure) / 60000));
}

const devCache = new Map<string, { expiresAt: number; data: FetchFlightsResult }>();

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

  if (daysAhead === 0) {
    result = await fetchFlightsSameDay(apiKey, origin, destination, date, originTz, destTz);
  } else if (daysAhead > 0) {
    result = await fetchFlightsFuture(apiKey, origin, destination, date, originTz, destTz);
  } else {
    // daysAhead < 0 (past date) — use /flights for historical (last 3 months)
    result = await fetchFlightsHistorical(apiKey, origin, destination, date, originTz);
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
  const url = new URL("https://api.aviationstack.com/v1/timetable");
  url.searchParams.set("access_key", apiKey);
  url.searchParams.set("iataCode", origin);
  url.searchParams.set("type", "departure");

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
  if (!json.data) return { flights: [] };

  const destUpper = destination.toUpperCase();
  const flights: CommuteFlight[] = (json.data as any[])
    .filter((f) => (f?.arrival?.iataCode ?? "").toUpperCase() === destUpper)
    .map((f) => {
      const depTime = f?.departure?.scheduledTime ?? "";
      const arrTime = f?.arrival?.scheduledTime ?? "";
      const carrier = (f?.airline?.iataCode ?? "").toUpperCase();
      const number = f?.flight?.number ?? "";
      const flightNumber = carrier && number ? `${carrier}${number}` : "";

      // Timetable returns full ISO; if no offset, treat as local-naive
      let depUtc = depTime;
      let arrUtc = arrTime;
      const hasOffset = (s: string) => /[+-]\d{2}:\d{2}$|Z$/i.test(s);
      if (!hasOffset(depTime) && depTime) depUtc = fromZonedTime(depTime, originTz).toISOString();
      if (!hasOffset(arrTime) && arrTime) arrUtc = fromZonedTime(arrTime, destTz).toISOString();

      return {
        carrier,
        flightNumber,
        departureTime: depUtc,
        arrivalTime: arrUtc,
        origin: (f?.departure?.iataCode ?? origin).toUpperCase(),
        destination: (f?.arrival?.iataCode ?? destination).toUpperCase(),
        durationMinutes: depUtc && arrUtc ? calculateDurationMinutes(depUtc, arrUtc) : 0,
      };
    })
    .sort((a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime());

  return { flights };
}

/**
 * Same-day flights using /v1/flights with city-pair filtering (dep_iata + arr_iata).
 * Returns all flights for the given origin→destination on the given date.
 */
async function fetchFlightsSameDay(
  apiKey: string,
  origin: string,
  destination: string,
  date: string,
  originTz: string,
  destTz: string
): Promise<FetchFlightsResult> {
  const url = new URL("https://api.aviationstack.com/v1/flights");
  url.searchParams.set("access_key", apiKey);
  url.searchParams.set("dep_iata", origin);
  url.searchParams.set("arr_iata", destination);
  url.searchParams.set("flight_date", date);
  url.searchParams.set("limit", "100");

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: { "User-Agent": "CrewRules/1.0 (CommuteAssist)" },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AviationStack flights (same-day) failed: ${res.status} - ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  if (!json.data) return { flights: [] };

  const flights: CommuteFlight[] = (json.data as any[])
    .filter((f) => {
      const depTime = f?.departure?.scheduled ?? "";
      const arrTime = f?.arrival?.scheduled ?? "";
      return !!depTime && !!arrTime;
    })
    .map((f) => {
      const depTime = f?.departure?.scheduled ?? "";
      const arrTime = f?.arrival?.scheduled ?? "";
      const carrier = (f?.airline?.iataCode ?? "").toUpperCase();
      const number = f?.flight?.number ?? "";
      const flightIata = f?.flight?.iata ?? "";
      const flightNumber =
        carrier && number ? `${carrier}${number}` : flightIata ? flightIata.toUpperCase() : "";

      return {
        carrier,
        flightNumber,
        departureTime: depTime,
        arrivalTime: arrTime,
        origin: (f?.departure?.iataCode ?? f?.departure?.iata ?? origin).toUpperCase(),
        destination: (f?.arrival?.iataCode ?? f?.arrival?.iata ?? destination).toUpperCase(),
        durationMinutes: depTime && arrTime ? calculateDurationMinutes(depTime, arrTime) : 0,
      };
    })
    .sort((a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime());

  return { flights };
}

async function fetchFlightsFuture(
  apiKey: string,
  origin: string,
  destination: string,
  date: string,
  originTz: string,
  destTz: string
): Promise<FetchFlightsResult> {
  const url = new URL("https://api.aviationstack.com/v1/flightsFuture");
  url.searchParams.set("access_key", apiKey);
  url.searchParams.set("iataCode", origin);
  url.searchParams.set("type", "departure");
  url.searchParams.set("date", date);

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: { "User-Agent": "CrewRules/1.0 (CommuteAssist)" },
  });

  if (!res.ok) {
    const body = await res.text();

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
        durationMinutes: calculateDurationMinutes(depUtc, arrUtc),
      };
    })
    .sort((a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime());

  return { flights };
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
  originTz: string
): Promise<FetchFlightsResult> {
  const url = new URL("https://api.aviationstack.com/v1/flights");
  url.searchParams.set("access_key", apiKey);
  url.searchParams.set("flight_date", date);
  url.searchParams.set("dep_iata", origin);
  url.searchParams.set("arr_iata", destination);

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: { "User-Agent": "CrewRules/1.0 (CommuteAssist)" },
  });

  if (!res.ok) {
    const body = await res.text();
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
      durationMinutes: depTime && arrTime ? calculateDurationMinutes(depTime, arrTime) : 0,
    };
  });

  const filtered = mapped
    .filter((f) => {
      if (!f.departureTime) return false;
      const depDate = new Date(f.departureTime);
      const depLocalDate = formatInTimeZone(depDate, originTz, "yyyy-MM-dd");
      return depLocalDate === date;
    })
    .sort((a, b) => new Date(a.arrivalTime).getTime() - new Date(b.arrivalTime).getTime());

  return { flights: filtered };
}
