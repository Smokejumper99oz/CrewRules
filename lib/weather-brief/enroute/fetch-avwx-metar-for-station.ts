/**
 * AVWX METAR fetch (server-only; AVWX_API_KEY from env).
 * Returns parsed JSON or null — use `mapAvwxMetarToSummary` to map into enroute summaries.
 *
 * @see https://avwx.rest
 */

import { unstable_cache } from "next/cache";

const AVWX_METAR_BASE = "https://avwx.rest/api/metar";
const FETCH_TIMEOUT_MS = 15_000;

const FETCH_HEADERS_BASE = {
  "User-Agent": "CrewRules-WeatherBrief/1.0 (https://crewrules.com)",
} as const;

function metarCacheTag(icao: string): string {
  return `weather-brief-metar:${icao}`;
}

async function fetchAvwxMetarUncached(icao: string, apiKey: string): Promise<unknown | null> {
  const url = `${AVWX_METAR_BASE}/${encodeURIComponent(icao)}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        ...FETCH_HEADERS_BASE,
        Authorization: `Bearer ${apiKey}`,
      },
      signal: ac.signal,
    });
    if (!res.ok) return null;
    try {
      return await res.json();
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getCachedAvwxMetar(icao: string, apiKey: string): Promise<unknown | null> {
  const tag = metarCacheTag(icao);
  const fetcher = unstable_cache(
    async () => fetchAvwxMetarUncached(icao, apiKey),
    ["weather-brief", "avwx-metar-station-v1", icao],
    {
      revalidate: 10 * 60,
      tags: [tag],
    }
  );
  return fetcher();
}

/**
 * Fetches current METAR JSON for one station (cached per ICAO). Never throws.
 */
export async function fetchAvwxMetarForStation(stationIcao: string): Promise<unknown | null> {
  const apiKey = process.env.AVWX_API_KEY?.trim();
  if (!apiKey) return null;

  const icao = stationIcao.trim().toUpperCase();
  if (!icao || icao.length < 4) return null;

  return getCachedAvwxMetar(icao, apiKey);
}
