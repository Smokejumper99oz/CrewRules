/**
 * Resolve schedule airport codes to the correct METAR/TAF station code for AWC.
 * AWC expects ICAO 4-letter station identifiers (e.g. TJSJ, KPHL).
 */

export function resolveStationCode(airport: string): string {
  const code = (airport ?? "").trim().toUpperCase();
  if (!code) return code;

  if (code.length === 4) return code;

  if (code === "SJU") return "TJSJ";

  if (code.length === 3) return "K" + code;

  return code;
}
