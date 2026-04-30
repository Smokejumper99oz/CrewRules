/**
 * Compact pilot-facing summary lines for the Weather Brief (server-safe).
 */

import type { AirportWeather, DelayRiskLevel, EnrouteAdvisory, OperationalWatchItem } from "./types";
import {
  pilotSummaryEmptyEnrouteMessage,
  type WeatherBriefRouteMessagingState,
} from "./weather-brief-route-messaging";

export type PilotSummaryLine = { label: string; text: string };

export type PilotSummaryResult = {
  lines: PilotSummaryLine[];
  /** When summary risk is elevated but both fields still show VFR on current METAR. */
  categoryAlignmentNote?: string;
};

function briefCondition(weather: AirportWeather, role: "dep" | "arr"): string {
  const cur = weather.decodedCurrent;
  const fcst = weather.decodedForecast;
  const curWx = (cur?.weather ?? "").trim();
  const fcstWx = (fcst?.weather ?? "").trim();
  const curCat = cur?.flightCategory ?? "UNKNOWN";
  const fcstCat = fcst?.flightCategory ?? "UNKNOWN";

  const parts: string[] = [];
  if (cur && curCat !== "UNKNOWN") parts.push(`${curCat} Observed`);
  if (fcst && fcstCat !== "UNKNOWN" && fcstCat !== curCat) parts.push(`${fcstCat} in TAF window`);
  else if (fcst && fcstCat !== "UNKNOWN" && !cur) parts.push(`${fcstCat} (TAF for flight time)`);

  const wxHint =
    fcstWx && fcstWx !== "None"
      ? fcstWx
      : curWx && curWx !== "None"
        ? curWx
        : "";
  const hasConvectiveHint = /thunder|tsra|shower|rain|snow|fog|ice/i.test(wxHint);
  if (wxHint && hasConvectiveHint && !/None/i.test(wxHint)) {
    const short = wxHint.split(",")[0]?.trim() ?? wxHint;
    if (short.length > 48) return parts.join("; ") + (parts.length ? " — " : "") + short.slice(0, 45) + "…";
    return parts.length ? `${parts.join("; ")} — ${short}` : short;
  }
  return parts.length ? parts.join("; ") : "";
}

function lineForAirport(
  role: "dep" | "arr",
  level: DelayRiskLevel,
  weather: AirportWeather,
  airportLabel: string
): string {
  const cond = briefCondition(weather, role);
  if (level === "HIGH") {
    return cond
      ? `${airportLabel}: significant constraints possible — ${cond}`
      : `${airportLabel}: significant constraints possible — check ceiling, visibility, and Operational Watch`;
  }
  if (level === "MODERATE") {
    return cond
      ? `${airportLabel}: monitor — ${cond}`
      : `${airportLabel}: monitor for ceiling, visibility, or wind per TAF/METAR`;
  }
  return cond
    ? `${airportLabel}: no major limitation indicated — ${cond}`
    : `${airportLabel}: no major limitation indicated for your times`;
}

export function buildPilotSummary(params: {
  departureAirport: string;
  arrivalAirport: string;
  departureWeather: AirportWeather;
  arrivalWeather: AirportWeather;
  departureRisk: DelayRiskLevel;
  arrivalRisk: DelayRiskLevel;
  advisories: EnrouteAdvisory[];
  watchItems: OperationalWatchItem[];
  summaryLevel: DelayRiskLevel;
  /** Display-only: empty enroute line reflects route/corridor certainty (not advisory fetch logic). */
  routeMessaging: WeatherBriefRouteMessagingState;
}): PilotSummaryResult {
  const depCode = params.departureWeather.airport?.trim() || params.departureAirport;
  const arrCode = params.arrivalWeather.airport?.trim() || params.arrivalAirport;

  const lines: PilotSummaryLine[] = [
    {
      label: "Departure",
      text: lineForAirport("dep", params.departureRisk, params.departureWeather, depCode),
    },
    {
      label: "Arrival",
      text: lineForAirport("arr", params.arrivalRisk, params.arrivalWeather, arrCode),
    },
  ];

  const warnTitles = params.watchItems.filter((w) => w.severity === "warning").map((w) => w.title);
  let enrouteText: string;
  if (params.advisories.length === 0) {
    enrouteText = pilotSummaryEmptyEnrouteMessage(params.routeMessaging);
  } else {
    const types = [...new Set(params.advisories.map((a) => a.type))];
    const typeLabel = types.map((t) => t.replace(/_/g, " ")).join(", ");
    enrouteText = `${typeLabel} for your leg — See CrewRules™ Enroute Intelligence™ below.`;
  }
  if (warnTitles.length > 0) {
    enrouteText += ` Warning: ${warnTitles[0]}.${warnTitles.length > 1 ? " Additional watch items below." : ""}`;
  }
  lines.push({ label: "Enroute", text: enrouteText });

  const depCurCat = params.departureWeather.decodedCurrent?.flightCategory;
  const arrCurCat = params.arrivalWeather.decodedCurrent?.flightCategory;
  const bothVfr =
    (depCurCat === "VFR" || depCurCat === "MVFR") && (arrCurCat === "VFR" || arrCurCat === "MVFR");
  let categoryAlignmentNote: string | undefined;
  if (params.summaryLevel === "HIGH" && depCurCat === "VFR" && arrCurCat === "VFR") {
    categoryAlignmentNote =
      "Field category badges reflect current METAR (VFR). The elevated summary uses TAF at your times, very low ceiling/vis in the forecast, or warning-level items — compare Current vs forecast blocks below.";
  } else if (params.summaryLevel === "HIGH" && bothVfr) {
    categoryAlignmentNote =
      "VFR or MVFR observed now, but the summary accounts for forecast conditions, advisories referencing your stations, or TS/convective watch items.";
  } else if (params.summaryLevel === "MODERATE" && depCurCat === "VFR" && arrCurCat === "VFR") {
    categoryAlignmentNote =
      "VFR observed at both fields; moderate summary reflects TAF window, visibility/ceiling heuristics, or enroute text mentioning your airports.";
  }

  return { lines, categoryAlignmentNote };
}
