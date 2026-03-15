import type { RouteLookup } from "@/lib/weather-brief/get-filed-route";
import type { FlightLiveStatus } from "@/lib/weather-brief/types";
import { TENANT_CARRIER } from "@/lib/tenant-config";
import { fetchFlightsFromAerodataBox } from "@/lib/aerodatabox";
import { parseAviationstackTs } from "@/lib/aviationstack";
import { createAdminClient } from "@/lib/supabase/admin";

export function buildIdent(lookup: RouteLookup): string {
  const raw = (lookup.flightNumber ?? "").trim().toUpperCase();
  if (!raw) return "";

  if (/^(F9|FFT)\s*/i.test(raw)) return raw;
  if (!/^\d+$/.test(raw)) return raw;

  const tenant = lookup.tenant ?? "frontier";
  const carrier = TENANT_CARRIER[tenant];
  return carrier ? `${carrier}${raw}` : raw;
}

/** Frontier fallback: F9#### ↔ FFT####. Returns null if no fallback. */
function getFallbackIdent(ident: string): string | null {
  const m = ident.match(/^(F9)(\d+)$/i);
  if (m) return `FFT${m[2]}`;
  const m2 = ident.match(/^(FFT)(\d+)$/i);
  if (m2) return `F9${m2[2]}`;
  return null;
}

