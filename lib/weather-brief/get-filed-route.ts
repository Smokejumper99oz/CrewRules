import { fetchFiledRouteFromFlightAware, buildIdent } from "@/lib/filed-route/flightaware";
import { getCachedRoute, storeRouteInCache } from "./flight-route-cache";

export type RouteLookup = {
  flightNumber: string | null;
  origin: string;
  destination: string;
  departureIso?: string;
  tenant?: string;
};

/** Window 1: T-12h to T-9h before departure */
const WINDOW1_START_H = 12;
const WINDOW1_END_H = 9;

/** Do not refresh cache if last_checked was within this period */
const REFRESH_COOLDOWN_MS = 2 * 60 * 60 * 1000;

function isDeparted(departureIso: string): boolean {
  return new Date() > new Date(departureIso);
}

function isWithinAllowedWindow(departureIso: string): boolean {
  const now = Date.now();
  const depMs = new Date(departureIso).getTime();
  const hoursUntilDep = (depMs - now) / (60 * 60 * 1000);

  if (hoursUntilDep <= 0) return false;

  const inWindow1 = hoursUntilDep <= WINDOW1_START_H && hoursUntilDep >= WINDOW1_END_H;
  const minutesUntilDep = (depMs - now) / (60 * 1000);
  const inWindow2 =
    minutesUntilDep <= 90 && minutesUntilDep >= 30;

  return inWindow1 || inWindow2;
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
