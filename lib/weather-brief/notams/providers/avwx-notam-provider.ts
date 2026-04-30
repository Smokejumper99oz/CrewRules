/**
 * AVWX Enterprise NOTAM fetch (server-only; API key from env).
 * @see https://avwx.rest
 */

import { createHash } from "node:crypto";

import { unstable_cache } from "next/cache";

import type { OperationalNotamItem, OperationalNotamsBriefResult, OperationalNotamValidity } from "../types";

/** Singular `/notam/` per AVWX REST docs. */
const AVWX_NOTAM_BASE = "https://avwx.rest/api/notam";
const MAX_ITEMS_PER_AIRPORT = 6;
const FETCH_TIMEOUT_MS = 15_000;

const FETCH_HEADERS_BASE = {
  "User-Agent": "CrewRules-WeatherBrief/1.0 (https://crewrules.com)",
} as const;

/** Per-station AVWX NOTAM parse cache (no user / trip / tenant in key). */
export const AVWX_NOTAM_CACHE_REVALIDATE_SECONDS = 15 * 60;

export function avwxNotamStationTag(stationIcao: string): string {
  return `weather-brief-notams:${stationIcao.trim().toUpperCase()}`;
}

/** Uppercase substrings that exclude a NOTAM from Phase 1 display. */
const EXCLUDE_IF_CONTAINS = ["BIRD", "WILDLIFE", "ADMIN"] as const;

/** Keep + categorise (first matching rule wins). */
function categorisePhase1(text: string): OperationalNotamItem["category"] | null {
  if (/(AIRPORT\s+CLOSED|\bAP\s+CLSD\b)/i.test(text)) return "airport";
  if (/(\bRWY\b|RUNWAY)/i.test(text)) return "runway";
  if (/(TWY|TAXIWAY)/i.test(text)) return "taxiway";
  if (/(ILS|\bLOC\b|\bGS\b|GLIDESLOPE)/i.test(text)) return "ils";
  if (/(VOR|DME|NDB)/i.test(text)) return "navaid";
  if (/(TFR|RESTRICTED|AIRSPACE)/i.test(text)) return "airspace";
  return null;
}

function shouldExcludePhase1(text: string): boolean {
  const u = text.toUpperCase();
  return EXCLUDE_IF_CONTAINS.some((w) => u.includes(w));
}

/**
 * AVWX NOTAM envelope: `{ meta, data: [ { raw, sanitized, body, station, ... } ] }`.
 */
function extractNotamArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data;
    if (Array.isArray(o.notams)) return o.notams;
    if (Array.isArray(o.reports)) return o.reports;
  }
  return [];
}

