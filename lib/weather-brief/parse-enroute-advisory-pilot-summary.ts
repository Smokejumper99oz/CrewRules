/**
 * Rule-based pilot-facing summaries from AIRMET/SIGMET bulletin text (no AI).
 * rawText must stay unchanged elsewhere; this only reads it.
 */

import type { EnrouteAdvisory, EnrouteAdvisoryRelevanceTag } from "./types";

/** DDHHMM or HHMM after VALID UNTIL -> Valid until HHMMZ. */
export function extractValidUntilDisplay(raw: string): string | null {
  const m = raw.toUpperCase().match(/\bVALID\s+UNTIL\s+(\d{4,6})(?:Z)?\b/);
  if (!m) return null;
  const digits = m[1];
  const hhmm = digits.length === 6 ? digits.slice(2, 6) : digits;
  if (!/^\d{4}$/.test(hhmm)) return null;
  return `Valid until ${hhmm}Z.`;
}

/** BTN/BLW/ABV FLxxx patterns -> short phrase with trailing period. */
export function extractAltitudeSummaryPhrase(raw: string): string | null {
  const u = raw.toUpperCase();
  const btn = u.match(/\bBTN\s+FL(\d{3})\s+AND\s+FL(\d{3})\b/);
  if (btn) return `FL${btn[1]}–FL${btn[2]}.`;
  const blw = u.match(/\bBLW\s+FL(\d{3})\b/);
  if (blw) return `Below FL${blw[1]}.`;
  const abv = u.match(/\bABV\s+FL(\d{3})\b/);
  if (abv) return `Above FL${abv[1]}.`;
  return null;
}

function detectAirmetSeries(u: string): "SIERRA" | "TANGO" | "ZULU" | null {
  if (/\bAIRMET\s+SIERRA\b/.test(u)) return "SIERRA";
  if (/\bAIRMET\s+TANGO\b/.test(u)) return "TANGO";
  if (/\bAIRMET\s+ZULU\b/.test(u)) return "ZULU";
  return null;
}

function buildSierraHazard(u: string): string {
  const parts: string[] = [];
  if (/\bIFR\b/.test(u) || /\bFOR\s+IFR\b/.test(u)) parts.push("IFR");
  if (/MTN\s+OBSCN|MTN\s+OBSC\b|MOUNTAIN\s+OBSC/i.test(u)) parts.push("mountain obscuration");
  if (parts.length > 0) return parts.join(" / ");
  return "IFR / mountain obscuration";
}

function buildTangoHazard(u: string): string {
  const parts: string[] = [];
  if (/\bTURB\b|\bTURBULENCE\b/.test(u)) parts.push("turbulence");
  if (/\bSTG\s+WNDS\b|\bSTRONG\s+WIND/i.test(u)) parts.push("strong winds");
  if (/\bLLWS\b|LOW\s+LEVEL\s+WIND/i.test(u)) parts.push("LLWS");
  if (parts.length > 0) return parts.join(" / ");
  return "turbulence / strong winds / LLWS";
}

function buildZuluHazard(u: string): string {
  const parts: string[] = [];
  if (/\bICE\b|\bICING\b/.test(u)) parts.push("icing");
  if (/FRZ\s*LVL|FRZLVL|FREEZING\s+LEVEL/i.test(u)) parts.push("freezing level");
  if (parts.length > 0) return parts.join(" / ");
  return "icing / freezing level";
}

function inferAirmetLabelAndHazard(u: string): { label: string; hazard: string } | null {
  if (/\bTURB\b|\bLLWS\b|\bSTG\s+WNDS\b|\bSTRONG\s+WIND/i.test(u)) {
    return { label: "AIRMET Tango", hazard: buildTangoHazard(u) };
  }
  if (/\bICE\b|\bICING\b|FRZ\s*LVL|FRZLVL|FREEZING\s+LEVEL/i.test(u)) {
    return { label: "AIRMET Zulu", hazard: buildZuluHazard(u) };
  }
  if (/\bIFR\b|\bFOR\s+IFR\b|MTN\s+OBSCN|MTN\s+OBSC\b|MOUNTAIN\s+OBSC/i.test(u)) {
    return { label: "AIRMET Sierra", hazard: buildSierraHazard(u) };
  }
  return null;
}

/**
 * Short region label (e.g. ARTCC-ish code); rejects long route / coordinate strings.
 */
export function pickOptionalRegionLabel(area?: string | null, title?: string | null): string | null {
  for (const c of [area, title]) {
    if (typeof c !== "string") continue;
    const s = c.trim();
    if (s.length < 2 || s.length > 28) continue;
    if (/\d{1,2}\s*[NnSs]\d{1,3}\s*[EeWw]/.test(s)) continue;
    if (/\bFROM\b.*\bTO\b/i.test(s) && s.length > 16) continue;
    if (/\d{2,}\s*[NSEW](?:\d|\b)/i.test(s)) continue;
    if (s.includes("·") || s.includes("...")) continue;
    if (/^[A-Z]{2,4}$/.test(s)) return s;
    if (/^[A-Za-z][A-Za-z0-9\s/-]{1,26}$/.test(s) && !/\d{3,}/.test(s)) return s;
  }
  return null;
}

export type EnrouteAdvisorySemantic = {
  typeLabel: string;
  hazard: string;
};

