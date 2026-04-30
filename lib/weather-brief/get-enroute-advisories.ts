/**
 * Enroute SIGMET / AIRMET / convective SIGMET-style advisories.
 *
 * - Baseline: U.S. Aviation Weather Center JSON (government feed).
 * - Supplemental: AVWX per-station `/api/airsigmet/{ICAO}` when `AVWX_API_KEY` is set
 *   (geometry contains filter — no full route corridor in v1).
 *
 * AWC failures are non-fatal; AVWX may still populate the card. Lists are deduped by
 * normalized raw/sanitized-style text when possible, then by type + title + text prefix.
 */

import type { EnrouteAdvisory } from "./types";
import { resolveStationCode } from "./resolve-station-code";
import { getCachedAvwxAirSigmetAdvisoriesForStation } from "./fetch-avwx-airsigmet-for-station";
import { enrichRankAndTrimEnrouteAdvisories } from "./enrich-enroute-advisories-for-display";
import { filterEnrouteAdvisoriesForFlightWindow } from "./enroute-advisory-time-relevance";

const AWC_BASE = "https://aviationweather.gov/api/data";
const AWC_FETCH_OPTS: RequestInit = {
  headers: { "User-Agent": "CrewRules-WeatherBrief/1.0 (https://crewrules.com)" },
  next: { revalidate: 300 },
};

const MAX_AWC_ADVISORIES = 6;
const MAX_MERGED_ADVISORIES = 14;

type AirSigmetRecord = {
  icaoId?: string;
  sigmetId?: string;
  airmetId?: string;
  rawSigmet?: string;
  rawAirmet?: string;
  hazard?: { type?: string; severity?: string };
  [k: string]: unknown;
};

function normalizeForDedupe(s: string): string {
  return s.replace(/\s+/g, " ").trim().toUpperCase();
}

/** Dedupe keys: full normalized raw when long enough, description body, composite fallback. */
function dedupeKeysForAdvisory(a: EnrouteAdvisory): string[] {
  const keys = new Set<string>();
  const raw = normalizeForDedupe(a.rawText ?? "");
  const desc = normalizeForDedupe(a.description.replace(/…\s*$/u, "").trim());
  if (raw.length >= 20) keys.add(raw);
  if (desc.length >= 20 && desc !== raw) keys.add(desc);
  keys.add(`${a.type}|${normalizeForDedupe(a.title)}|${raw.slice(0, 120)}`);
  return [...keys];
}

/** AWC items first (baseline order), then AVWX; cross-provider dedupe. */
function mergeAwcThenAvwx(awc: EnrouteAdvisory[], avwx: EnrouteAdvisory[]): EnrouteAdvisory[] {
  const seen = new Set<string>();
  const out: EnrouteAdvisory[] = [];

  const tryAdd = (a: EnrouteAdvisory) => {
    const keys = dedupeKeysForAdvisory(a);
    if (keys.some((k) => seen.has(k))) return;
    for (const k of keys) seen.add(k);
    out.push(a);
  };

  for (const a of awc) tryAdd(a);
  for (const a of avwx) tryAdd(a);
  return out.slice(0, MAX_MERGED_ADVISORIES);
}

async function fetchAwcAdvisories(stationIds: string[]): Promise<EnrouteAdvisory[]> {
  const advisories: EnrouteAdvisory[] = [];

  try {
    const url = `${AWC_BASE}/airsigmet?format=json`;
    const res = await fetch(url, AWC_FETCH_OPTS);

    if (res.ok) {
      const data = (await res.json()) as AirSigmetRecord[];
      const items = Array.isArray(data) ? data : [];
      for (const r of items) {
        if (advisories.length >= MAX_AWC_ADVISORIES) break;
        if (!r.rawSigmet && !r.rawAirmet) continue;
        const raw = r.rawSigmet ?? r.rawAirmet ?? "";
        const rawUpper = raw.toUpperCase();
        const mentionsRoute = stationIds.some((id) => id.length >= 3 && rawUpper.includes(id));
        if (!mentionsRoute) continue;

        const hazard = r.hazard?.type ?? "Advisory";
        const isConvective = (r.icaoId ?? "").toString().startsWith("W");
        const type = r.airmetId ? "AIRMET" : isConvective ? "CONVECTIVE_SIGMET" : "SIGMET";
        const title = (r.sigmetId ?? r.airmetId ?? hazard) as string;
        const description = raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
        advisories.push({
          type,
          title,
          description,
          rawText: raw,
          areaHint: null,
          sourceUrl:
            type === "AIRMET" ? "https://aviationweather.gov/airmet" : "https://aviationweather.gov/sigmet",
          provider: "awc",
        });
      }
    }
  } catch {
    // Best-effort; AVWX may still run
  }

  return advisories;
}

export type GetEnrouteAdvisoriesOptions = {
  /** When true, operational decode may use route context in future; rule-based v1 ignores except API stability. */
  filedRouteAvailable?: boolean;
  /** Scheduled departure (UTC) — filters time-relevant lists and the Enroute card pipeline by VALID UNTIL. */
  departureUtc?: Date | null;
};

/** Merged + deduped (AWC/AVWX); time-filtered slice for UI/risk; enriched top-N for Enroute card only. */
export type GetEnrouteAdvisoriesResult = {
  /** Full merged list, merge/dedupe order unchanged — preserve for debugging / lineage; do not use for Watch/risk/pilot. */
  operational: EnrouteAdvisory[];
  /** After VALID UNTIL vs scheduled departure (+ wall clock) — use for Operational Watch, risk summary, pilot summary. */
  timeRelevantOperational: EnrouteAdvisory[];
  /** Card-only: enriched pilotSummary, trim, display dedupe. */
  display: EnrouteAdvisory[];
  /** True when merged advisories existed but none matched the departure time window for the card. */
  enrouteDisplayNoTimeRelevant?: boolean;
};

/**
 * Merged AWC + AVWX (when keyed) SIGMET/AIRMET advisories for departure and arrival.
 */
export async function getEnrouteAdvisories(
  departureIcao: string,
  arrivalIcao: string,
  options?: GetEnrouteAdvisoriesOptions
): Promise<GetEnrouteAdvisoriesResult> {
  const depId = resolveStationCode(departureIcao).toUpperCase();
  const arrId = resolveStationCode(arrivalIcao).toUpperCase();
  const stationIds = depId === arrId ? [depId] : [depId, arrId];

  const awc = await fetchAwcAdvisories(stationIds);

  const avwxLists = await Promise.all(
    stationIds.map((id) => getCachedAvwxAirSigmetAdvisoriesForStation(id))
  );
  const avwx = avwxLists.flat();

  const operational = mergeAwcThenAvwx(awc, avwx);

  const departureUtc = options?.departureUtc ?? null;
  let displayInput = operational;
  let timeRelevantOperational = operational;
  let enrouteDisplayNoTimeRelevant = false;
  if (departureUtc && !Number.isNaN(departureUtc.getTime())) {
    const { advisories, allFilteredByTime } = filterEnrouteAdvisoriesForFlightWindow(
      operational,
      departureUtc
    );
    displayInput = advisories;
    timeRelevantOperational = advisories;
    enrouteDisplayNoTimeRelevant = allFilteredByTime;
  }

  const display = enrichRankAndTrimEnrouteAdvisories(displayInput, departureIcao, arrivalIcao, {
    filedRouteAvailable: options?.filedRouteAvailable === true,
  });

  return { operational, timeRelevantOperational, display, enrouteDisplayNoTimeRelevant };
}
