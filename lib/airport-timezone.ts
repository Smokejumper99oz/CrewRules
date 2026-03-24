/**
 * Map IATA airport codes to IANA timezone identifiers.
 * Used for deriving crew base timezone from base airport.
 */

/** Frontier Airlines crew bases → IANA timezone. */
export const AIRPORT_TO_TIMEZONE: Record<string, string> = {
  ATL: "America/New_York",
  MDW: "America/Chicago",
  ORD: "America/Chicago",
  CVG: "America/New_York",
  CLE: "America/New_York",
  DFW: "America/Chicago",
  DEN: "America/Denver",
  LAS: "America/Los_Angeles",
  MIA: "America/New_York",
  MCO: "America/New_York",
  PHL: "America/New_York",
  PHX: "America/Phoenix",
  SJU: "America/Puerto_Rico",
  TPA: "America/New_York",
};

export const DEFAULT_TIMEZONE = "America/Denver";

/** ICAO 4-letter codes that need special handling (non-K prefix). */
const ICAO_TO_IATA: Record<string, string> = {
  TJSJ: "SJU",
  TJNR: "NRR",
  TIST: "STT",
  TISX: "STX",
};

/** Derive IANA timezone from IATA or ICAO airport code. */
export function getTimezoneFromAirport(airport: string): string {
  const code = (airport ?? "").trim().toUpperCase();
  if (!code) return DEFAULT_TIMEZONE;
  if (code.length === 3) return AIRPORT_TO_TIMEZONE[code] ?? DEFAULT_TIMEZONE;
  if (code.length === 4) {
    const iata = ICAO_TO_IATA[code] ?? (code.startsWith("K") ? code.slice(1) : null);
    return iata ? AIRPORT_TO_TIMEZONE[iata] ?? DEFAULT_TIMEZONE : DEFAULT_TIMEZONE;
  }
  return DEFAULT_TIMEZONE;
}
