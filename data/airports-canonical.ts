/**
 * Canonical airport dataset for CrewRules™.
 * Single source of truth for IATA → timezone. Used by migrations and validation.
 * When adding airports: 1) update this file, 2) run `npm run generate:airports-migration`,
 * 3) create new migration with the output (e.g. 079_airports_canonical_upsert.sql).
 */

export type AirportRecord = {
  iata: string;
  icao?: string;
  name?: string;
  city?: string;
  tz: string;
};

/** All airports used by CrewRules™ (bases, commute cities, Family View, etc.). */
export const AIRPORTS_CANONICAL: readonly AirportRecord[] = [
  { iata: "ATL", icao: "KATL", name: "Hartsfield-Jackson Atlanta", city: "Atlanta", tz: "America/New_York" },
  { iata: "BOS", icao: "KBOS", name: "Boston Logan", city: "Boston", tz: "America/New_York" },
  { iata: "CLE", icao: "KCLE", name: "Cleveland Hopkins", city: "Cleveland", tz: "America/New_York" },
  { iata: "CLT", icao: "KCLT", name: "Charlotte Douglas", city: "Charlotte", tz: "America/New_York" },
  { iata: "CVG", icao: "KCVG", name: "Cincinnati Northern Kentucky", city: "Cincinnati", tz: "America/New_York" },
  { iata: "DEN", icao: "KDEN", name: "Denver", city: "Denver", tz: "America/Denver" },
  { iata: "DFW", icao: "KDFW", name: "Dallas Fort Worth", city: "Dallas/Fort Worth", tz: "America/Chicago" },
  { iata: "FLL", icao: "KFLL", name: "Fort Lauderdale-Hollywood", city: "Fort Lauderdale", tz: "America/New_York" },
  { iata: "IAH", icao: "KIAH", name: "George Bush Houston", city: "Houston", tz: "America/Chicago" },
  { iata: "LAS", icao: "KLAS", name: "Harry Reid Las Vegas", city: "Las Vegas", tz: "America/Los_Angeles" },
  { iata: "LAX", icao: "KLAX", name: "Los Angeles", city: "Los Angeles", tz: "America/Los_Angeles" },
  { iata: "MDW", icao: "KMDW", name: "Chicago Midway", city: "Chicago-Midway", tz: "America/Chicago" },
  { iata: "MIA", icao: "KMIA", name: "Miami", city: "Miami", tz: "America/New_York" },
  { iata: "MCO", icao: "KMCO", name: "Orlando", city: "Orlando", tz: "America/New_York" },
  { iata: "ORD", icao: "KORD", name: "Chicago O'Hare", city: "Chicago-O'Hare", tz: "America/Chicago" },
  { iata: "PHL", icao: "KPHL", name: "Philadelphia", city: "Philadelphia", tz: "America/New_York" },
  { iata: "PHX", icao: "KPHX", name: "Phoenix Sky Harbor", city: "Phoenix", tz: "America/Phoenix" },
  { iata: "SAV", icao: "KSAV", name: "Savannah/Hilton Head", city: "Savannah", tz: "America/New_York" },
  { iata: "SJU", icao: "TJSJ", name: "San Juan Luis Muñoz Marín", city: "San Juan", tz: "America/Puerto_Rico" },
  { iata: "SFO", icao: "KSFO", name: "San Francisco", city: "San Francisco", tz: "America/Los_Angeles" },
  { iata: "TPA", icao: "KTPA", name: "Tampa", city: "Tampa", tz: "America/New_York" },
] as const;
