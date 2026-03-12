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

function riskFromDecoded(
  d: DecodedWeather | null | undefined,
  contextForDisplay: string,
  contextForReason: "departure" | "arrival"
): {
  level: DelayRiskLevel;
  reason: string;
} {
  if (!d) {
    return {
      level: "LOW",
      reason: "Weather data not available.",
    };
  }

  const triggers: string[] = [];
  let level: DelayRiskLevel = "LOW";

  const ceilingMatch = /([\d,]+)\s*ft/.exec(d.skyCeiling ?? "");
  const ceilingFt = ceilingMatch ? parseInt(ceilingMatch[1].replace(/,/g, ""), 10) : null;
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
    return "Weather conditions and active advisories may significantly affect operations.";
  }
  const hasIfr = triggers.some((t) => /IFR|LIFR/i.test(t));
  if (context === "departure" && hasIfr) {
    return "IFR conditions at departure may increase delay potential.";
  }
  if (context === "arrival") {
    return "Arrival weather may reduce operational flexibility near ETA.";
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
  const dep = riskFromDecoded(
    departureWeather.decodedCurrent ?? departureWeather.decodedForecast,
    departureWeather.airport,
    "departure"
  );
  const arr = riskFromDecoded(
    arrivalWeather.decodedCurrent ?? arrivalWeather.decodedForecast,
    arrivalWeather.airport,
    "arrival"
  );
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

  // Departure airport items first
  if (dep?.flightCategory === "IFR" || dep?.flightCategory === "LIFR") {
    items.push({
      severity: "caution",
      title: depAirport ? `IFR Conditions at Departure Airport (${depAirport})` : "IFR Conditions at Departure Airport",
      detail: `Departure Conditions: ${dep.skyCeiling}, ${dep.visibility}.`,
    });
  }

  const depTaf = (departureWeather.tafRaw ?? "").toUpperCase();
  if (/TS|THUNDER/.test(depTaf)) {
    items.push({
      severity: "warning",
      title: depAirport ? `Thunderstorms Forecast at Departure Airport (${depAirport})` : "Thunderstorms Forecast at Departure Airport",
      detail: "Thunderstorms possible during the departure window. Expect delays or routing deviations.",
    });
  }

  if (dep?.wind && /G\d{2,}/.test(dep.wind)) {
    items.push({
      severity: "caution",
      title: "Gusty Winds at Departure Airport",
      detail: `Surface winds: ${dep.wind}`,
    });
  }

  // Arrival airport items next
  if (arr?.flightCategory === "IFR" || arr?.flightCategory === "LIFR") {
    items.push({
      severity: "caution",
      title: arrAirport ? `IFR Conditions at Arrival Airport (${arrAirport})` : "IFR Conditions at Arrival Airport",
      detail: `Arrival Conditions: ${arr.skyCeiling}, ${arr.visibility}.`,
    });
  }

  const tafRaw = (arrivalWeather.tafRaw ?? "").toUpperCase();
  if (/TS|THUNDER/.test(tafRaw)) {
    items.push({
      severity: "warning",
      title: arrAirport ? `Thunderstorms Forecast at Arrival Airport (${arrAirport})` : "Thunderstorms Forecast at Arrival Airport",
      detail: "Thunderstorms possible during the arrival window. Expect holding or routing deviations.",
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
      title: "Convective SIGMET Affecting Route",
      detail: advisoryDetail(convSigmet, "Embedded thunderstorms or severe convection may affect the planned route."),
    });
  }

  const sigmet = advisories.find((a) => a.type === "SIGMET");
  if (sigmet) {
    items.push({
      severity: "caution",
      title: "SIGMET affecting route",
      detail: advisoryDetail(sigmet, "Significant meteorological hazards may affect the planned route."),
    });
  }

  const airmet = advisories.find((a) => a.type === "AIRMET");
  if (airmet) {
    items.push({
      severity: "info",
      title: "AIRMET Affecting Route",
      detail: advisoryDetail(airmet, "Moderate hazards such as IFR conditions, turbulence, or icing may affect the planned route."),
    });
  }

  return items;
}

export function computeRiskSummary(
  departureRisk: DelayRiskLevel,
  arrivalRisk: DelayRiskLevel,
  advisories: EnrouteAdvisory[],
  watchItems: OperationalWatchItem[]
): { level: DelayRiskLevel; reason: string } {
  const hasHigh = departureRisk === "HIGH" || arrivalRisk === "HIGH";
  const hasMod = departureRisk === "MODERATE" || arrivalRisk === "MODERATE";
  const hasAdvisories = advisories.length > 0;
  const hasWarnings = watchItems.some((w) => w.severity === "warning");

  let level: DelayRiskLevel = "LOW";
  let reason = "No significant weather-related operational impacts identified.";

  if (hasHigh || hasWarnings) {
    level = "HIGH";
    reason = "Weather conditions and active advisories may significantly affect operations.";
  } else if (hasMod || hasAdvisories) {
    level = "MODERATE";
    reason = "Arrival weather and active advisories may affect timing or operational flexibility.";
  }

  return { level, reason };
}
