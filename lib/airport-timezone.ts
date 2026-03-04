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
};

const DEFAULT_TIMEZONE = "America/Denver";

/** Derive IANA timezone from IATA airport code. */
export function getTimezoneFromAirport(airport: string): string {
  if (!airport || airport.length !== 3) return DEFAULT_TIMEZONE;
  return AIRPORT_TO_TIMEZONE[airport.toUpperCase()] ?? DEFAULT_TIMEZONE;
}
