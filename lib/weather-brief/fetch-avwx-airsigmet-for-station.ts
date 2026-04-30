/**
 * AVWX per-station AIR/SIGMET (geometry “contains” filter for the given ICAO).
 * @see https://avwx.rest — GET /api/airsigmet/{location}
 */

import { unstable_cache } from "next/cache";

import type { EnrouteAdvisory } from "./types";

const AVWX_AIRSIGMET_BASE = "https://avwx.rest/api/airsigmet";
const FETCH_TIMEOUT_MS = 15_000;
/** Match AWC advisory fetch revalidation in get-enroute-advisories. */
export const AVWX_AIRSIGMET_CACHE_REVALIDATE_SECONDS = 300;

const FETCH_HEADERS_BASE = {
  "User-Agent": "CrewRules-WeatherBrief/1.0 (https://crewrules.com)",
} as const;

type AvwxBulletinType = { repr?: string; value?: string };

type AvwxAirSigmetReport = {
  raw?: string;
  sanitized?: string;
  body?: string;
  type?: string;
  area?: string;
  bulletin?: {
    type?: AvwxBulletinType;
    number?: number;
    repr?: string;
  };
  end_time?: { repr?: string; dt?: string } | null;
};

function extractReports(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  if (Array.isArray(p.reports)) return p.reports;
  if (Array.isArray(p.data)) return p.data;
  return [];
}

function pickRawBody(r: AvwxAirSigmetReport): string | null {
  const raw = typeof r.raw === "string" ? r.raw.trim() : "";
  const sanitized = typeof r.sanitized === "string" ? r.sanitized.trim() : "";
  const body = typeof r.body === "string" ? r.body.trim() : "";
  const text = raw || sanitized || body;
  return text.length > 0 ? text : null;
}

/** Classify from AVWX bulletin/type fields first; safe text fallback only if needed. */
export function classifyAvwxAirSigmetType(r: AvwxAirSigmetReport): EnrouteAdvisory["type"] {
  const value = (r.bulletin?.type?.value ?? "").toString().toLowerCase().trim();
  const repr = (r.bulletin?.type?.repr ?? "").toString().toUpperCase().trim();
  const topType = (r.type ?? "").toString().toUpperCase();
  const bundleUpper = `${r.raw ?? ""} ${r.sanitized ?? ""} ${r.body ?? ""}`.toUpperCase();

  if (value === "airmet" || repr === "WA" || topType.includes("AIRMET") || /\bAIRMET\b/.test(bundleUpper)) {
    return "AIRMET";
  }

  if (
    value.includes("conv_sigmet") ||
    value.includes("convective") ||
    topType.includes("CONVECTIVE") ||
    /\bCONVECTIVE\s+SIGMET\b/.test(bundleUpper)
  ) {
    return "CONVECTIVE_SIGMET";
  }

  if (value === "sigmet" || repr === "WS" || repr === "WV" || topType.includes("SIGMET") || /\bSIGMET\b/.test(bundleUpper)) {
    if (/\bCONVECTIVE\b/.test(bundleUpper)) return "CONVECTIVE_SIGMET";
    return "SIGMET";
  }

  if (/\bCONVECTIVE\s+SIGMET\b/.test(bundleUpper)) return "CONVECTIVE_SIGMET";
  if (/\bAIRMET\b/.test(bundleUpper)) return "AIRMET";
  if (/\bSIGMET\b/.test(bundleUpper)) return "SIGMET";

  return "SIGMET";
}

function sourceUrlForAdvisoryKind(kind: EnrouteAdvisory["type"]): string {
  return kind === "AIRMET" ? "https://aviationweather.gov/airmet" : "https://aviationweather.gov/sigmet";
}

export function mapAvwxAirSigmetReportToAdvisory(report: unknown): EnrouteAdvisory | null {
  if (!report || typeof report !== "object") return null;
  const r = report as AvwxAirSigmetReport;
  const text = pickRawBody(r);
  if (!text) return null;

  const kind = classifyAvwxAirSigmetType(r);
  const titleParts = [r.area, r.type].filter((x) => typeof x === "string" && x.trim().length > 0);
  const title =
    titleParts.length > 0
      ? titleParts.join(" · ")
      : r.bulletin?.number != null
        ? `AIR/SIGMET #${r.bulletin.number}`
        : "AIR/SIGMET";

  const description = text.length > 200 ? `${text.slice(0, 200)}…` : text;

  return {
    type: kind,
    title,
    description,
    rawText: text,
    areaHint: typeof r.area === "string" ? r.area.trim() || null : null,
    sourceUrl: sourceUrlForAdvisoryKind(kind),
    provider: "avwx",
  };
}

function avwxAirSigmetStationTag(icao: string): string {
  return `weather-brief-avwx-airsigmet:${icao.trim().toUpperCase()}`;
}

async function fetchAvwxAirSigmetPayload(
  stationIcao: string,
  apiKey: string
): Promise<{ ok: true; payload: unknown } | { ok: false }> {
  const icao = stationIcao.trim().toUpperCase();
  const url = `${AVWX_AIRSIGMET_BASE}/${encodeURIComponent(icao)}?format=json&onfail=cache`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        ...FETCH_HEADERS_BASE,
        Authorization: `Bearer ${apiKey}`,
      },
      signal: ac.signal,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false };
    try {
      const payload = (await res.json()) as unknown;
      return { ok: true, payload };
    } catch {
      return { ok: false };
    }
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(t);
  }
}

async function fetchAvwxAdvisoriesForStationUncached(
  stationIcao: string,
  apiKey: string
): Promise<EnrouteAdvisory[]> {
  const res = await fetchAvwxAirSigmetPayload(stationIcao, apiKey);
  if (!res.ok) return [];
  const rows = extractReports(res.payload);
  const out: EnrouteAdvisory[] = [];
  for (const row of rows) {
    if (out.length >= 8) break;
    const adv = mapAvwxAirSigmetReportToAdvisory(row);
    if (adv) out.push(adv);
  }
  return out;
}

/**
 * Cached AVWX AIR/SIGMET for one station (brief generation only — not for background jobs).
 */
export async function getCachedAvwxAirSigmetAdvisoriesForStation(
  stationIcao: string
): Promise<EnrouteAdvisory[]> {
  const apiKey = process.env.AVWX_API_KEY?.trim();
  if (!apiKey) return [];

  const icao = stationIcao.trim().toUpperCase();
  if (!icao) return [];

  const fetcher = unstable_cache(
    async () => fetchAvwxAdvisoriesForStationUncached(icao, apiKey),
    ["weather-brief", "avwx-airsigmet-station-v1", icao],
    {
      revalidate: AVWX_AIRSIGMET_CACHE_REVALIDATE_SECONDS,
      tags: [avwxAirSigmetStationTag(icao)],
    }
  );
  return fetcher();
}
