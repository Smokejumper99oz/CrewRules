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

export type NextFlightResult = NextFlight | ReserveState;

export type DecodedWeather = {
  wind: string;
  visibility: string;
  skyCeiling: string;
  altimeter: string;
  tempDew: string;
  weather: string;
  flightCategory: "VFR" | "MVFR" | "IFR" | "LIFR" | "UNKNOWN";
  operationalNote?: string | null;
};

export type AirportWeather = {
  airport: string;
  airportName?: string | null;
  localTimeLabel?: string | null;
  zuluTimeLabel?: string | null;
  updatedAt?: string | null;
  metarRaw?: string | null;
  tafRaw?: string | null;
  decodedCurrent?: DecodedWeather | null;
  decodedForecast?: DecodedWeather | null;
  forecastWindowLabel?: string | null;
  sourceLinks: {
    metarTaf: string;
    airportStatus?: string;
    notams?: string;
  };
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
