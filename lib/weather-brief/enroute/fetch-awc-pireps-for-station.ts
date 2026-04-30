/**
 * AWC PIREP summary for one station (server-only, free API).
 * @see https://aviationweather.gov/data/api/
 */

import { unstable_cache } from "next/cache";

import { resolveStationCode } from "../resolve-station-code";
import type { EnrouteStationPirepSummary, EnrouteTurbulenceMax, EnrouteIcingMax } from "./types";

const AWC_BASE = "https://aviationweather.gov/api/data";
const FETCH_TIMEOUT_MS = 15_000;
/** Radial search from station; nautical miles (AWC PIREP query). */
const PIREP_RADIAL_NM = 100;

const FETCH_HEADERS = {
  "User-Agent": "CrewRules-WeatherBrief/1.0",
} as const;

const FETCH_OPTS: RequestInit = {
  headers: FETCH_HEADERS,
  next: { revalidate: 300 },
};

const TURB_RANK: Record<EnrouteTurbulenceMax, number> = {
  NONE: 0,
  UNKNOWN: 0,
  LGT: 1,
  MOD: 2,
  SEV: 3,
};

const ICE_RANK: Record<EnrouteIcingMax, number> = {
  NONE: 0,
  UNKNOWN: 0,
  TRACE: 1,
  LGT: 2,
  MOD: 3,
  SEV: 4,
};

/** Empty aggregate — same shape as a failed fetch. Exported for tests/fallback call sites. */
export function emptyEnroutePirepSummary(): EnrouteStationPirepSummary {
  return emptySummary();
}

function emptySummary(): EnrouteStationPirepSummary {
  return {
    hasReports: false,
    turbulenceMax: "NONE",
    icingMax: "NONE",
    convectionReported: false,
    nearestDistanceNm: null,
    reportCount: 0,
    headline: "",
  };
}

function maxTurbulence(a: EnrouteTurbulenceMax, b: EnrouteTurbulenceMax): EnrouteTurbulenceMax {
  return TURB_RANK[a] >= TURB_RANK[b] ? a : b;
}

function maxIcing(a: EnrouteIcingMax, b: EnrouteIcingMax): EnrouteIcingMax {
  return ICE_RANK[a] >= ICE_RANK[b] ? a : b;
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function normToken(s: string): string {
  return s.trim().toUpperCase();
}

function turbFromTbField(v: string): EnrouteTurbulenceMax {
  const u = normToken(v);
  if (!u || u === "NEG") return "NONE";
  if (u === "SEV") return "SEV";
  if (u === "MOD") return "MOD";
  if (u === "LGT") return "LGT";
  return "NONE";
}

/** Decodes AWC tbInt* then /TB segment in rawOb into turbulence max. */
function parseTurbulenceFromRecord(r: Record<string, unknown>): EnrouteTurbulenceMax {
  let best: EnrouteTurbulenceMax = "NONE";
  for (const f of [String(r.tbInt1 ?? ""), String(r.tbInt2 ?? "")]) {
    const x = turbFromTbField(f);
    best = maxTurbulence(best, x);
  }
  if (best !== "NONE") return best;

  const raw = String(r.rawOb ?? "").toUpperCase();
  const m = raw.match(/\/TB\s+([^/]+)/);
  const seg = m ? (m[1] ?? "").trim() : "";
  if (!seg) return "NONE";
  if (/\bSEV\b|SEVERE/.test(seg)) return "SEV";
  if (/\bMOD\b|MODERATE/.test(seg)) return "MOD";
  if (/\bLGT\b|LIGHT|\bINTMT\b/.test(seg)) return "LGT";
  if (/\bNEG\b|SMOOTH/.test(seg)) return "NONE";
  return "NONE";
}

function iceFromIcgField(v: string): EnrouteIcingMax {
  const u = normToken(v);
  if (!u || /NEG|CLR/.test(u)) return "NONE";
  if (u === "SEV") return "SEV";
  if (u === "MOD") return "MOD";
  if (u === "LGT") return "LGT";
  if (u === "TRACE" || u === "TRC") return "TRACE";
  return "NONE";
}

/** Decodes AWC icgInt* then /IC segment in rawOb into icing max. */
function parseIcingFromRecord(r: Record<string, unknown>): EnrouteIcingMax {
  let best: EnrouteIcingMax = "NONE";
  for (const f of [String(r.icgInt1 ?? ""), String(r.icgInt2 ?? "")]) {
    best = maxIcing(best, iceFromIcgField(f));
  }
  if (best !== "NONE") return best;

  const raw = String(r.rawOb ?? "").toUpperCase();
  const m = raw.match(/\/IC\s+([^/]+)/);
  const seg = m ? (m[1] ?? "").trim() : "";
  if (!seg) return "NONE";
  if (/\bSEV\b|SEVERE/.test(seg)) return "SEV";
  if (/\bMOD\b|MODERATE/.test(seg)) return "MOD";
  if (/\bLGT\b|LIGHT/.test(seg)) return "LGT";
  if (/\bTRACE\b|\bTRC\b/.test(seg)) return "TRACE";
  return "NONE";
}

function recordSuggestsConvection(r: Record<string, unknown>): boolean {
  const t = [String(r.rawOb ?? ""), String(r.wxString ?? "")]
    .join(" ")
    .toUpperCase();
  return (
    /\bTSRA\b|\bVCTS\b|\bCB\b/.test(t) ||
    /THUNDERSTORM|CONVECT|TSTM/.test(t) ||
    /\/WX[^/]*(TS|CB|VCTS|TSRA)/.test(t)
  );
}

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3440.065;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function fetchJsonArray(url: string): Promise<unknown[] | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...FETCH_OPTS, signal: ac.signal });
    if (!res.ok) return null;
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return null;
    }
    if (Array.isArray(data)) return data;
    if (isPlainObject(data) && data.status === "error") return null;
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchStationRefLatLon(icao: string): Promise<{ lat: number; lon: number } | null> {
  const url = `${AWC_BASE}/metar?ids=${encodeURIComponent(icao)}&format=json`;
  const rows = await fetchJsonArray(url);
  const first = rows?.[0];
  if (!isPlainObject(first)) return null;
  const lat = first.lat;
  const lon = first.lon;
  if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }
  return { lat, lon };
}

