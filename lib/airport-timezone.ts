/**
 * Map IATA airport codes to IANA timezone identifiers.
 * Used for deriving crew base timezone from base airport.
 */

export const AIRPORT_TO_TIMEZONE: Record<string, string> = {
  SJU: "America/Puerto_Rico",
  DEN: "America/Denver",
  MCO: "America/New_York",
  LAS: "America/Los_Angeles",
  PHX: "America/Phoenix",
  MIA: "America/New_York",
  ORD: "America/Chicago",
  DFW: "America/Chicago",
  ATL: "America/New_York",
  FLL: "America/New_York",
  BOS: "America/New_York",
  IAH: "America/Chicago",
  LAX: "America/Los_Angeles",
  SFO: "America/Los_Angeles",
};

const DEFAULT_TIMEZONE = "America/Denver";

/** Derive IANA timezone from IATA airport code. */
export function getTimezoneFromAirport(airport: string): string {
  if (!airport || airport.length !== 3) return DEFAULT_TIMEZONE;
  return AIRPORT_TO_TIMEZONE[airport.toUpperCase()] ?? DEFAULT_TIMEZONE;
}
