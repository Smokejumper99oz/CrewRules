/**
 * AVWX NBM fetch + nearest forecast period selection (server-only; AVWX_API_KEY from env).
 * Does not map to EnrouteStationForecastSummary — use `mapNbmForecastStepToSummary` separately.
 *
 * @see https://avwx.rest
 */

import { unstable_cache } from "next/cache";

const AVWX_NBM_BASE = "https://avwx.rest/api/nbm";
const FETCH_TIMEOUT_MS = 15_000;

const FETCH_HEADERS_BASE = {
  "User-Agent": "CrewRules-WeatherBrief/1.0 (https://crewrules.com)",
} as const;

export type NbmReport = "nbh" | "nbs" | "nbe";

export type FetchNbmForecastStepParams = {
  stationIcao: string;
  etaIso: string;
};

export type FetchNbmForecastStepResult =
  | {
      ok: true;
      report: NbmReport;
      stationIcao: string;
      fetchedAt: string;
      step: unknown;
    }
  | { ok: false; reason: string };

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function nbmCacheTag(icao: string, report: NbmReport): string {
  return `weather-brief-nbm:${icao}:${report}`;
}

function revalidateSecondsForReport(report: NbmReport): number {
  switch (report) {
    case "nbh":
      return 15 * 60;
    case "nbs":
      return 30 * 60;
    case "nbe":
      return 60 * 60;
    default: {
      const _exhaustive: never = report;
      return _exhaustive;
    }
  }
}

/** Hours from now until ETA (can be negative if ETA is in the past). */
function hoursFromNowUntilEta(etaMs: number): number {
  return (etaMs - Date.now()) / (60 * 60 * 1000);
}

function selectReportForEta(etaMs: number): NbmReport {
  const h = hoursFromNowUntilEta(etaMs);
  if (h <= 25) return "nbh";
  if (h <= 72) return "nbs";
  return "nbe";
}

function extractForecastArray(payload: unknown): unknown[] {
  if (!isPlainObject(payload)) return [];
  if (Array.isArray(payload.forecast)) return payload.forecast;
  const data = payload.data;
  if (isPlainObject(data) && Array.isArray(data.forecast)) return data.forecast;
  return [];
}

/** Prior `meta.timestamp` from AVWX when parseable; else fetch completion time. */
function readFetchedAtFromPayload(payload: unknown, fallbackIso: string): string {
  if (!isPlainObject(payload)) return fallbackIso;
  const meta = payload.meta;
  if (isPlainObject(meta)) {
    const ts = meta.timestamp;
    if (typeof ts === "string" && ts.trim()) {
      const d = new Date(ts.trim());
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }
  return fallbackIso;
}

function selectStepNearestEta(periods: unknown[], etaMs: number): unknown | null {
  let best: { step: unknown; diff: number } | null = null;
  for (const p of periods) {
    if (!isPlainObject(p)) continue;
    const time = p.time;
    if (!isPlainObject(time)) continue;
    const dt = time.dt;
    if (typeof dt !== "string" || !dt.trim()) continue;
    const t = new Date(dt.trim());
    if (isNaN(t.getTime())) continue;
    const diff = Math.abs(t.getTime() - etaMs);
    if (best === null || diff < best.diff) {
      best = { step: p, diff };
    }
  }
  return best?.step ?? null;
}

type CachedNbmFetchResult =
  | { ok: true; forecast: unknown[]; fetchedAt: string }
  | { ok: false; reason: string };

async function fetchNbmForecastUncached(
  icao: string,
  report: NbmReport,
  apiKey: string
): Promise<CachedNbmFetchResult> {
  const url = `${AVWX_NBM_BASE}/${encodeURIComponent(report)}/${encodeURIComponent(icao)}`;
  const fetchedAtFallback = new Date().toISOString();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        ...FETCH_HEADERS_BASE,
        Authorization: `Bearer ${apiKey}`,
      },
      signal: ac.signal,
    });

    if (!res.ok) {
      return { ok: false, reason: "http_error" };
    }

    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      return { ok: false, reason: "parse_error" };
    }

    const forecast = extractForecastArray(payload);
    if (forecast.length === 0) {
      return { ok: false, reason: "empty_forecast" };
    }

    return {
      ok: true,
      forecast,
      fetchedAt: readFetchedAtFromPayload(payload, fetchedAtFallback),
    };
  } catch {
    return { ok: false, reason: "network_error" };
  } finally {
    clearTimeout(timer);
  }
}

async function getCachedNbmForecast(
  icao: string,
  report: NbmReport,
  apiKey: string
): Promise<CachedNbmFetchResult> {
  const revalidate = revalidateSecondsForReport(report);
  const tag = nbmCacheTag(icao, report);
  const fetcher = unstable_cache(
    async () => fetchNbmForecastUncached(icao, report, apiKey),
    ["weather-brief", "avwx-nbm-station-v1", icao, report],
    {
      revalidate,
      tags: [tag],
    }
  );
  return fetcher();
}

/**
 * Fetches NBM for one station (cached by ICAO + product) and returns the forecast period
 * whose `time.dt` is closest to `etaIso`.
 */
export async function fetchNbmForecastStepForStation(
  params: FetchNbmForecastStepParams
): Promise<FetchNbmForecastStepResult> {
  const apiKey = process.env.AVWX_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, reason: "missing_api_key" };
  }

  const stationIcao = params.stationIcao.trim().toUpperCase();
  if (!stationIcao || stationIcao.length < 4) {
    return { ok: false, reason: "invalid_icao" };
  }

  const eta = new Date(params.etaIso);
  if (isNaN(eta.getTime())) {
    return { ok: false, reason: "invalid_eta" };
  }

  const etaMs = eta.getTime();
  const report = selectReportForEta(etaMs);

  const cached = await getCachedNbmForecast(stationIcao, report, apiKey);
  if (!cached.ok) {
    return { ok: false, reason: cached.reason };
  }

  const step = selectStepNearestEta(cached.forecast, etaMs);
  if (step == null) {
    return { ok: false, reason: "no_valid_period" };
  }

  return {
    ok: true,
    report,
    stationIcao,
    fetchedAt: cached.fetchedAt,
    step,
  };
}
