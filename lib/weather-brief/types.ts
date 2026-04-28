/**
 * Weather Brief types for pilot-focused flight weather.
 */

export type FlightLiveStatus = {
  dep_scheduled_raw?: string | null;
  dep_estimated_raw?: string | null;
  dep_actual_raw?: string | null;
  arr_scheduled_raw?: string | null;
  arr_estimated_raw?: string | null;
  arr_actual_raw?: string | null;
  status?: string | null;
  cancelled?: boolean;
  departure_delay?: number | null;
  arrival_delay?: number | null;
};

export type NextFlight = {
  status: "flight";
  eventId: string;
  flightNumber: string | null;
  filedRoute?: string | null;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string | null;
  /** Departure time in UTC (HH:mm) */
  departureTimeUtc?: string | null;
  /** Arrival time in UTC (HH:mm) */
  arrivalTimeUtc?: string | null;
  reportTime?: string | null;
  aircraft?: string | null;
  tripNumber?: string | null;
  /** Block time in minutes (for Flight Time display) */
  blockMinutes?: number | null;
  /** ISO timestamp for departure (for TAF window selection) */
  departureIso?: string;
  /** ISO timestamp for arrival (for TAF window selection) */
  arrivalIso?: string | null;
  /** Live status from FlightAware (optional). FLICA times remain baseline. */
  liveStatus?: FlightLiveStatus | null;
};

export type ReserveState = {
  status: "reserve";
};

/** Logged-in user is not on reserve duty but has no trip/leg we can brief (or unauthenticated edge). */
export type NoUpcomingTripState = {
  status: "no_upcoming_trip";
};

export type NextFlightResult = NextFlight | ReserveState | NoUpcomingTripState;

export type DecodedWeather = {
  wind: string;
  visibility: string;
  skyCeiling: string;
  altimeter: string;
  tempDew: string;
  weather: string;
  flightCategory: "VFR" | "MVFR" | "IFR" | "LIFR" | "UNKNOWN";
  operationalNote?: string | null;
  /**
   * Lowest BKN/OVC/VV/OVX base (ft) from structured layers — used for ceiling risk only.
   * Null when no ceiling-driving layer or base missing (do not infer from display string).
   */
  operationalCeilingFt?: number | null;
};

/** AWC METAR/TAF pipeline failure, distinct from “decoded OK”. */
export type WeatherBriefProductError =
  | { error: "fetch_failed"; source: "metar" | "taf" }
  | { error: "http_error"; status: number }
  | { error: "no_data" };

export type AirportWeather = {
  airport: string;
  airportName?: string | null;
  localTimeLabel?: string | null;
  zuluTimeLabel?: string | null;
  updatedAt?: string | null;
  metarRaw?: string | null;
  tafRaw?: string | null;
  /** When set, Observed (METAR) block shows a specific failure message. */
  metarError?: WeatherBriefProductError | null;
  /** When set, TAF-time block shows a specific failure message. */
  tafError?: WeatherBriefProductError | null;
  decodedCurrent?: DecodedWeather | null;
  decodedForecast?: DecodedWeather | null;
  forecastWindowLabel?: string | null;
  /** Same TAF period as decodedForecast — used for TS logic (not whole bulletin). */
  tafSelectedPeriodRawLine?: string | null;
  tafSelectedPeriodWxString?: string | null;
  sourceLinks: {
    metarTaf: string;
    airportStatus?: string;
    notams?: string;
  };
};

/**
 * Placeholder for a future supplemental layer (e.g. hourly precip/vis).
 * Not fetched; keeps extension point without coupling imports.
 */
export type SupplementalWeatherLayer = {
  provider?: "weatherstack" | string;
  /** When wired, ISO fetch time for cache/UI */
  fetchedAt?: string;
};

export type DelayRiskLevel = "LOW" | "MODERATE" | "HIGH";

export type EnrouteAdvisory = {
  type: "SIGMET" | "AIRMET" | "CONVECTIVE_SIGMET" | "PIREP";
  title: string;
  description: string;
  rawText?: string | null;
  sourceUrl?: string | null;
};

export type OperationalWatchItem = {
  severity: "info" | "caution" | "warning";
  title: string;
  detail: string;
};