/** Prefer human-readable bulletin text: body → sanitized → raw. */
function extractRawText(item: unknown): string {
  if (typeof item === "string") return item.trim();
  if (!item || typeof item !== "object") return "";
  const r = item as Record<string, unknown>;
  const candidates = [r.body, r.sanitized, r.raw];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

const PROVIDER_MESSAGE_MAX_LEN = 200;

/**
 * Pull a safe short message from AVWX/plane error JSON bodies. Never echoes secrets.
 */
function extractProviderErrorMessage(errBody: unknown): string | undefined {
  if (errBody == null) return undefined;
  if (typeof errBody === "string") {
    const t = errBody.trim();
    return t ? t.slice(0, PROVIDER_MESSAGE_MAX_LEN) : undefined;
  }
  if (typeof errBody !== "object") return undefined;
  const o = errBody as Record<string, unknown>;
  const direct = [o.message, o.detail, o.description];
  for (const d of direct) {
    if (typeof d === "string" && d.trim()) return d.trim().slice(0, PROVIDER_MESSAGE_MAX_LEN);
  }
  if (typeof o.error === "string" && o.error.trim()) return o.error.trim().slice(0, PROVIDER_MESSAGE_MAX_LEN);
  if (typeof o.error === "object" && o.error !== null && "message" in o.error && typeof (o.error as { message?: unknown }).message === "string") {
    return String((o.error as { message: string }).message).slice(0, PROVIDER_MESSAGE_MAX_LEN);
  }
  return undefined;
}

type AvwxFailureDiag = {
  stationIcao: string;
  httpStatus?: number;
  providerMessage?: string;
  /** Non-secret hint (e.g. timeout vs network vs parse). */
  errorKind?: "http" | "network" | "timeout" | "parse_response";
};

/** Server-side only — never logs Authorization headers or tokens. */
function logAvwxNotamFailureDiagnostic(diag: AvwxFailureDiag): void {
  console.warn("[weather-brief] AVWX NOTAM request failed:", {
    stationIcao: diag.stationIcao,
    ...(diag.httpStatus != null ? { httpStatus: diag.httpStatus } : {}),
    ...(diag.providerMessage ? { providerMessage: diag.providerMessage } : {}),
    ...(diag.errorKind ? { errorKind: diag.errorKind } : {}),
  });
}

function stableItemId(stationIcao: string, rawText: string, index: number): string {
  const h = createHash("sha256").update(`${stationIcao}|${index}|${rawText}`).digest("hex").slice(0, 20);
  return `avwx:${stationIcao}:${h}`;
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** AVWX Timestamp-like: `dt` serialized + `repr` (no rawText parsing). */
function readDtReprFragment(obj: unknown): { iso?: string; repr?: string } | undefined {
  if (!isPlainObject(obj)) return undefined;
  const iso = typeof obj.dt === "string" && obj.dt.trim() ? obj.dt.trim() : undefined;
  const repr = typeof obj.repr === "string" && obj.repr.trim() ? obj.repr.trim() : undefined;
  if (iso === undefined && repr === undefined) return undefined;
  const out: { iso?: string; repr?: string } = {};
  if (iso !== undefined) out.iso = iso;
  if (repr !== undefined) out.repr = repr;
  return out;
}

/**
 * AVWX `end_time`: Timestamp or Code — reads `dt`, `repr`, `value` only.
 */
function readExpiresFragment(endTime: unknown): Partial<NonNullable<OperationalNotamValidity["expires"]>> {
  if (!isPlainObject(endTime)) {
    return {};
  }
  const out: Partial<NonNullable<OperationalNotamValidity["expires"]>> = {};
  const iso = typeof endTime.dt === "string" && endTime.dt.trim() ? endTime.dt.trim() : undefined;
  const repr = typeof endTime.repr === "string" && endTime.repr.trim() ? endTime.repr.trim() : undefined;
  const value = typeof endTime.value === "string" ? endTime.value : undefined;
  if (iso !== undefined) out.iso = iso;
  if (repr !== undefined) out.repr = repr;
  if (value !== undefined) {
    out.value = value;
    if (value === "PERM") out.permanent = true;
  }
  return out;
}

/**
 * Maps structured AVWX NOTAM row fields to `validity` — omits empty branches.
 */
function validityFromAvwxRow(row: unknown): OperationalNotamItem["validity"] | undefined {
  if (!isPlainObject(row)) return undefined;

  const validity: OperationalNotamValidity = {};

  const effective = readDtReprFragment(row.start_time);
  if (effective) validity.effective = effective;

  const expiresFrag = readExpiresFragment(row.end_time);
  if (Object.keys(expiresFrag).length > 0) validity.expires = expiresFrag;

  const issued = readDtReprFragment(row.time);
  if (issued) validity.issued = issued;

  if (!validity.effective && !validity.expires && !validity.issued) return undefined;
  return validity;
}

function buildItemsForStation(stationIcao: string, avwxRows: unknown[]): OperationalNotamItem[] {
  const out: OperationalNotamItem[] = [];
  let rowsIndex = -1;

  for (const row of avwxRows) {
    if (out.length >= MAX_ITEMS_PER_AIRPORT) break;

    const rawText = extractRawText(row);
    if (!rawText) continue;
    rowsIndex += 1;

    if (shouldExcludePhase1(rawText)) continue;
    const category = categorisePhase1(rawText);
    if (category == null) continue;

    const validity = validityFromAvwxRow(row);
    const item: OperationalNotamItem = {
      id: stableItemId(stationIcao, rawText, rowsIndex),
      stationIcao,
      rawText,
      category,
    };
    if (validity !== undefined) item.validity = validity;
    out.push(item);
  }
  return out;
}

async function fetchAvwxNotamPayload(
  stationIcao: string,
  apiKey: string
): Promise<{ ok: true; payload: unknown } | { ok: false }> {
  const url = `${AVWX_NOTAM_BASE}/${encodeURIComponent(stationIcao)}`;
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
    });

    if (!res.ok) {
      let providerMessage: string | undefined;
      try {
        const errBody = (await res.json()) as unknown;
        providerMessage = extractProviderErrorMessage(errBody);
      } catch {
        /* non-JSON error body */
      }
      logAvwxNotamFailureDiagnostic({
        stationIcao,
        httpStatus: res.status,
        providerMessage,
        errorKind: "http",
      });
      return { ok: false };
    }

    let payload: unknown;
    try {
      payload = (await res.json()) as unknown;
    } catch {
      logAvwxNotamFailureDiagnostic({
        stationIcao,
        errorKind: "parse_response",
        providerMessage: "Response JSON parse failed",
      });
      return { ok: false };
    }
    return { ok: true, payload };
  } catch (err) {
    const isAbort =
      typeof err === "object" &&
      err !== null &&
      "name" in err &&
      (err as { name?: string }).name === "AbortError";
    logAvwxNotamFailureDiagnostic({
      stationIcao,
      errorKind: isAbort ? "timeout" : "network",
    });
    return { ok: false };
  } finally {
    clearTimeout(t);
  }
}

