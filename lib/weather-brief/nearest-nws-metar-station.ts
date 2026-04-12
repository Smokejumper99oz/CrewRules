/**
 * Resolve the nearest NWS observation station ICAO for a lat/lng (US + territories).
 * Used for dashboard geo weather: station IDs map to AWC METAR in most cases.
 *
 * LIMITATION: NWS api.weather.gov only covers their forecast domain. Outside that
 * (most international locations), this returns null — callers should fall back.
 */

const NWS_USER_AGENT = "CrewRules-DashboardWeather/1.0 (https://crewrules.com)";
const FETCH_TIMEOUT_MS = 8000;

type NwsPointProperties = {
  observationStations?: string;
};

type NwsStationFeature = {
  geometry?: { type?: string; coordinates?: [number, number] };
  properties?: { stationIdentifier?: string };
};

type NwsStationsCollection = {
  features?: NwsStationFeature[];
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/geo+json",
        "User-Agent": NWS_USER_AGENT,
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Returns a station identifier suitable for getHomeBaseMetar / resolveStationCode (e.g. KDEN),
 * or null if NWS cannot resolve a nearby station.
 */
export async function resolveNearestNwsMetarStationIcao(
  lat: number,
  lng: number
): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const pointsUrl = `https://api.weather.gov/points/${lat},${lng}`;
  const point = await fetchJson<{ properties?: NwsPointProperties }>(pointsUrl);
  const stationsUrl = point?.properties?.observationStations?.trim();
  if (!stationsUrl) return null;

  const collection = await fetchJson<NwsStationsCollection>(stationsUrl);
  const features = collection?.features;
  if (!features?.length) return null;

  let bestId: string | null = null;
  let bestKm = Infinity;

  for (const f of features) {
    const coords = f.geometry?.coordinates;
    const id = f.properties?.stationIdentifier?.trim();
    if (!coords || coords.length < 2 || !id) continue;
    const [stationLon, stationLat] = coords;
    if (!Number.isFinite(stationLat) || !Number.isFinite(stationLon)) continue;
    const km = haversineKm(lat, lng, stationLat, stationLon);
    if (km < bestKm) {
      bestKm = km;
      bestId = id.toUpperCase();
    }
  }

  return bestId;
}
