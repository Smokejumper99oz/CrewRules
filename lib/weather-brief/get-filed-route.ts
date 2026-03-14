import { fetchFiledRouteWithFallback, buildIdent } from "@/lib/filed-route/flightaware";
import type { FlightLiveStatus } from "./types";
import { getCachedRoute, storeRouteInCache } from "./flight-route-cache";

export type RouteLookup = {
  flightNumber: string | null;
  origin: string;
  destination: string;
  departureIso?: string;
  tenant?: string;
};

/** Do not refresh cache if last_checked was within this period */
const REFRESH_COOLDOWN_MS = 2 * 60 * 60 * 1000;

function isDeparted(departureIso: string): boolean {
  return new Date() > new Date(departureIso);
}

/** Allow fetch: T-12h to departure until +6h after. Block if >12h before or >6h after. */
function isWithinAllowedWindow(departureIso: string): boolean {
  const now = Date.now();
  const depMs = new Date(departureIso).getTime();
  const hoursUntilDep = (depMs - now) / (60 * 60 * 1000);

  if (hoursUntilDep > 12) return false; // Too early
  if (hoursUntilDep <= -6) return false; // More than 6h after departure
  return true; // 12h before to 6h after: allow fetch
}

function lastCheckedWithinCooldown(lastChecked: string): boolean {
  const elapsed = Date.now() - new Date(lastChecked).getTime();
  return elapsed < REFRESH_COOLDOWN_MS;
}

export async function getFiledRoute(
  lookup: RouteLookup
): Promise<{ route: string | null; status: FlightLiveStatus | null }> {
  if (!lookup.flightNumber) return { route: null, status: null };

  const ident = buildIdent(lookup);
  if (!ident) return { route: null, status: null };

  const departureIso = lookup.departureIso ?? null;

  console.log("[weather-brief] filed route lookup:", {
    flightNumber: lookup.flightNumber,
    tenant: lookup.tenant,
    ident,
    origin: lookup.origin,
    destination: lookup.destination,
    departureIso,
  });

  if (!process.env.FLIGHTAWARE_API_KEY) return { route: null, status: null };

  if (departureIso) {
    const departed = isDeparted(departureIso);
    const cached = await getCachedRoute(ident, departureIso);

    if (cached) {
      if (departed && !isWithinAllowedWindow(departureIso)) {
        return { route: cached.route, status: null };
      }
      if (lastCheckedWithinCooldown(cached.last_checked)) {
        return { route: cached.route, status: null };
      }
      if (!isWithinAllowedWindow(departureIso)) {
        return { route: cached.route, status: null };
      }
    }

    if (departed && !isWithinAllowedWindow(departureIso)) return { route: cached?.route ?? null, status: null };
    if (!isWithinAllowedWindow(departureIso)) return { route: cached?.route ?? null, status: null };
  } else {
    return { route: null, status: null };
  }

  const { route, status } = await fetchFiledRouteWithFallback(lookup);
  if (route && departureIso) {
    await storeRouteInCache(
      ident,
      lookup.origin,
      lookup.destination,
      departureIso,
      route
    );
  }
  return { route: route ?? null, status };
}