function buildHeadline(
  count: number,
  turb: EnrouteTurbulenceMax,
  ice: EnrouteIcingMax,
  convection: boolean
): string {
  if (count <= 0) return "";

  const parts: string[] = [];
  if (turb === "SEV" || turb === "MOD") {
    parts.push(`${turb} turbulence`);
  } else if (turb === "LGT") {
    parts.push(`LGT turbulence`);
  }
  if (ice === "SEV" || ice === "MOD") {
    parts.push(`${ice} icing`);
  } else if (ice === "LGT" || ice === "TRACE") {
    parts.push(`${ice === "TRACE" ? "trace" : "LGT"} icing`);
  }
  if (convection) {
    parts.push("convection");
  }

  const noun = count === 1 ? "PIREP" : "PIREPs";
  if (parts.length === 0) {
    return `${count} ${noun} nearby`;
  }
  return `${count} ${noun} nearby — ${parts[0]}`;
}

async function fetchAwcPirepSummaryUncached(stationIcao: string): Promise<EnrouteStationPirepSummary> {
  const icao = resolveStationCode(stationIcao).trim().toUpperCase();
  if (!icao || icao.length < 4) {
    return emptySummary();
  }

  const pirepUrl = `${AWC_BASE}/pirep?format=json&id=${encodeURIComponent(icao)}&radialDistance=${PIREP_RADIAL_NM}`;
  const [ref, rows] = await Promise.all([fetchStationRefLatLon(icao), fetchJsonArray(pirepUrl)]);

  if (!rows || rows.length === 0) {
    return emptySummary();
  }

  let turbMax: EnrouteTurbulenceMax = "NONE";
  let iceMax: EnrouteIcingMax = "NONE";
  let convection = false;
  let nearestNm: number | null = null;

  for (const row of rows) {
    if (!isPlainObject(row)) continue;
    const t = parseTurbulenceFromRecord(row);
    const i = parseIcingFromRecord(row);
    turbMax = maxTurbulence(turbMax, t);
    iceMax = maxIcing(iceMax, i);
    if (recordSuggestsConvection(row)) convection = true;

    if (ref && typeof row.lat === "number" && typeof row.lon === "number") {
      const d = haversineNm(ref.lat, ref.lon, row.lat, row.lon);
      if (Number.isFinite(d)) {
        nearestNm = nearestNm == null ? d : Math.min(nearestNm, d);
      }
    }
  }

  const count = rows.filter((r) => isPlainObject(r)).length;
  if (count === 0) {
    return emptySummary();
  }

  return {
    hasReports: true,
    turbulenceMax: turbMax,
    icingMax: iceMax,
    convectionReported: convection,
    nearestDistanceNm: nearestNm,
    reportCount: count,
    headline: buildHeadline(count, turbMax, iceMax, convection),
  };
}

function pirepCacheTag(icao: string): string {
  return `weather-brief-pirep:${icao}`;
}

/**
 * AWC PIREPs in a radial around `stationIcao`, aggregated into EnrouteStationPirepSummary.
 * Never throws.
 */
export async function fetchAwcPirepSummaryForStation(stationIcao: string): Promise<EnrouteStationPirepSummary> {
  try {
    const icao = resolveStationCode(stationIcao).trim().toUpperCase();
    if (!icao || icao.length < 4) {
      return emptySummary();
    }
    const tag = pirepCacheTag(icao);
    const fetcher = unstable_cache(
      async () => fetchAwcPirepSummaryUncached(icao),
      ["weather-brief", "awc-pirep-station-v1", icao, String(PIREP_RADIAL_NM)],
      {
        revalidate: 300,
        tags: [tag],
      }
    );
    return await fetcher();
  } catch {
    return emptySummary();
  }
}
