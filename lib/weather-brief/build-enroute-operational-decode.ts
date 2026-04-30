/**
 * Deterministic operational interpretation for enroute SIGMET/AIRMET (AI-ready field; no LLM calls).
 */

import type { EnrouteAdvisory, EnrouteAdvisoryRelevanceTag } from "./types";

export type EnrouteOperationalDecodeContext = {
  departureIcao: string;
  arrivalIcao: string;
  /** True when a filed route string is available for this brief (FlightAware or schedule). */
  filedRouteAvailable: boolean;
};

function looksLikeWeakRegionalScope(raw: string, tag: EnrouteAdvisoryRelevanceTag): boolean {
  if (tag !== "regional") return false;
  if (raw.length >= 420) return true;
  const andChunks = raw.toUpperCase().split(/\s+AND\s+/);
  if (andChunks.length >= 10) return true;
  return false;
}

/**
 * Confidence from relevance heuristics (non-AI). "Low" only for weak/broad regional matches.
 */
export function computeEnrouteRelevanceConfidence(
  advisory: EnrouteAdvisory
): "high" | "medium" | "low" | null {
  const tag = advisory.relevanceTag;
  if (!tag) return null;
  if (tag === "departure" || tag === "arrival") return "high";
  if (tag === "regional") {
    if (looksLikeWeakRegionalScope(advisory.rawText ?? "", "regional")) return "low";
    return "medium";
  }
  return null;
}

const DECODE = {
  tango:
    "Ride quality risk. Review ride reports, altitude options, and dispatcher notes.",
  sierra:
    "Ceiling/terrain visibility risk. Review arrival weather, alternates, and approach mins.",
  zulu: "Icing risk. Review temperatures, cloud layers, and anti-ice considerations.",
  convective: "Thunderstorm risk. Review route deviation options and timing.",
  sigmet:
    "Significant enroute weather. Review affected area before departure.",
} as const;

/**
 * Rule-based operational decode. `context` is reserved for future AI / richer rules (e.g. route context).
 */
export function buildEnrouteOperationalDecode(
  advisory: EnrouteAdvisory,
  _context: EnrouteOperationalDecodeContext
): string | null {
  void _context;
  if (advisory.type === "PIREP") return null;

  const u = (advisory.rawText ?? "").toUpperCase();

  const isConvective =
    advisory.type === "CONVECTIVE_SIGMET" || /\bCONVECTIVE\s+SIGMET\b/.test(u);
  if (isConvective) return DECODE.convective;

  const isAirmet = advisory.type === "AIRMET" || /\bAIRMET\b/.test(u);
  if (isAirmet) {
    if (/\bAIRMET\s+SIERRA\b/.test(u)) return DECODE.sierra;
    if (/\bAIRMET\s+TANGO\b/.test(u)) return DECODE.tango;
    if (/\bAIRMET\s+ZULU\b/.test(u)) return DECODE.zulu;

    if (/\bIFR\b|\bFOR\s+IFR\b|MTN\s+OBSCN|MTN\s+OBSC\b|MOUNTAIN\s+OBSC/i.test(u)) {
      return DECODE.sierra;
    }
    if (/\bICE\b|\bICING\b|FRZ\s*LVL|FRZLVL|FREEZING\s+LEVEL/i.test(u)) {
      return DECODE.zulu;
    }
    if (/\bTURB\b|\bLLWS\b|\bSTG\s+WNDS\b|\bSTRONG\s+WIND/i.test(u)) {
      return DECODE.tango;
    }
    return DECODE.tango;
  }

  if (advisory.type === "SIGMET" || /\bSIGMET\b/.test(u)) {
    return DECODE.sigmet;
  }

  return null;
}