async function fetchParsedAvwxNotamsForStation(
  stationIcao: string,
  apiKey: string
): Promise<{ ok: true; items: OperationalNotamItem[]; fetchedAt: string } | { ok: false }> {
  const res = await fetchAvwxNotamPayload(stationIcao, apiKey);
  if (!res.ok) {
    return { ok: false };
  }
  const fetchedAt = new Date().toISOString();
  const items = buildItemsForStation(stationIcao, extractNotamArray(res.payload));
  return { ok: true, items, fetchedAt };
}

/**
 * Parses NOTAM items for one station with `unstable_cache` keyed only by ICAO (+ fixed version string).
 */
async function getCachedParsedAvwxNotamsForStation(
  stationIcao: string,
  apiKey: string
): Promise<{ ok: true; items: OperationalNotamItem[]; fetchedAt: string } | { ok: false }> {
  const icao = stationIcao.trim().toUpperCase();
  const fetcher = unstable_cache(
    async () => fetchParsedAvwxNotamsForStation(icao, apiKey),
    ["weather-brief", "avwx-notams-station-v1", icao],
    {
      revalidate: AVWX_NOTAM_CACHE_REVALIDATE_SECONDS,
      tags: [avwxNotamStationTag(icao)],
    }
  );
  return fetcher();
}

/**
 * Fetches AVWX NOTAMs for departure and arrival (parallel). Never throws.
 */
export async function fetchAvwxOperationalNotamsBrief(
  departureIcao: string,
  arrivalIcao: string
): Promise<OperationalNotamsBriefResult> {
  const apiKey = process.env.AVWX_API_KEY?.trim();
  if (!apiKey) {
    return {
      availability: "unavailable",
      reason: "provider_error",
      departure: { stationIcao: departureIcao.trim().toUpperCase(), items: [] },
      arrival: { stationIcao: arrivalIcao.trim().toUpperCase(), items: [] },
      fetchedAt: new Date().toISOString(),
    };
  }

  const dep = departureIcao.trim().toUpperCase();
  const arr = arrivalIcao.trim().toUpperCase();
  const fetchedAt = new Date().toISOString();

  try {
    if (!dep || !arr) {
      return {
        availability: "unavailable",
        reason: "provider_error",
        departure: { stationIcao: dep, items: [] },
        arrival: { stationIcao: arr, items: [] },
        fetchedAt,
      };
    }

    if (dep === arr) {
      const parsed = await getCachedParsedAvwxNotamsForStation(dep, apiKey);
      if (!parsed.ok) {
        return {
          availability: "unavailable",
          reason: "provider_error",
          departure: { stationIcao: dep, items: [] },
          arrival: { stationIcao: arr, items: [] },
          fetchedAt,
        };
      }
      const { items, fetchedAt: stationFetchedAt } = parsed;
      return {
        availability: "ok",
        departure: { stationIcao: dep, items, fetchedAt: stationFetchedAt },
        arrival: { stationIcao: arr, items: [...items], fetchedAt: stationFetchedAt },
        fetchedAt,
      };
    }

    const [depParsed, arrParsed] = await Promise.all([
      getCachedParsedAvwxNotamsForStation(dep, apiKey),
      getCachedParsedAvwxNotamsForStation(arr, apiKey),
    ]);

    if (!depParsed.ok || !arrParsed.ok) {
      return {
        availability: "unavailable",
        reason: "provider_error",
        departure: { stationIcao: dep, items: [] },
        arrival: { stationIcao: arr, items: [] },
        fetchedAt,
      };
    }

    return {
      availability: "ok",
      departure: { stationIcao: dep, items: depParsed.items, fetchedAt: depParsed.fetchedAt },
      arrival: { stationIcao: arr, items: arrParsed.items, fetchedAt: arrParsed.fetchedAt },
      fetchedAt,
    };
  } catch {
    logAvwxNotamFailureDiagnostic({
      stationIcao: dep && arr ? `${dep}/${arr}` : dep || arr || "unknown",
      errorKind: "network",
      providerMessage: "Unexpected error in fetchAvwxOperationalNotamsBrief",
    });
    return {
      availability: "unavailable",
      reason: "provider_error",
      departure: { stationIcao: dep, items: [] },
      arrival: { stationIcao: arr, items: [] },
      fetchedAt,
    };
  }
}
