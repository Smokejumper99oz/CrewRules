import { fetchFiledRouteFromFlightAware, buildIdent } from "@/lib/filed-route/flightaware";
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

/** Allow fetch: T-12h to departure. Block if >12h before or after departure. */
function isWithinAllowedWindow(departureIso: string): boolean {
  const now = Date.now();
  const depMs = new Date(departureIso).getTime();
  const hoursUntilDep = (depMs - now) / (60 * 60 * 1000);

  if (hoursUntilDep > 12) return false; // Too early
  if (hoursUntilDep <= 0) return false; // Departed
  return true; // 0 to 12h before: allow fetch
}

function lastCheckedWithinCooldown(lastChecked: string): boolean {
  const elapsed = Date.now() - new Date(lastChecked).getTime();
  return elapsed < REFRESH_COOLDOWN_MS;
}

export async function getFiledRoute(
  lookup: RouteLookup
): Promise<string | null> {
  if (!lookup.flightNumber) return null;

  const ident = buildIdent(lookup);
  if (!ident) return null;

  const departureIso = lookup.departureIso ?? null;

  console.log("[weather-brief] filed route lookup:", {
    flightNumber: lookup.flightNumber,
    tenant: lookup.tenant,
    ident,
    origin: lookup.origin,
    destination: lookup.destination,
    departureIso,
  });

  if (!process.env.FLIGHTAWARE_API_KEY) return null;

  if (departureIso) {
    const departed = isDeparted(departureIso);
    const cached = await getCachedRoute(ident, departureIso);

    if (cached) {
      if (departed) {
        return cached.route;
      }
      if (lastCheckedWithinCooldown(cached.last_checked)) {
        return cached.route;
      }
      if (!isWithinAllowedWindow(departureIso)) {
        return cached.route;
      }
    }

    if (departed) return cached?.route ?? null;
    if (!isWithinAllowedWindow(departureIso)) return cached?.route ?? null;
  } else {
    return null;
  }

  const route = await fetchFiledRouteFromFlightAware(lookup);
  if (route && departureIso) {
    await storeRouteInCache(
      ident,
      lookup.origin,
      lookup.destination,
      departureIso,
      route
    );
  }
  return route ?? null;
}
