import type { EnrouteStation } from "./types";

const ICING_FOR_SUMMARY = new Set(["LGT", "MOD", "SEV"]);
const TURBULENCE_FOR_SUMMARY = new Set(["MOD", "SEV"]);

function countStations(
  stations: EnrouteStation[],
  predicate: (s: EnrouteStation) => boolean
): number {
  let n = 0;
  for (const s of stations) {
    if (predicate(s)) n += 1;
  }
  return n;
}

function withStationCount(message: string, count: number): string {
  if (count >= 2) return `${message} (${count} stations)`;
  return message;
}

/**
 * One top-line message for the full enroute list. First matching rule wins.
 */
export function summarizeEnrouteRoute(stations: EnrouteStation[]): string {
  const nConvective = countStations(
    stations,
    (s) => s.metar.hasConvectiveWx || s.pirep.convectionReported
  );
  if (nConvective > 0) {
    return withStationCount("Convective activity along route", nConvective);
  }

  const nIfr = countStations(stations, (s) => s.metar.flightCategory === "IFR");
  if (nIfr > 0) {
    return withStationCount("IFR conditions along route", nIfr);
  }

  const nIcing = countStations(stations, (s) => ICING_FOR_SUMMARY.has(s.pirep.icingMax));
  if (nIcing > 0) {
    return withStationCount("Icing reported along route", nIcing);
  }

  const nTurb = countStations(stations, (s) => TURBULENCE_FOR_SUMMARY.has(s.pirep.turbulenceMax));
  if (nTurb > 0) {
    return withStationCount("Turbulence reported along route", nTurb);
  }

  return "No significant weather";
}