/** Core type + hazard (no validity, region, relevance). */
export function getEnrouteAdvisorySemanticOrNull(
  input: Pick<ParseEnrouteAdvisoryPilotSummaryInput, "classifiedType" | "rawText">
): EnrouteAdvisorySemantic | null {
  const rawText = (input.rawText ?? "").trim();
  if (!rawText) return null;

  if (input.classifiedType === "PIREP") return null;

  const u = rawText.toUpperCase();

  let typeLabel: string;
  let hazard: string;

  const isConvective =
    input.classifiedType === "CONVECTIVE_SIGMET" || /\bCONVECTIVE\s+SIGMET\b/.test(u);

  if (isConvective) {
    typeLabel = "Convective SIGMET";
    if (/\bTS\b|THUNDER|EMBD|IMBD/i.test(u)) hazard = "thunderstorms";
    else hazard = "convective weather";
  } else if (input.classifiedType === "AIRMET" || /\bAIRMET\b/.test(u)) {
    const series = detectAirmetSeries(u);
    if (series === "SIERRA") {
      typeLabel = "AIRMET Sierra";
      hazard = buildSierraHazard(u);
    } else if (series === "TANGO") {
      typeLabel = "AIRMET Tango";
      hazard = buildTangoHazard(u);
    } else if (series === "ZULU") {
      typeLabel = "AIRMET Zulu";
      hazard = buildZuluHazard(u);
    } else {
      const inferred = inferAirmetLabelAndHazard(u);
      if (!inferred) return null;
      typeLabel = inferred.label;
      hazard = inferred.hazard;
    }
  } else if (input.classifiedType === "SIGMET" || /\bSIGMET\b/.test(u)) {
    typeLabel = "SIGMET";
    hazard = "significant meteorological hazard";
  } else {
    return null;
  }

  return { typeLabel, hazard };
}

/** MOD/SEV/STG → readable tightening of hazard wording. */
export function applySeverityToHazardPhrase(hazard: string, rawUpper: string): string {
  const u = rawUpper;
  const mod = /\bMOD\b/.test(u);
  const sev = /\bSEV\b/.test(u);
  let h = hazard;

  if (/\bturbulence\b/i.test(h)) {
    if (sev) h = h.replace(/\bturbulence\b/i, "severe turbulence");
    else if (mod) h = h.replace(/\bturbulence\b/i, "moderate turbulence");
  }
  if (/\bicing\b/i.test(h)) {
    if (sev) h = h.replace(/\bicing\b/i, "severe icing");
    else if (mod) h = h.replace(/\bicing\b/i, "moderate icing");
  }
  if (/\bLLWS\b/.test(h) && mod) {
    h = h.replace(/\bLLWS\b/, "moderate LLWS");
  }
  if (/\bstrong winds\b/i.test(h) && /\bSTG\b/.test(u)) {
    h = h.replace(/\bstrong winds\b/i, "strong winds (STG)");
  }
  if (/\bconvective weather\b/i.test(h) && sev) {
    h = h.replace(/\bconvective weather\b/i, "severe convective weather");
  }
  if (/\bthunderstorms\b/i.test(h) && sev) {
    h = h.replace(/\bthunderstorms\b/i, "severe thunderstorms");
  }

  return h;
}

export type ParseEnrouteAdvisoryPilotSummaryInput = {
  classifiedType: EnrouteAdvisory["type"];
  title: string;
  rawText: string;
  /** AVWX area or similar; optional. */
  area?: string | null;
};

export type OperationalPilotSummaryInput = ParseEnrouteAdvisoryPilotSummaryInput & {
  relevancePhrase: string;
  relevanceTag: EnrouteAdvisoryRelevanceTag;
};

/**
 * Operational one-line: "{Type} — {hazard}. {relevance} {altitude} {validity}"
 */
export function buildOperationalEnroutePilotSummary(input: OperationalPilotSummaryInput): string | null {
  const rawText = (input.rawText ?? "").trim();
  if (!rawText) return null;

  const semi = getEnrouteAdvisorySemanticOrNull({
    classifiedType: input.classifiedType,
    rawText,
  });
  if (!semi) return null;

  const u = rawText.toUpperCase();
  let hazard = applySeverityToHazardPhrase(semi.hazard, u);
  const valid = extractValidUntilDisplay(rawText);
  const alt = extractAltitudeSummaryPhrase(rawText);

  const rel = (input.relevancePhrase ?? "").trim();
  const relFin = rel.endsWith(".") ? rel : `${rel}.`;

  const parts: string[] = [`${semi.typeLabel} — ${hazard}.`, relFin];
  if (alt) parts.push(alt);
  if (valid) parts.push(valid);

  return parts.join(" ");
}

/**
 * Legacy "{Type} — {hazard · region}. {validity}" when operational path not used.
 */
export function parseEnrouteAdvisoryPilotSummary(
  input: ParseEnrouteAdvisoryPilotSummaryInput
): string | null {
  const rawText = (input.rawText ?? "").trim();
  if (!rawText) return null;

  const semi = getEnrouteAdvisorySemanticOrNull({
    classifiedType: input.classifiedType,
    rawText,
  });
  if (!semi) return null;

  const valid = extractValidUntilDisplay(rawText);
  const region = pickOptionalRegionLabel(input.area ?? null, null);
  const hazard = region ? `${semi.hazard} · ${region}` : semi.hazard;
  const core = `${semi.typeLabel} — ${hazard}.`;
  return valid ? `${core} ${valid}` : core;
}
