import type { RouteLookup } from "@/lib/weather-brief/get-filed-route";
import { TENANT_CARRIER } from "@/lib/tenant-config";

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

export async function fetchFiledRouteFromFlightAware(
  lookup: RouteLookup
): Promise<string | null> {
  const apiKey = process.env.FLIGHTAWARE_API_KEY;

  if (!apiKey || !lookup.flightNumber) return null;

  try {
    let ident = buildIdent(lookup);
    if (!ident) return null;

    console.log("[flightaware] primary ident:", ident);

    let result = await fetchFlightsForIdent(ident, apiKey);
    if (!result) return null;

    let { data, flights } = result;

    if (!flights.length) {
      const fallback = getFallbackIdent(ident);
      if (fallback) {
        console.log("[flightaware] primary returned zero flights, trying fallback ident:", fallback);
        const fallbackResult = await fetchFlightsForIdent(fallback, apiKey);
        if (fallbackResult && fallbackResult.flights.length > 0) {
          data = fallbackResult.data;
          flights = fallbackResult.flights;
          ident = fallback;
          console.log("[flightaware] fallback ident produced flights:", fallback);
        }
      }
    }

    if (!flights.length) {
      console.log("[flightaware] no flights returned for:", ident);
      return null;
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

    if (typeof route === "string" && route.trim()) return route.trim();

    console.log("[flightaware] route not yet available for flight:", {
      ident,
      origin: lookup.origin,
      destination: lookup.destination,
      targetDepartureIso,
      matchedDeparture: matchedDep,
    });
    return null;
  } catch (error) {
    console.log("[flightaware] lookup error:", error);
    return null;
  }
}
