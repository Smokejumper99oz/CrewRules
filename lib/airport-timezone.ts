/**
 * Map IATA airport codes to IANA timezone identifiers.
 * Used for deriving crew base timezone from base airport.
 */

/** Frontier Airlines crew bases → IANA timezone. */
export const AIRPORT_TO_TIMEZONE: Record<string, string> = {
  ATL: "America/New_York",
  BDL: "America/New_York",
  BOS: "America/New_York",
  CLT: "America/New_York",
  CLE: "America/New_York",
  CVG: "America/New_York",
  DCA: "America/New_York",
  DEN: "America/Denver",
  DFW: "America/Chicago",
  EWR: "America/New_York",
  IAD: "America/New_York",
  JFK: "America/New_York",
  LAS: "America/Los_Angeles",
  LGA: "America/New_York",
  MCO: "America/New_York",
  MDW: "America/Chicago",
  MIA: "America/New_York",
  ORD: "America/Chicago",
  PHL: "America/New_York",
  PHX: "America/Phoenix",
  RDU: "America/New_York",
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
