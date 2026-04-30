/**
 * Enroute weather: unified per-station model (METAR + PIREP summaries).
 * Full raw provider payloads stay outside this shape.
 */

/** Normalize LIFR to IFR before building summaries. */
export type EnrouteFlightCategory = "VFR" | "MVFR" | "IFR" | "UNKNOWN";

export type EnrouteTurbulenceMax = "NONE" | "LGT" | "MOD" | "SEV" | "UNKNOWN";

export type EnrouteIcingMax = "NONE" | "TRACE" | "LGT" | "MOD" | "SEV" | "UNKNOWN";

export type EnrouteRiskLevel = "HIGH" | "MODERATE" | "LOW" | "NONE";

export type EnrouteStationMetarSummary = {
  flightCategory: EnrouteFlightCategory;
  ceilingLabel: string;
  visibilityLabel: string;
  wxLabel: string;
  hasAnyWx: boolean;
  hasConvectiveWx: boolean;
  observedAt: string | null;
  isStale?: boolean;
};

export type EnrouteStationPirepSummary = {
  hasReports: boolean;
  turbulenceMax: EnrouteTurbulenceMax;
  icingMax: EnrouteIcingMax;
  convectionReported: boolean;
  nearestDistanceNm: number | null;
  reportCount: number;
  headline: string;
};

export type EnrouteStationForecastSummary = {
  flightCategory: EnrouteFlightCategory;
  ceilingLabel: string;
  visibilityLabel: string;
  windLabel: string;
  precipChance?: number;
  hasThunder: boolean;
  hasIcing: boolean;
  forecastAt: string | null;
};

export type EnrouteStation = {
  icao: string;
  order: number;
  metar: EnrouteStationMetarSummary;
  pirep: EnrouteStationPirepSummary;
  forecast?: EnrouteStationForecastSummary;
  risk: EnrouteRiskLevel;
};

export type EnrouteStationRiskInput = Omit<EnrouteStation, "risk">;
