/**
 * Post-fetch enrichment: relevance tags, operational pilot summaries, rank/trim for UI.
 * Does not alter rawText, dedupe keys, or fetch.
 */

import type { EnrouteAdvisory, EnrouteAdvisoryRelevanceTag } from "./types";
import { resolveStationCode } from "./resolve-station-code";
import { buildEnrouteAdvisoryPilotSummary } from "./build-enroute-advisory-pilot-summary";
import {
  buildOperationalEnroutePilotSummary,
  parseEnrouteAdvisoryPilotSummary,
} from "./parse-enroute-advisory-pilot-summary";
import {
  buildEnrouteOperationalDecode,
  computeEnrouteRelevanceConfidence,
  type EnrouteOperationalDecodeContext,
} from "./build-enroute-operational-decode";
import { expandAviationAbbreviationsInPilotSummary, formatEnroutePilotSummaryTypography, usStateAbbrevToName } from "./expand-enroute-pilot-wording";

const MAX_VISIBLE_ADVISORIES = 3;

export type EnrichEnrouteAdvisoriesOptions = {
  filedRouteAvailable?: boolean;
};

const US_ICAO_STATE: Record<string, string> = {
  KATL: "GA",
  KBWI: "MD",
  KBOS: "MA",
  KCLT: "NC",
  KORD: "IL",
  KDFW: "TX",
  KDEN: "CO",
  KDTW: "MI",
  KEWR: "NJ",
  KFLL: "FL",
  KRSW: "FL",
  KJAX: "FL",
  KLAS: "NV",
  KLAX: "CA",
  KMCO: "FL",
  KMSY: "LA",
  KTPA: "FL",
  KMIA: "FL",
  KMSP: "MN",
  KBNA: "TN",
  KPHL: "PA",
  KPHX: "AZ",
  KPIT: "PA",
  KRDU: "NC",
  KSEA: "WA",
  KSFO: "CA",
  KSLC: "UT",
  KSTL: "MO",
  KMEM: "TN",
  KAUS: "TX",
  KIAH: "TX",
  KSAN: "CA",
  KPDX: "OR",
  KABQ: "NM",
  KPNS: "FL",
};

function toDisplayCode(icao: string): string {
  const c = resolveStationCode(icao).trim().toUpperCase();
  if (c.length === 4 && c.startsWith("K")) return c.slice(1);
  return c;
}

function airportMentionsRaw(raw: string, airportInput: string): boolean {
  const id = resolveStationCode(airportInput).toUpperCase();
  const u = raw.toUpperCase();
  if (!id) return false;
  if (u.includes(id)) return true;
  if (id.length === 4 && id.startsWith("K")) {
    const iata = id.slice(1);
    if (iata.length === 3 && u.includes(iata)) return true;
  }
  return false;
}

function areaHintTouchesAirport(areaHint: string | null | undefined, airportInput: string): boolean {
  if (!areaHint?.trim()) return false;
  const a = areaHint.trim().toUpperCase();
  const id = resolveStationCode(airportInput).toUpperCase();
  if (id.length === 4 && id.startsWith("K") && id.slice(1) === a) return true;
  return false;
}

function stateForAirport(airportInput: string): string | null {
  const id = resolveStationCode(airportInput).toUpperCase();
  return US_ICAO_STATE[id] ?? null;
}

function pickCleanAreaForPhrase(area: string): string | null {
  const s = area.trim().toUpperCase();
  if (s.length >= 2 && s.length <= 5 && /^[A-Z0-9]+$/.test(s)) return s;
  return null;
}

export function inferEnrouteAdvisoryRelevance(
  rawText: string,
  departureIcao: string,
  arrivalIcao: string,
  areaHint?: string | null
): {
  tag: EnrouteAdvisoryRelevanceTag;
  phrase: string;
} {
  const raw = rawText ?? "";
  const depIata = toDisplayCode(departureIcao);
  const arrIata = toDisplayCode(arrivalIcao);
  const depHit = airportMentionsRaw(raw, departureIcao);
  const arrHit = airportMentionsRaw(raw, arrivalIcao);
  const depAreaHit = areaHintTouchesAirport(areaHint, departureIcao);
  const arrAreaHit = areaHintTouchesAirport(areaHint, arrivalIcao);

  if (depHit && arrHit) {
    return {
      tag: "regional",
      phrase:
        depIata === arrIata ? "Regional." : `Along route (${depIata}–${arrIata}).`,
    };
  }
  if (depHit || depAreaHit) {
    return { tag: "departure", phrase: `Near departure (${depIata}).` };
  }
  if (arrHit || arrAreaHit) {
    return { tag: "arrival", phrase: `Near arrival (${arrIata}).` };
  }

  const depState = stateForAirport(departureIcao);
  const u = raw.toUpperCase();
  if (depState && new RegExp(`\\b${depState}\\b`).test(u)) {
    return {
      tag: "departure",
      phrase: `Near departure region (${usStateAbbrevToName(depState)}).`,
    };
  }
  const arrState = stateForAirport(arrivalIcao);
  if (arrState && new RegExp(`\\b${arrState}\\b`).test(u)) {
    return {
      tag: "arrival",
      phrase: `Near arrival region (${usStateAbbrevToName(arrState)}).`,
    };
  }

  const cleanArea = areaHint ? pickCleanAreaForPhrase(areaHint) : null;
  if (cleanArea) {
    return {
      tag: "regional",
      phrase: `Regional (${cleanArea}).`,
    };
  }

  return { tag: "regional", phrase: "Regional." };
}

