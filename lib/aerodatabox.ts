/**
 * AerodataBox API client for flight data (via RapidAPI).
 * FIDS endpoint: airport departures filtered by destination.
 * @see https://doc.aerodatabox.com/rapidapi.html
 */

import { fromZonedTime } from "date-fns-tz";
import type { CommuteFlight, FetchFlightsResult } from "@/lib/aviationstack";
import { getRouteTzs } from "@/lib/airports";

/** Strip timezone offset from timestamp. */
function stripOffset(s: string): string {
  return s.replace(/[+-]\d{2}:\d{2}$|Z$/i, "").trim();
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

/** Extract IATA from nested airport object. */
function getIata(obj: unknown): string {
  if (!obj || typeof obj !== "object") return "";
  const o = obj as Record<string, unknown>;
  const code = o.iataCode ?? o.iata ?? (o.airport && getIata(o.airport));
  return typeof code === "string" ? code.toUpperCase() : "";
}

/** Extract time string from movement object. */
function getTime(obj: unknown): string {
  if (!obj || typeof obj !== "object") return "";
  const o = obj as Record<string, unknown>;
  return (
    (o.scheduledTimeLocal ?? o.scheduledTime ?? o.scheduled ?? o.estimatedTime ?? o.actualTime) as string
  ) ?? "";
}

/**
 * Fetch flights from AerodataBox FIDS (airport departures).
 * Returns flights from origin to destination on the given date.
 */
export async function fetchFlightsFromAerodataBox(
  origin: string,
  destination: string,
  date: string
): Promise<FetchFlightsResult> {
  const apiKey = process.env.RAPIDAPI_KEY;
  const host =
    process.env.AERODATABOX_RAPIDAPI_HOST ?? "aerodatabox.p.rapidapi.com";

  if (!apiKey) {
    throw new Error("Missing RAPIDAPI_KEY");
  }

  const { originTz, destTz } = await getRouteTzs(origin, destination);

  const fromLocal = `${date}T00:00`;
  const toLocal = `${date}T23:59`;

  const url = new URL(
    `https://${host}/flights/airports/iata/${origin}/${fromLocal}/${toLocal}`
  );
  url.searchParams.set("direction", "Departure");
  url.searchParams.set("withLeg", "true");

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: {
      "X-RapidAPI-Key": apiKey,
      "X-RapidAPI-Host": host,
      "User-Agent": "CrewRules/1.0 (CommuteAssist)",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `AerodataBox FIDS failed: ${res.status} - ${body.slice(0, 200)}`
    );
  }

  const json = (await res.json()) as unknown;
  const departures = Array.isArray(json)
    ? json
    : (json as Record<string, unknown>).departures ?? (json as Record<string, unknown>).data ?? [];

  const destUpper = destination.toUpperCase();
  const dateStr = date.slice(0, 10);

  const flights: CommuteFlight[] = (departures as unknown[])
    .filter((f) => {
      const dest = getDestIata(f);
      if (dest !== destUpper) return false;
      const depTime = getDepTime(f);
      const arrTime = getArrTime(f);
      if (!depTime || !arrTime) return false;
      const depDateStr = stripOffset(depTime).slice(0, 10);
      return depDateStr === dateStr;
    })
    .map((f) => {
      const depTime = getDepTime(f);
      const arrTime = getArrTime(f);
      const carrier = getCarrier(f);
      const number = getFlightNumber(f);
      const flightNumber = carrier && number ? `${carrier}${number}` : "";

      return {
        carrier,
        flightNumber,
        departureTime: depTime,
        arrivalTime: arrTime,
        origin: getIata(getDep(f)) || origin,
        destination: getIata(getArr(f)) || destination,
        durationMinutes:
          depTime && arrTime
            ? calculateDurationMinutes(depTime, arrTime, originTz, destTz)
            : 0,
        origin_tz: (getDep(f) as Record<string, string>)?.timezone ?? originTz,
        dest_tz: (getArr(f) as Record<string, string>)?.timezone ?? destTz,
        dep_scheduled_raw: (getDep(f) as Record<string, string>)?.scheduledTimeLocal ?? depTime,
        dep_estimated_raw: (getDep(f) as Record<string, string>)?.estimatedTimeLocal ?? undefined,
        dep_actual_raw: (getDep(f) as Record<string, string>)?.actualTimeLocal ?? undefined,
        dep_delay_min: (getDep(f) as Record<string, number>)?.delay != null
          ? Number((getDep(f) as Record<string, number>).delay)
          : null,
        arr_scheduled_raw: (getArr(f) as Record<string, string>)?.scheduledTimeLocal ?? arrTime,
        arr_estimated_raw: (getArr(f) as Record<string, string>)?.estimatedTimeLocal ?? undefined,
        arr_actual_raw: (getArr(f) as Record<string, string>)?.actualTimeLocal ?? undefined,
        arr_delay_min: (getArr(f) as Record<string, number>)?.delay != null
          ? Number((getArr(f) as Record<string, number>).delay)
          : null,
        status: (f as Record<string, string>)?.status ?? undefined,
      };
    })
    .sort(
      (a, b) =>
        fromZonedTime(stripOffset(a.arrivalTime), a.dest_tz ?? destTz).getTime() -
        fromZonedTime(stripOffset(b.arrivalTime), b.dest_tz ?? destTz).getTime()
    );

  return { flights };
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

function getDepTime(f: unknown): string {
  const dep = getDep(f);
  return getTime(dep);
}

function getArrTime(f: unknown): string {
  const arr = getArr(f);
  return getTime(arr);
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
