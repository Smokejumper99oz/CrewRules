/**
 * Lightweight winds aloft for CrewRules™ Enroute Performance™ (v1): one reference point (departure).
 * Uses AWC FB wind/temp bulletin; parses text (server often returns plaintext even when format=json requested).
 */

import { resolveStationCode } from "@/lib/weather-brief/resolve-station-code";

export type WindsAloftLevels = {
  FL320: { windSpeed: number };
  FL340: { windSpeed: number };
  FL360: { windSpeed: number };
  FL380: { windSpeed: number };
};

export type WindsAloftSource = "awc_fb" | "fallback";

export type WindsAloftSimpleResult = {
  winds: WindsAloftLevels;
  source: WindsAloftSource;
  /** ICAO-relative FB bulletin row identifier used after fallbacks (e.g. `PIE` when departure is `TPA`). */
  stationIdUsed?: string;
};

const FETCH_HEADERS = {
  "User-Agent": "CrewRules-WeatherBrief/1.0 (https://crewrules.com)",
} as const;

const MOCK_WINDS: WindsAloftLevels = {
  FL320: { windSpeed: 18 },
  FL340: { windSpeed: 22 },
  FL360: { windSpeed: 25 },
  FL380: { windSpeed: 24 },
};

/** When FB winds table omits departure, use bulletin row ID for nearest listed site (see AWC FB windtemp). */
const FB_WIND_STATION_FALLBACKS: Record<string, string> = {
  TPA: "PIE",
  KTPA: "PIE",
  PIE: "PIE",
  KPIE: "PIE",
  SJU: "SJU",
  TJSJ: "SJU",
};

/** Fallback when station row not found / parse fails — matches prior UI mock tiers. */

function fbStationId(departureIcao: string): string {
  const icao = resolveStationCode(departureIcao).toUpperCase().trim();
  if (!icao) return "";
  /* CONUS bulletin uses K-stripped identifiers (DEN, etc.). */
  if (/^K[A-Z]{3}$/.test(icao)) return icao.slice(1);
  if (icao.length <= 4) return icao.slice(-3); /* pragmatic e.g. SJU-ish */
  return icao;
}

/**
 * FB bulletin ids for line match: resolve ICAO → strip-K id → optional hardcoded nearer row.
 */
function fbWindTableStationId(departureIcao: string): string | null {
  const canon = resolveStationCode(departureIcao).trim().toUpperCase();
  if (!canon) return null;
  const stripped = fbStationId(departureIcao);
  const mapped =
    FB_WIND_STATION_FALLBACKS[canon] ??
    (stripped ? FB_WIND_STATION_FALLBACKS[stripped] : undefined) ??
    (stripped ? FB_WIND_STATION_FALLBACKS[`K${stripped}`] : undefined) ??
    stripped;
  if (!mapped) return null;
  return mapped.toUpperCase();
}

/** Heuristic wind speed (kt) from a single FB encoded cell — v1 tolerant of standard 5–6 digit groups. */
function windSpeedKtFromFbCell(cell: string): number | null {
  const trimmed = cell.trim().toUpperCase();
  if (/^9900/.test(trimmed)) return 10;
  const noTemp = trimmed.replace(/[+-]\d+$/, "");
  const digits = noTemp.match(/^\d+/)?.[0];
  if (!digits || digits.length < 5) return null;
  /* Middle two digits approximate reported wind speed (see AWC FB wind/temp help). */
  let kt =
    digits.length >= 6
      ? parseInt(digits.slice(2, 4), 10)
      : parseInt(digits.slice(2, Math.min(4, digits.length)), 10);
  if (!Number.isFinite(kt) || kt <= 5) kt = parseInt(digits.slice(3, 5), 10);
  if (!Number.isFinite(kt)) return null;
  return Math.min(220, Math.max(0, kt));
}

