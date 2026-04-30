/**
 * Compute delay risk and operational watch items from weather data.
 */

import type {
  AirportWeather,
  DecodedWeather,
  DelayRiskLevel,
  EnrouteAdvisory,
  OperationalWatchItem,
} from "./types";
import { thunderstormClassFromTafPeriod } from "./taf-period-thunderstorm";

function maxDelayLevel(a: DelayRiskLevel, b: DelayRiskLevel): DelayRiskLevel {
  const rank: Record<DelayRiskLevel, number> = { LOW: 0, MODERATE: 1, HIGH: 2 };
  return rank[a] >= rank[b] ? a : b;
}

function dedupeTriggers(triggers: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of triggers) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

function riskFromDecoded(
  d: DecodedWeather | null | undefined,
  contextForDisplay: string,
  contextForReason: "departure" | "arrival"
): {
  level: DelayRiskLevel;
  reason: string;
  triggers?: string[];
} {
  if (!d) {
    return { level: "LOW", reason: "", triggers: [] };
  }

  const triggers: string[] = [];
  let level: DelayRiskLevel = "LOW";

  const ceilingFt =
    d.operationalCeilingFt != null && Number.isFinite(d.operationalCeilingFt)
      ? d.operationalCeilingFt
      : null;
  // Thresholds unchanged: <1000 => HIGH, 1000–2999 => MODERATE; ceiling from BKN/OVC/VV/OVX bases only.
  if (ceilingFt != null && ceilingFt < 1000) {
    triggers.push(`ceiling ${ceilingFt} ft`);
    level = "HIGH";
  } else if (ceilingFt != null && ceilingFt < 3000) {
    triggers.push(`ceiling ${ceilingFt} ft`);
    if (level === "LOW") level = "MODERATE";
  }

  const visMatch = /([\d.]+)\s*SM/.exec(d.visibility ?? "");
  const visSm = visMatch ? parseFloat(visMatch[1]) : null;
  if (visSm != null && visSm < 3) {
    triggers.push(`visibility ${visSm} SM`);
    level = level === "HIGH" ? "HIGH" : "MODERATE";
  }

  const windMatch = /(\d+)\s*kt|G(\d+)/.exec(d.wind ?? "");
  const gustMatch = /G(\d+)/.exec(d.wind ?? "");
  const gustKt = gustMatch ? parseInt(gustMatch[1], 10) : null;
  const windKt = windMatch ? parseInt(windMatch[1], 10) : null;
  if ((gustKt != null && gustKt > 25) || (windKt != null && windKt > 25)) {
    triggers.push("strong wind/gusts");
    if (level === "LOW") level = "MODERATE";
  }

  if (d.flightCategory === "IFR" || d.flightCategory === "LIFR") {
    triggers.push(d.flightCategory);
    if (level === "LOW") level = "MODERATE";
  }

  const reason = formatDelayReason(triggers, level, contextForReason);
  const contextualTriggers = triggers.map((t) =>
    `${formatTriggerForDisplay(t)} at ${contextForDisplay}`
  );
  return { level, reason, triggers: contextualTriggers };
}

function mergeEndpointRisks(
  current: { level: DelayRiskLevel; reason: string; triggers?: string[] },
  forecast: { level: DelayRiskLevel; reason: string; triggers?: string[] },
  context: "departure" | "arrival"
): { level: DelayRiskLevel; reason: string; triggers?: string[] } {
  const level = maxDelayLevel(current.level, forecast.level);
  const triggers = dedupeTriggers([...(current.triggers ?? []), ...(forecast.triggers ?? [])]);

  if (level === "LOW" && triggers.length === 0) {
    return {
      level: "LOW",
      reason:
        context === "departure"
          ? "No significant ceiling, visibility, or wind drivers at departure (METAR vs TAF for your time)."
          : "No significant ceiling, visibility, or wind drivers at arrival (METAR vs TAF for your time).",
      triggers: [],
    };
  }

  const reason = formatDelayReason(triggers, level, context);
  return { level, reason, triggers };
}