async function fetchFlightsForIdent(
  ident: string,
  apiKey: string
): Promise<{ data: unknown; flights: unknown[] } | null> {
  const res = await fetch(
    `https://aeroapi.flightaware.com/aeroapi/flights/${ident}?max_pages=1`,
    {
      headers: { "x-apikey": apiKey },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    console.log("[flightaware] request failed:", res.status, ident);
    return null;
  }
  const data = (await res.json()) as { flights?: unknown[] };
  const flights = Array.isArray(data?.flights) ? data.flights : [];
  return { data, flights };
}

/** Log FlightAware usage for Super Admin cost reporting. Never throws. */
function logFlightAwareUsage(lookup: RouteLookup, ident: string): void {
  void (async () => {
    try {
      const admin = createAdminClient();
      const { error } = await admin.from("flightaware_usage").insert({
        user_id: lookup.user_id ?? null,
        tenant: lookup.tenant ?? null,
        ident,
        request_count: 1,
      });
      if (error) console.error("[flightaware] usage log failed:", error.message);
    } catch (err) {
      console.error("[flightaware] usage log failed:", err);
    }
  })();
}

export async function fetchFiledRouteFromFlightAware(
  lookup: RouteLookup
): Promise<{ route: string | null; status: FlightLiveStatus | null }> {
  const apiKey = process.env.FLIGHTAWARE_API_KEY;

  if (!apiKey || !lookup.flightNumber) return { route: null, status: null };

  try {
    let ident = buildIdent(lookup);
    if (!ident) return { route: null, status: null };

    console.log("[flightaware] primary ident:", ident);

    let result = await fetchFlightsForIdent(ident, apiKey);
    logFlightAwareUsage(lookup, ident);
    if (!result) return { route: null, status: null };

    let { data, flights } = result;
    let fallbackIdentUsed: string | null = null;

    if (!flights.length) {
      const fallback = getFallbackIdent(ident);
      if (fallback) {
        console.log("[flightaware] primary returned zero flights, trying fallback ident:", fallback);
        const fallbackResult = await fetchFlightsForIdent(fallback, apiKey);
        logFlightAwareUsage(lookup, fallback);
        if (fallbackResult && fallbackResult.flights.length > 0) {
          data = fallbackResult.data;
          flights = fallbackResult.flights;
          ident = fallback;
          fallbackIdentUsed = fallback;
          console.log("[flightaware] fallback ident produced flights:", fallback);
        }
      }
    }

    if (!flights.length) {
      console.log("[flightaware] no flights returned for:", ident);
      return { route: null, status: null };
    }

    console.log("[flightaware] response preview:", {
      ident,
      count: flights.length,
      firstFlight: flights.length
        ? {
            ident: (flights[0] as Record<string, unknown>)?.ident,
            origin: (flights[0] as Record<string, unknown>)?.origin,
            destination: (flights[0] as Record<string, unknown>)?.destination,
            scheduled_out: (flights[0] as Record<string, unknown>)?.scheduled_out,
            route: (flights[0] as Record<string, unknown>)?.route,
            filed_route: (flights[0] as Record<string, unknown>)?.filed_route,
            planned_route: (flights[0] as Record<string, unknown>)?.planned_route,
          }
        : null,
    });

    console.log("[weather-brief-debug] flightaware candidates:", {
      ident,
      fallbackIdentUsed,
      flightsLength: flights.length,
      candidates: flights.map((f: unknown) => {
        const ff = f as Record<string, unknown>;
        const orig = ff?.origin as Record<string, unknown> | undefined;
        const dest = ff?.destination as Record<string, unknown> | undefined;
        return {
          ident: ff?.ident,
          "origin.code_iata": orig?.code_iata,
          "origin.code": orig?.code,
          "destination.code_iata": dest?.code_iata,
          "destination.code": dest?.code,
          scheduled_out: ff?.scheduled_out,
          estimated_out: ff?.estimated_out,
          actual_out: ff?.actual_out,
          scheduled_in: ff?.scheduled_in,
          estimated_in: ff?.estimated_in,
          actual_in: ff?.actual_in,
          status: ff?.status,
          cancelled: ff?.cancelled,
        };
      }),
    });

    const targetDepartureIso = lookup.departureIso ?? null;
    const targetTimeMs = targetDepartureIso ? new Date(targetDepartureIso).getTime() : null;
    const WINDOW_MS = 18 * 60 * 60 * 1000;

    const rawMatched =
      flights.find((f: unknown) => {
        const ff = f as Record<string, unknown>;
        const origin = (ff?.origin as Record<string, unknown>)?.code_iata ?? (ff?.origin as Record<string, unknown>)?.code ?? null;
        const destination = (ff?.destination as Record<string, unknown>)?.code_iata ?? (ff?.destination as Record<string, unknown>)?.code ?? null;
        if (origin !== lookup.origin || destination !== lookup.destination) return false;

        const dep = ff?.scheduled_out ?? ff?.estimated_out ?? ff?.actual_out ?? null;
        if (!targetTimeMs) return true;

        if (!dep) return false;
        const depTimeMs = new Date(dep as string).getTime();
        if (isNaN(depTimeMs)) return false;
        return Math.abs(depTimeMs - targetTimeMs) <= WINDOW_MS;
      }) ?? flights[0];

    const matched = rawMatched as Record<string, unknown>;

    console.log("[weather-brief-debug] FlightAware matched flight:", {
      ident,
      fallbackIdentUsed,
      "lookup.origin": lookup.origin,
      "lookup.destination": lookup.destination,
      "matched.ident": matched?.ident,
      "matched.scheduled_out": matched?.scheduled_out,
      "matched.estimated_out": matched?.estimated_out,
      "matched.actual_out": matched?.actual_out,
      "matched.scheduled_in": matched?.scheduled_in,
      "matched.estimated_in": matched?.estimated_in,
      "matched.actual_in": matched?.actual_in,
      "matched.departure_delay": matched?.departure_delay,
      "matched.arrival_delay": matched?.arrival_delay,
      "matched.status": matched?.status,
      "matched.cancelled": matched?.cancelled,
    });

    const route =
      matched?.route ||
      matched?.filed_route ||
      matched?.planned_route ||
      null;

    const matchedDep = matched?.scheduled_out ?? matched?.estimated_out ?? matched?.actual_out ?? null;
    const timeDiffHours =
      targetDepartureIso && matchedDep
        ? Math.abs(new Date(matchedDep as string).getTime() - new Date(targetDepartureIso).getTime()) / (60 * 60 * 1000)
        : null;

    console.log("[flightaware] matched flight route:", {
      ident,
      origin: lookup.origin,
      destination: lookup.destination,
      targetDepartureIso,
      matchedDeparture: matchedDep,
      timeDiffHours: timeDiffHours != null ? Math.round(timeDiffHours * 100) / 100 : null,
      route,
    });

    const routeStr = typeof route === "string" && route.trim() ? route.trim() : null;

    const status: FlightLiveStatus | null = matched
      ? {
          dep_scheduled_raw: (matched.scheduled_out as string) ?? null,
          dep_estimated_raw: (matched.estimated_out as string) ?? null,
          dep_actual_raw: (matched.actual_out as string) ?? null,
          arr_scheduled_raw: (matched.scheduled_in as string) ?? null,
          arr_estimated_raw: (matched.estimated_in as string) ?? null,
          arr_actual_raw: (matched.actual_in as string) ?? null,
          status: (matched.status as string) ?? null,
          cancelled: (matched.cancelled as boolean) ?? false,
          departure_delay: (matched.departure_delay as number) ?? null,
          arrival_delay: (matched.arrival_delay as number) ?? null,
        }
      : null;

    if (routeStr) return { route: routeStr, status };

    console.log("[flightaware] route not yet available for flight:", {
      ident,
      origin: lookup.origin,
      destination: lookup.destination,
      targetDepartureIso,
      matchedDeparture: matchedDep,
    });
    return { route: null, status };
  } catch (error) {
    console.log("[flightaware] lookup error:", error);
    return { route: null, status: null };
  }
}

/** Convert local timestamp to ISO UTC for FlightLiveStatus. Returns null if invalid. */
function localToIso(local: string | undefined, tz: string): string | null {
  if (!local?.trim()) return null;
  try {
    const d = parseAviationstackTs(local, tz);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

/** Extract numeric flight number for matching (e.g. "F9 4462" or "FFT4462" -> "4462"). */
function extractNumericFlightNumber(s: string): string {
  const m = s.match(/\d{3,5}/);
  return m ? m[0] : s.replace(/\D/g, "") || "";
}

/** Try AeroDataBox fallback when FlightAware returns no match. Returns status only (no route). */
async function tryAeroDataBoxFallback(
  lookup: RouteLookup
): Promise<FlightLiveStatus | null> {
  const { flightNumber, origin, destination, departureIso } = lookup;
  if (!flightNumber || !origin || !destination || !departureIso) return null;
  if (!process.env.RAPIDAPI_KEY) return null;

  const dateStr = departureIso.slice(0, 10);
  const targetDepMs = new Date(departureIso).getTime();
  const WINDOW_MS = 4 * 60 * 60 * 1000; // ±4h for matching

  try {
    const { flights } = await fetchFlightsFromAerodataBox(origin, destination, dateStr);
    const lookupNumeric = extractNumericFlightNumber(flightNumber.trim());

    const matched = flights.find((f) => {
      if (f.origin?.toUpperCase() !== origin.toUpperCase()) return false;
      if (f.destination?.toUpperCase() !== destination.toUpperCase()) return false;
      const fNumeric = extractNumericFlightNumber(f.flightNumber ?? "");
      if (fNumeric !== lookupNumeric) return false;
      const depRaw = f.dep_scheduled_raw ?? f.departureTime;
      if (!depRaw || !f.origin_tz) return false;
      try {
        const depMs = parseAviationstackTs(depRaw, f.origin_tz).getTime();
        return Math.abs(depMs - targetDepMs) <= WINDOW_MS;
      } catch {
        return false;
      }
    });

    if (!matched) return null;

    const depTz = matched.origin_tz ?? "UTC";
    const arrTz = matched.dest_tz ?? "UTC";

    return {
      dep_scheduled_raw: localToIso(matched.dep_scheduled_raw ?? matched.departureTime, depTz),
      dep_estimated_raw: localToIso(matched.dep_estimated_raw, depTz),
      dep_actual_raw: localToIso(matched.dep_actual_raw, depTz),
      arr_scheduled_raw: localToIso(matched.arr_scheduled_raw ?? matched.arrivalTime, arrTz),
      arr_estimated_raw: localToIso(matched.arr_estimated_raw, arrTz),
      arr_actual_raw: localToIso(matched.arr_actual_raw, arrTz),
      status: matched.status ?? null,
      cancelled: matched.status?.toLowerCase() === "cancelled",
      departure_delay: matched.dep_delay_min != null ? matched.dep_delay_min * 60 : null,
      arrival_delay: matched.arr_delay_min != null ? matched.arr_delay_min * 60 : null,
    };
  } catch (error) {
    console.log("[flightaware] AeroDataBox fallback error:", error);
    return null;
  }
}

/**
 * Fetch filed route and live status. Tries FlightAware first, then AeroDataBox when status is null.
 */
export async function fetchFiledRouteWithFallback(
  lookup: RouteLookup
): Promise<{ route: string | null; status: FlightLiveStatus | null }> {
  const faResult = await fetchFiledRouteFromFlightAware(lookup);
  const adbStatus = faResult.status === null ? await tryAeroDataBoxFallback(lookup) : null;
  return {
    route: faResult.route ?? null,
    status: adbStatus ?? faResult.status ?? null,
  };
}
