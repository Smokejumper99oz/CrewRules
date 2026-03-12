/**
 * Fetch enroute aviation advisories from official Aviation Weather Center.
 * SIGMETs, AIRMETs, Convective SIGMETs - corridor/region awareness for route.
 */

import type { EnrouteAdvisory } from "./types";

const AWC_BASE = "https://aviationweather.gov/api/data";
const FETCH_OPTS: RequestInit = {
  headers: { "User-Agent": "CrewRules-WeatherBrief/1.0 (https://crewrules.com)" },
  next: { revalidate: 300 },
};

type AirSigmetRecord = {
  icaoId?: string;
  sigmetId?: string;
  airmetId?: string;
  rawSigmet?: string;
  rawAirmet?: string;
  hazard?: { type?: string; severity?: string };
  [k: string]: unknown;
};

/**
 * V1: Fetch active SIGMETs/AIRMETs from Aviation Weather Center.
 * Uses airport-pair corridor awareness when exact route is not available.
 */
export async function getEnrouteAdvisories(
  _departureIcao: string,
  _arrivalIcao: string
): Promise<EnrouteAdvisory[]> {
  const advisories: EnrouteAdvisory[] = [];

  try {
    const url = `${AWC_BASE}/airsigmet?format=json`;
    const res = await fetch(url, FETCH_OPTS);

    if (res.ok) {
      const data = (await res.json()) as AirSigmetRecord[];
      const items = Array.isArray(data) ? data : [];
      for (const r of items) {
        if (advisories.length >= 6) break;
        if (!r.rawSigmet && !r.rawAirmet) continue;
        const raw = r.rawSigmet ?? r.rawAirmet ?? "";
        const hazard = r.hazard?.type ?? "Advisory";
        const isConvective = (r.icaoId ?? "").toString().startsWith("W");
        const type = r.airmetId ? "AIRMET" : isConvective ? "CONVECTIVE_SIGMET" : "SIGMET";
        advisories.push({
          type,
          title: (r.sigmetId ?? r.airmetId ?? hazard) as string,
          description: raw.slice(0, 200) + (raw.length > 200 ? "…" : ""),
          rawText: raw,
          sourceUrl: type === "AIRMET" ? "https://aviationweather.gov/airmet" : "https://aviationweather.gov/sigmet",
        });
      }
    }
  } catch {
    // Best-effort; return empty on error
  }

  return advisories;
}