function looksLikeNationwideBrush(raw: string, tag: EnrouteAdvisoryRelevanceTag): boolean {
  if (tag !== "regional") return false;
  if (raw.length >= 420) return true;
  const andChunks = raw.toUpperCase().split(/\s+AND\s+/);
  if (andChunks.length >= 10) return true;
  return false;
}

function advisoryDisplayScore(a: EnrouteAdvisory): number {
  let s = 0;
  if (a.timeRelevance === "near_term") s -= 30;
  const tag = a.relevanceTag ?? "regional";
  if (tag === "departure" || tag === "arrival") s += 100;
  if (tag === "regional") s += 45;
  /** Preserve severity ordering for downstream risk/watch heuristics. */
  if (a.type === "CONVECTIVE_SIGMET") s += 85;
  else if (a.type === "SIGMET") s += 42;
  else if (a.type === "AIRMET") s += 6;
  if (/\bBTN\s+FL\d{3}\b|\bBLW\s+FL\d{3}\b|\bABV\s+FL\d{3}\b/i.test(a.rawText ?? "")) s += 8;
  if (/\b(MOD|SEV|STG)\b/i.test(a.rawText ?? "")) s += 4;
  if (looksLikeNationwideBrush(a.rawText ?? "", tag)) s -= 35;
  return s;
}

function normalizePilotSummaryForCardDedupe(pilotSummary: string): string {
  return pilotSummary.replace(/\s+/g, " ").trim().toUpperCase();
}

/** CONVECTIVE_SIGMET > SIGMET > AIRMET > other. */
function advisoryTypePriority(t: EnrouteAdvisory["type"]): number {
  if (t === "CONVECTIVE_SIGMET") return 4;
  if (t === "SIGMET") return 3;
  if (t === "AIRMET") return 2;
  return 1;
}

/** Higher score = preferred keeper when pilotSummary matches. */
function duplicateAdvisoryKeeperScore(a: EnrouteAdvisory): number {
  let s = 0;
  if (a.sourceUrl?.trim()) s += 1_000_000;
  if (a.provider === "awc") s += 100_000;
  s += advisoryTypePriority(a.type) * 10_000;
  return s;
}

function pickKeeperForDuplicateSummary(existing: EnrouteAdvisory, candidate: EnrouteAdvisory): EnrouteAdvisory {
  const se = duplicateAdvisoryKeeperScore(existing);
  const sc = duplicateAdvisoryKeeperScore(candidate);
  if (sc > se) return candidate;
  if (sc < se) return existing;
  return existing;
}

/**
 * Collapse cards that would show the same pilotSummary (e.g. AWC + AVWX same Tango).
 */
function dedupeEnrichedAdvisoriesByPilotSummary(advisories: EnrouteAdvisory[]): EnrouteAdvisory[] {
  const map = new Map<string, EnrouteAdvisory>();

  for (const a of advisories) {
    const norm = normalizePilotSummaryForCardDedupe(a.pilotSummary ?? "");
    const key =
      norm.length > 0
        ? norm
        : `__empty_summary__|${a.type}|${(a.rawText ?? "").slice(0, 96)}|${a.provider ?? ""}`;

    const prev = map.get(key);
    if (!prev) map.set(key, a);
    else map.set(key, pickKeeperForDuplicateSummary(prev, a));
  }

  return [...map.values()];
}

/**
 * Sets pilotSummary, relevanceTag; caps list for card usefulness.
 */
export function enrichRankAndTrimEnrouteAdvisories(
  advisories: EnrouteAdvisory[],
  departureAirportInput: string,
  arrivalAirportInput: string,
  options?: EnrichEnrouteAdvisoriesOptions
): EnrouteAdvisory[] {
  const depId = resolveStationCode(departureAirportInput).toUpperCase();
  const arrId = resolveStationCode(arrivalAirportInput).toUpperCase();

  const decodeCtx: EnrouteOperationalDecodeContext = {
    departureIcao: depId,
    arrivalIcao: arrId,
    filedRouteAvailable: options?.filedRouteAvailable === true,
  };

  const enriched = advisories.map((a) => {
    const raw = a.rawText ?? "";
    const { tag, phrase } = inferEnrouteAdvisoryRelevance(raw, depId, arrId, a.areaHint);
    const description = a.description ?? "";

    const rich = buildOperationalEnroutePilotSummary({
      classifiedType: a.type,
      title: a.title,
      rawText: raw,
      area: a.areaHint ?? null,
      relevancePhrase: phrase,
      relevanceTag: tag,
    });

    const pilotSummary = formatEnroutePilotSummaryTypography(
      expandAviationAbbreviationsInPilotSummary(
      rich ??
        parseEnrouteAdvisoryPilotSummary({
          classifiedType: a.type,
          title: a.title,
          rawText: raw,
          area: a.areaHint ?? null,
        }) ??
        buildEnrouteAdvisoryPilotSummary(a.title, description)
    )
    );

    const withCore = {
      ...a,
      relevanceTag: tag,
      pilotSummary,
    };
    return {
      ...withCore,
      operationalDecode: buildEnrouteOperationalDecode(withCore, decodeCtx),
      relevanceConfidence: computeEnrouteRelevanceConfidence(withCore),
    };
  });

  const deduped = dedupeEnrichedAdvisoriesByPilotSummary(enriched);
  const sorted = [...deduped].sort((a, b) => advisoryDisplayScore(b) - advisoryDisplayScore(a));

  return sorted.slice(0, Math.min(MAX_VISIBLE_ADVISORIES, sorted.length));
}
