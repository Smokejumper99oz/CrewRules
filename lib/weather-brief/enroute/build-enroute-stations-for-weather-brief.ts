/**
 * Builds `EnrouteStation[]` from a filed route string: AVWX METAR + AWC PIREP summary,
 * then attaches optional NBM forecast per station (batched concurrency).
 */

import { resolveStationCode } from "../resolve-station-code";
import type { EnrouteStation, EnrouteStationRiskInput } from "./types";
import { fetchAvwxMetarForStation } from "./fetch-avwx-metar-for-station";
import { fetchAwcPirepSummaryForStation } from "./fetch-awc-pireps-for-station";
import { fetchNbmForecastStepForStation } from "./fetch-nbm-forecast-for-station";
import { mapAvwxMetarToSummary } from "./metar-mapper";
import { mapNbmForecastStepToSummary } from "./nbm-mapper";
import { computeEnrouteRiskLevel } from "./risk";

/** Limit enroute waypoint METAR/NBM work when routes list many airport-like tokens. */
const MAX_ENROUTE_STATIONS = 24;

/** Cap simultaneous station builds (each does METAR then NBM sequentially). */
const STATION_BATCH_SIZE = 3;

function looksLikeAirportCode(token: string): boolean {
  return /^[A-Za-z]{3}$/.test(token) || /^[A-Za-z]{4}$/.test(token);
}

function cleanRouteToken(t: string): string {
  return t.replace(/^\.+|\.+$/g, "").trim();
}

/**
 * Picks ordered intermediate ICAOs from a FlightAware-style route: 3- and 4-letter tokens only
 * (excludes origin/destination and duplicates). Does not interpret airways.
 */
export function extractIntermediateAirportIcaoCodesFromFiledRoute(
  filedRouteText: string | null | undefined,
  originIcao: string,
  destinationIcao: string
): string[] {
  if (!filedRouteText?.trim()) return [];

  const dep = resolveStationCode(originIcao).toUpperCase();
  const arr = resolveStationCode(destinationIcao).toUpperCase();
  const tokens = filedRouteText.trim().split(/\s+/);
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of tokens) {
    const t = cleanRouteToken(raw);
    if (!looksLikeAirportCode(t)) continue;
    const icao = resolveStationCode(t).toUpperCase();
    if (icao.length < 4) continue;
    if (icao === dep || icao === arr) continue;
    if (seen.has(icao)) continue;
    seen.add(icao);
    out.push(icao);
  }

  return out;
}

/** Spread station ETAs linearly between departure and arrival (exclusive of endpoints). */
function interpolateEtasIso(count: number, departureIso: string, arrivalIso: string): string[] {
  if (count <= 0) return [];
  const t0 = new Date(departureIso).getTime();
  const t1 = new Date(arrivalIso).getTime();
  if (isNaN(t0) || isNaN(t1) || t1 <= t0) return [];

  const etas: string[] = [];
  for (let i = 0; i < count; i++) {
    const frac = (i + 1) / (count + 1);
    const ms = Math.round(t0 + (t1 - t0) * frac);
    etas.push(new Date(ms).toISOString());
  }
  return etas;
}

/**
 * Minimal route sample when filed route text yields no intermediate airport tokens: use origin
 * and destination ICAOs only. Temporary until true route geometry / along-track sampling exists.
 */
function buildFallbackRouteSampleCodes(originIcao: string, destinationIcao: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [originIcao, destinationIcao]) {
    const c = resolveStationCode(raw ?? "").trim().toUpperCase();
    if (!c || c.length < 4) continue;
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

async function buildOneEnrouteStation(
  icao: string,
  order: number,
  etaIso: string
): Promise<EnrouteStation> {
  const [metarPayload, pirepSummary] = await Promise.all([
    fetchAvwxMetarForStation(icao),
    fetchAwcPirepSummaryForStation(icao),
  ]);
  const metar = mapAvwxMetarToSummary(metarPayload);

  let station: EnrouteStationRiskInput = {
    icao,
    order,
    metar,
    pirep: pirepSummary,
  };

  const nbmResult = await fetchNbmForecastStepForStation({ stationIcao: icao, etaIso });
  if (nbmResult.ok === true) {
    station = {
      ...station,
      forecast: mapNbmForecastStepToSummary(nbmResult.step),
    };
  }

  const risk = computeEnrouteRiskLevel(station);

  return { ...station, risk };
}

export type BuildEnrouteStationsForWeatherBriefParams = {
  filedRouteText: string | null | undefined;
  originIcao: string;
  destinationIcao: string;
  departureIso: string;
  arrivalIso: string;
};

/**
 * Server-only: intermediate filed-route airports → METAR + AWC PIREP summary + optional NBM
 * `forecast` when the NBM call succeeds. Never throws.
 */
export async function buildEnrouteStationsForWeatherBrief(
  params: BuildEnrouteStationsForWeatherBriefParams
): Promise<EnrouteStation[]> {
  let codes = extractIntermediateAirportIcaoCodesFromFiledRoute(
    params.filedRouteText,
    params.originIcao,
    params.destinationIcao
  ).slice(0, MAX_ENROUTE_STATIONS);

  if (codes.length === 0) {
    codes = buildFallbackRouteSampleCodes(params.originIcao, params.destinationIcao).slice(
      0,
      MAX_ENROUTE_STATIONS
    );
  }

  const etas = interpolateEtasIso(codes.length, params.departureIso, params.arrivalIso);
  if (codes.length === 0 || etas.length !== codes.length) {
    return [];
  }

  const out: EnrouteStation[] = [];
  for (let i = 0; i < codes.length; i += STATION_BATCH_SIZE) {
    const slice = codes.slice(i, i + STATION_BATCH_SIZE);
    const sliceEtas = etas.slice(i, i + STATION_BATCH_SIZE);
    const batch = await Promise.all(
      slice.map((icao, j) => buildOneEnrouteStation(icao, i + j + 1, sliceEtas[j]!))
    );
    out.push(...batch);
  }
  return out;
}