function formatTriggerForDisplay(trigger: string): string {
  let formatted = trigger.replace(/\b(\d{4,})\b/g, (m) =>
    parseInt(m, 10).toLocaleString()
  );
  formatted = formatted.replace(/\//g, " / ");
  formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  return formatted;
}

function formatDelayReason(
  triggers: string[],
  level: DelayRiskLevel,
  context: "departure" | "arrival"
): string {
  if (triggers.length === 0) {
    return "No significant weather-related operational impacts identified.";
  }
  if (level === "HIGH") {
    if (triggers.some((t) => t.includes("ceiling"))) {
      return context === "departure"
        ? "Ceiling below 1,000 ft (METAR and/or TAF window) at departure — high operational impact possible."
        : "Ceiling below 1,000 ft (METAR and/or TAF window) at arrival — high operational impact possible.";
    }
    if (triggers.some((t) => t.includes("visibility"))) {
      return context === "departure"
        ? "Visibility below 3 SM at departure — check both observed and forecast blocks."
        : "Visibility below 3 SM at arrival — check both observed and forecast blocks.";
    }
    return context === "departure"
      ? "Departure meets existing high-impact thresholds — review drivers below."
      : "Arrival meets existing high-impact thresholds — review drivers below.";
  }
  const hasIfr = triggers.some((t) => /IFR|LIFR/i.test(t));
  if (context === "departure" && hasIfr) {
    return "IFR/LIFR category at departure — may increase delay or complexity.";
  }
  return triggers.map(formatTriggerForDisplay).join("; ") + ".";
}

export function computeDelayRisk(
  departureWeather: AirportWeather,
  arrivalWeather: AirportWeather
): {
  departure: { level: DelayRiskLevel; reason: string; triggers?: string[] };
  arrival: { level: DelayRiskLevel; reason: string; triggers?: string[] };
} {
  const depCurrent = riskFromDecoded(
    departureWeather.decodedCurrent,
    departureWeather.airport,
    "departure"
  );
  const depForecast = riskFromDecoded(
    departureWeather.decodedForecast,
    departureWeather.airport,
    "departure"
  );
  const dep = mergeEndpointRisks(depCurrent, depForecast, "departure");

  const arrCurrent = riskFromDecoded(
    arrivalWeather.decodedCurrent,
    arrivalWeather.airport,
    "arrival"
  );
  const arrForecast = riskFromDecoded(
    arrivalWeather.decodedForecast,
    arrivalWeather.airport,
    "arrival"
  );
  const arr = mergeEndpointRisks(arrCurrent, arrForecast, "arrival");

  return {
    departure: { level: dep.level, reason: dep.reason, triggers: dep.triggers },
    arrival: { level: arr.level, reason: arr.reason, triggers: arr.triggers },
  };
}

export function computeOperationalWatch(
  departureWeather: AirportWeather,
  arrivalWeather: AirportWeather,
  advisories: EnrouteAdvisory[]
): OperationalWatchItem[] {
  const items: OperationalWatchItem[] = [];

  const dep = departureWeather.decodedCurrent ?? departureWeather.decodedForecast;
  const arr = arrivalWeather.decodedCurrent ?? arrivalWeather.decodedForecast;

  const depAirport = departureWeather.airport?.trim();
  const arrAirport = arrivalWeather.airport?.trim();

  if (dep?.flightCategory === "IFR" || dep?.flightCategory === "LIFR") {
    items.push({
      severity: "caution",
      title: depAirport ? `IFR Conditions at Departure Airport (${depAirport})` : "IFR Conditions at Departure Airport",
      detail: `Departure Conditions: ${dep.skyCeiling}, ${dep.visibility}.`,
    });
  }

  const depTs = thunderstormClassFromTafPeriod(
    departureWeather.tafSelectedPeriodRawLine,
    departureWeather.tafSelectedPeriodWxString
  );
  if (depTs === "warning") {
    items.push({
      severity: "warning",
      title: depAirport ? `Thunderstorms in TAF window (${depAirport})` : "Thunderstorms in TAF window (departure)",
      detail:
        "The selected TAF period for your departure time includes TS/CB/TSRA-class weather. Review the TAF block and RAW.",
    });
  } else if (depTs === "vicinity") {
    items.push({
      severity: "caution",
      title: depAirport ? `Convection in vicinity (${depAirport})` : "Convection in vicinity (departure)",
      detail: "TAF includes VCTS or similar — not the same as airport TS; stay alert for building cells.",
    });
  }

  if (dep?.wind && /G\d{2,}/.test(dep.wind)) {
    items.push({
      severity: "caution",
      title: "Gusty Winds at Departure Airport",
      detail: `Surface winds: ${dep.wind}`,
    });
  }

  if (arr?.flightCategory === "IFR" || arr?.flightCategory === "LIFR") {
    items.push({
      severity: "caution",
      title: arrAirport ? `IFR Conditions at Arrival Airport (${arrAirport})` : "IFR Conditions at Arrival Airport",
      detail: `Arrival Conditions: ${arr.skyCeiling}, ${arr.visibility}.`,
    });
  }

  const arrTs = thunderstormClassFromTafPeriod(
    arrivalWeather.tafSelectedPeriodRawLine,
    arrivalWeather.tafSelectedPeriodWxString
  );
  if (arrTs === "warning") {
    items.push({
      severity: "warning",
      title: arrAirport ? `Thunderstorms in TAF window (${arrAirport})` : "Thunderstorms in TAF window (arrival)",
      detail:
        "The selected TAF period for your arrival time includes TS/CB/TSRA-class weather. Review the TAF block and RAW.",
    });
  } else if (arrTs === "vicinity") {
    items.push({
      severity: "caution",
      title: arrAirport ? `Convection in vicinity (${arrAirport})` : "Convection in vicinity (arrival)",
      detail: "TAF includes VCTS or similar — not the same as airport TS; stay alert for building cells.",
    });
  }

  if (arr?.wind && /G\d{2,}/.test(arr.wind)) {
    items.push({
      severity: "caution",
      title: "Gusty Winds at Arrival Airport",
      detail: `Surface winds: ${arr.wind}`,
    });
  }

  const advisoryDetail = (a: EnrouteAdvisory, fallback: string): string => {
    const text = (a.description ?? a.rawText ?? "").trim();
    if (!text) return fallback;
    const trimmed = text.slice(0, 100);
    return trimmed.length < text.length ? trimmed + "…" : trimmed;
  };

  const convSigmet = advisories.find((a) => a.type === "CONVECTIVE_SIGMET");
  if (convSigmet) {
    items.push({
      severity: "warning",
      title: "Convective SIGMET",
      detail: advisoryDetail(
        convSigmet,
        "Text references your departure or arrival station — verify polygon and validity."
      ),
    });
  }

  const sigmet = advisories.find((a) => a.type === "SIGMET");
  if (sigmet) {
    items.push({
      severity: "caution",
      title: "SIGMET",
      detail: advisoryDetail(sigmet, "Review raw text — station matched only by text search, not geometry."),
    });
  }

  const airmet = advisories.find((a) => a.type === "AIRMET");
  if (airmet) {
    items.push({
      severity: "info",
      title: "AIRMET",
      detail: advisoryDetail(airmet, "Moderate hazards — confirm relevance to your route."),
    });
  }

  return items;
}

export function computeRiskSummary(
  departureRisk: DelayRiskLevel,
  arrivalRisk: DelayRiskLevel,
  departureDetail: string,
  arrivalDetail: string,
  advisories: EnrouteAdvisory[],
  watchItems: OperationalWatchItem[]
): { level: DelayRiskLevel; reason: string } {
  const hasHigh = departureRisk === "HIGH" || arrivalRisk === "HIGH";
  const hasMod = departureRisk === "MODERATE" || arrivalRisk === "MODERATE";
  const hasAdvisories = advisories.length > 0;
  const hasWarnings = watchItems.some((w) => w.severity === "warning");

  let level: DelayRiskLevel = "LOW";
  let reason =
    "Ceiling, visibility, and wind heuristics look benign for observed + TAF times, and no station-matching advisories were returned.";

  if (hasHigh || hasWarnings) {
    level = "HIGH";
    const parts: string[] = [];
    if (departureRisk === "HIGH") parts.push(`Departure: ${departureDetail}`);
    if (arrivalRisk === "HIGH") parts.push(`Arrival: ${arrivalDetail}`);
    if (hasWarnings) {
      parts.push("Operational Watch includes a warning-level item (TS in TAF window or convective SIGMET text hit).");
    }
    reason = parts.filter((p) => p.trim().length > 0).join(" ") || "High-impact thresholds or warnings — see cards below.";
  } else if (hasMod || hasAdvisories) {
    level = "MODERATE";
    const parts: string[] = [];
    if (departureRisk === "MODERATE") parts.push(`Departure: ${departureDetail}`);
    if (arrivalRisk === "MODERATE") parts.push(`Arrival: ${arrivalDetail}`);
    if (hasAdvisories) {
      parts.push(
        "SIGMET/AIRMET raw text mentions your departure or arrival station — open Enroute Advisories to confirm hazard type and area."
      );
    }
    reason = parts.filter((p) => p.trim().length > 0).join(" ") || "Monitor METAR/TAF and enroute products.";
  }

  return { level, reason };
}