/** Extract FT altitude column order + station row tokens from FB plaintext. */
function extractWindsFromFbText(blob: string, stationIdUpper: string): WindsAloftLevels | null {
  const lines = blob.split(/\r?\n/).map((l) => l.trim());
  /* FT line marks altitude tiers in left-to-right order (do not re-sort — pairs with tokens). */
  const ftLine =
    lines.find((l) => /^FT\b/i.test(l) && /\b39000\b/.test(l)) ??
    lines.find((l) => /^FT\b/i.test(l) && /\b34000\b/.test(l));
  if (!ftLine) return null;
  const partsRaw = ftLine.trim().split(/\s+/);
  if ((partsRaw[0] ?? "").toUpperCase() !== "FT") return null;
  const headerNums = partsRaw.slice(1).map((x) => parseInt(x, 10)).filter((n) => Number.isFinite(n) && n > 500);
  if (headerNums.length < 7) return null;

  const escaped = stationIdUpper.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stationLine = lines.find((l) => new RegExp(`^${escaped}\\s+`).test(l.trim()));
  if (!stationLine) return null;

  const tokens = stationLine.trim().split(/\s+/).slice(1);
  const startIdx = headerNums.length - tokens.length;
  if (startIdx < 0) return null;

  const ktAt = (ft: number): number | null => {
    const ix = headerNums.indexOf(ft);
    if (ix < 0) return null;
    const tokenIdx = ix - startIdx;
    const tk = tokenIdx >= 0 ? tokens[tokenIdx] : "";
    return tk ? windSpeedKtFromFbCell(tk) : null;
  };

  const w30 = ktAt(30_000) ?? ktAt(24_000);
  const w34 = ktAt(34_000);
  const w39 = ktAt(39_000);

  if (w30 == null && w34 == null && w39 == null) return null;

  const avg = (a: number | null, b: number | null, fb: number) => {
    if (a != null && b != null) return Math.round((a + b) / 2);
    if (a != null) return a;
    if (b != null) return b;
    return fb;
  };

  return {
    FL320: { windSpeed: w30 ?? MOCK_WINDS.FL320.windSpeed },
    FL340: { windSpeed: w34 ?? w30 ?? MOCK_WINDS.FL340.windSpeed },
    FL360: { windSpeed: avg(w34 ?? w30 ?? null, w39 ?? null, MOCK_WINDS.FL360.windSpeed) },
    FL380: { windSpeed: w39 ?? w34 ?? MOCK_WINDS.FL380.windSpeed },
  };
}

async function normalizeResponseBody(raw: string): Promise<string> {
  const t = raw.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return raw;
  try {
    const parsed = JSON.parse(t) as unknown;
    /* Common patterns: [{ rawText }] or { data: ... } — prefer embedded text */
    const fromObj = (obj: Record<string, unknown>): string | null => {
      for (const k of ["rawText", "text", "data", "raw", "bullText"]) {
        const v = obj[k];
        if (typeof v === "string" && /FT\s+|DATA BASED/i.test(v)) return v;
      }
      return null;
    };
    if (Array.isArray(parsed) && parsed[0]) {
      if (typeof parsed[0] === "object" && parsed[0] !== null) {
        const blob = fromObj(parsed[0] as Record<string, unknown>);
        if (blob) return blob;
      }
    }
    if (parsed && typeof parsed === "object" && parsed !== null) {
      const blob = fromObj(parsed as Record<string, unknown>);
      if (blob) return blob;
    }
    return raw;
  } catch {
    return raw;
  }
}

export async function getWindsAloftSimple({
  departureAirport,
  arrivalAirport,
}: {
  departureAirport: string;
  arrivalAirport: string;
}): Promise<WindsAloftSimpleResult> {
  /* arrival retained for signature stability / future midpoint use */
  void arrivalAirport;
  const fallback = (opts?: { stationIdUsed?: string }): WindsAloftSimpleResult => ({
    winds: MOCK_WINDS,
    source: "fallback",
    stationIdUsed: opts?.stationIdUsed,
  });
  try {
    const ids = encodeURIComponent(resolveStationCode(departureAirport).trim());
    const url = `https://aviationweather.gov/api/data/windtemp?ids=${ids}&format=json`;
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return fallback();
    }
    const rawBody = await res.text();
    const text = await normalizeResponseBody(rawBody);
    const fbTableId = fbWindTableStationId(departureAirport);
    if (!fbTableId) return fallback();
    const parsed = extractWindsFromFbText(text, fbTableId);
    if (!parsed) {
      return fallback({ stationIdUsed: fbTableId });
    }
    return { winds: parsed, source: "awc_fb", stationIdUsed: fbTableId };
  } catch {
    return fallback();
  }
}
