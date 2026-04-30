import type { EnrouteFlightCategory, EnrouteStationMetarSummary } from "./types";

const CEILING_CODES = new Set(["BKN", "OVC", "VV"]);
const DASH = "—";

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** AVWX responses often nest the report under `data`. */
function unwrapAvwxReport(payload: unknown): Record<string, unknown> | null {
  if (!isPlainObject(payload)) return null;
  if (isPlainObject(payload.data)) return payload.data;
  return payload;
}

function readStringish(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (isPlainObject(v)) {
    const dt = v.dt;
    if (typeof dt === "string" && dt.trim()) return dt.trim();
    const repr = v.repr;
    if (typeof repr === "string" && repr.trim()) return repr.trim();
    const value = v.value;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function normalizeFlightRules(raw: string | undefined): EnrouteFlightCategory {
  if (!raw) return "UNKNOWN";
  const u = raw.trim().toUpperCase();
  if (u === "LIFR") return "IFR";
  if (u === "VFR" || u === "MVFR" || u === "IFR") return u;
  return "UNKNOWN";
}

/** Observation timestamps only: ISO/`dt`/numeric — never repr or other raw METAR time text. */
function dateLikeToIsoUtc(v: unknown): string | null {
  if (v == null) return null;
  let d: Date | undefined;
  if (typeof v === "number" && Number.isFinite(v)) {
    d = new Date(v);
  } else if (typeof v === "string" && v.trim()) {
    d = new Date(v.trim());
  } else if (isPlainObject(v)) {
    const dt = v.dt;
    if (typeof dt === "number" && Number.isFinite(dt)) d = new Date(dt);
    else if (typeof dt === "string" && dt.trim()) d = new Date(dt.trim());
  }
  if (!d || isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseObservationTime(data: Record<string, unknown>): string | null {
  const fields = [data.observation_time, data.obs_time, data.time, data.report_time] as const;
  for (const f of fields) {
    const iso = dateLikeToIsoUtc(f);
    if (iso) return iso;
  }
  return null;
}

/** Lowest BKN/OVC/VV layer; returns label like BKN015 or null. */
function ceilingFromStructuredClouds(clouds: unknown): string | null {
  if (!Array.isArray(clouds) || clouds.length === 0) return null;
  let best: { code: string; ft: number; repr: string | null } | null = null;

  for (const c of clouds) {
    if (!isPlainObject(c)) continue;
    const reprFull = typeof c.repr === "string" ? c.repr.trim().toUpperCase() : "";
    /** Operational ceiling only — FEW/SCT are not ceiling layers. */
    if (/^(FEW|SCT)\d{3}$/.test(reprFull)) continue;

    const codeFieldEarly = (c.code ?? c.cover ?? "")
      .toString()
      .trim()
      .toUpperCase();
    if (codeFieldEarly === "FEW" || codeFieldEarly === "SCT") continue;

    const m = reprFull.match(/^(BKN|OVC|VV)(\d{3})$/);
    if (m) {
      const code = m[1];
      const ft = parseInt(m[2], 10) * 100;
      if (CEILING_CODES.has(code) && (!best || ft < best.ft)) {
        best = { code, ft, repr: reprFull };
      }
      continue;
    }

    const codeField = (c.code ?? c.cover ?? c.type ?? "")
      .toString()
      .trim()
      .toUpperCase();
    let code: string | null = null;
    if (codeField.length === 3 && CEILING_CODES.has(codeField)) code = codeField;
    else if (codeField.includes("BKN") || codeField === "BROKEN") code = "BKN";
    else if (codeField.includes("OVC") || codeField === "OVERCAST") code = "OVC";
    else if (codeField.includes("VV") || codeField === "VERTICAL") code = "VV";
    if (!code || !CEILING_CODES.has(code)) continue;

    const ftRaw = c.feet ?? c.altitude ?? c.base ?? c.height;
    const ft =
      typeof ftRaw === "number" && Number.isFinite(ftRaw) && ftRaw >= 0
        ? Math.round(ftRaw)
        : null;
    if (ft == null) continue;
    if (!best || ft < best.ft) best = { code, ft, repr: reprFull || null };
  }

  if (!best) return null;
  if (best.repr && /^(BKN|OVC|VV)\d{3}$/.test(best.repr)) return best.repr;
  const hundreds = Math.round(best.ft / 100);
  const suffix = String(Math.min(999, Math.max(0, hundreds))).padStart(3, "0");
  return `${best.code}${suffix}`;
}

function ceilingFromRawLine(raw: string): string | null {
  const u = raw.toUpperCase();
  let best: { code: string; ft: number; label: string } | null = null;
  const re = /\b(BKN|OVC|VV)(\d{3})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(u)) !== null) {
    const code = m[1] as "BKN" | "OVC" | "VV";
    const hundreds = parseInt(m[2], 10);
    const ft = hundreds * 100;
    if (!CEILING_CODES.has(code)) continue;
    const label = `${code}${m[2]}`;
    if (!best || ft < best.ft) best = { code, ft, label };
  }
  return best?.label ?? null;
}

/** Pilot-friendly statute miles (no raw METAR tokens like 10SM / P6SM). */
function formatStatuteMilesLabel(sm: number): string {
  if (!Number.isFinite(sm) || sm < 0) return DASH;
  if (sm >= 10) return "10+ SM";

  const near = (a: number, b: number) => Math.abs(a - b) < 0.021;
  if (near(sm, 0.25)) return "1/4 SM";
  if (near(sm, 0.5)) return "1/2 SM";
  if (near(sm, 0.75)) return "3/4 SM";

  const r = Math.round(sm * 100) / 100;
  if (Number.isInteger(r) && r >= 1 && r <= 9) return `${r} SM`;

  const whole = Math.floor(sm);
  if (whole >= 1 && near(sm - whole, 0.5)) return `${whole} 1/2 SM`;

  return `${r} SM`;
}

function formatPlusStatuteMiles(n: number): string {
  if (!Number.isFinite(n) || n < 0) return DASH;
  const q = Math.round(n * 100) / 100;
  const qStr = Number.isInteger(q) ? String(q) : String(q).replace(/\.?0+$/, "");
  return `${qStr}+ SM`;
}

/** Single-token visibility (e.g. AVWX `visibility.repr`). */
function pilotVisibilityFromMetarToken(s: string): string | null {
  const t = s.trim().toUpperCase();
  if (!t) return null;
  if (t === "9999" || t === "9999M") return "10+ SM";

  const mP = t.match(/^P(\d+(?:\.\d+)?)SM$/);
  if (mP) {
    const n = parseFloat(mP[1]);
    return Number.isFinite(n) ? formatPlusStatuteMiles(n) : null;
  }

  const mFrac = t.match(/^M?(\d+)\/(\d+)SM$/);
  if (mFrac) {
    const a = parseInt(mFrac[1], 10);
    const b = parseInt(mFrac[2], 10);
    if (b > 0) return formatStatuteMilesLabel(a / b);
  }

  const m3 = t.match(/^(\d+)\s+(\d+)\/(\d+)SM$/);
  if (m3) {
    const whole = parseInt(m3[1], 10);
    const num = parseInt(m3[2], 10);
    const den = parseInt(m3[3], 10);
    if (den > 0) return formatStatuteMilesLabel(whole + num / den);
  }

  const mInt = t.match(/^(\d+(?:\.\d+)?)SM$/);
  if (mInt) {
    const n = parseFloat(mInt[1]);
    if (!Number.isFinite(n)) return null;
    if (n >= 10) return "10+ SM";
    return formatStatuteMilesLabel(n);
  }

  return null;
}

/** METAR line / fragment: P6SM, 9999, fractions, N SM — not raw token form in output. */
function pilotVisibilityFromRawMetar(raw: string): string | null {
  const u = raw.toUpperCase();

  const p = u.match(/\bP(\d+(?:\.\d+)?)SM\b/);
  if (p) {
    const n = parseFloat(p[1]);
    return Number.isFinite(n) ? formatPlusStatuteMiles(n) : null;
  }

  if (/\b9999\b/.test(u)) return "10+ SM";

  const mFrac = u.match(/\bM?(\d+)\/(\d+)SM\b/);
  if (mFrac) {
    const a = parseInt(mFrac[1], 10);
    const b = parseInt(mFrac[2], 10);
    if (b > 0) return formatStatuteMilesLabel(a / b);
  }

  const m3 = u.match(/\b(\d+)\s+(\d+)\/(\d+)SM\b/);
  if (m3) {
    const whole = parseInt(m3[1], 10);
    const num = parseInt(m3[2], 10);
    const den = parseInt(m3[3], 10);
    if (den > 0) return formatStatuteMilesLabel(whole + num / den);
  }

  const mInt = u.match(/\b(\d+(?:\.\d+)?)SM\b/);
  if (mInt) {
    const n = parseFloat(mInt[1]);
    if (!Number.isFinite(n)) return null;
    if (n >= 10) return "10+ SM";
    return formatStatuteMilesLabel(n);
  }

  return null;
}

/** Statute miles from raw fragment, or null (for category derivation). */
function prevailingVisSmFromRaw(raw: string): number | null {
  const u = raw.toUpperCase();
  if (/\bCAVOK\b/.test(u)) return 10;

  const mP = u.match(/\bP(\d+(?:\.\d+)?)SM\b/);
  if (mP) {
    const n = parseFloat(mP[1]);
    if (Number.isFinite(n)) return Math.max(n, 10);
  }

  const mFrac = u.match(/\bM?(\d+)\/(\d+)SM\b/);
  if (mFrac) {
    const a = parseInt(mFrac[1], 10);
    const b = parseInt(mFrac[2], 10);
    if (b > 0) return a / b;
  }

  const m3 = u.match(/\b(\d+)\s+(\d+)\/(\d+)SM\b/);
  if (m3) {
    const whole = parseInt(m3[1], 10);
    const num = parseInt(m3[2], 10);
    const den = parseInt(m3[3], 10);
    if (den > 0) return whole + num / den;
  }

  const mInt = u.match(/\b(\d+(?:\.\d+)?)SM\b/);
  if (mInt) return parseFloat(mInt[1]);

  /** EU-style prevailing visibility in meters (10 km+). */
  if (/\b9999\b/.test(u)) return 10;

  return null;
}

function formatVisibilityLabel(data: Record<string, unknown>, raw: string): string {
  const vis = data.visibility;
  if (isPlainObject(vis)) {
    const repr = typeof vis.repr === "string" ? vis.repr.trim() : "";
    if (repr) {
      const fromToken = pilotVisibilityFromMetarToken(repr) ?? pilotVisibilityFromRawMetar(repr);
      if (fromToken) return fromToken;
    }
    const miles =
      typeof vis.miles === "number" && Number.isFinite(vis.miles)
        ? vis.miles
        : typeof vis.statute_miles === "number" && Number.isFinite(vis.statute_miles)
          ? vis.statute_miles
          : null;
    if (miles != null) {
      if (miles >= 10) return "10+ SM";
      return formatStatuteMilesLabel(miles);
    }
    const text = typeof vis.text === "string" ? vis.text.trim() : "";
    if (text) {
      const fromText = pilotVisibilityFromMetarToken(text) ?? pilotVisibilityFromRawMetar(text);
      if (fromText) return fromText;
      return text;
    }
  }

  const u = raw.toUpperCase();
  if (/\bCAVOK\b/.test(u)) return "CAVOK";

  const fromRaw = pilotVisibilityFromRawMetar(raw);
  if (fromRaw) return fromRaw;

  const sm = prevailingVisSmFromRaw(raw);
  if (sm != null) return formatStatuteMilesLabel(sm);

  return DASH;
}

function wxTokenFromEntry(entry: unknown): string | null {
  if (typeof entry === "string" && entry.trim()) return entry.trim().toUpperCase();
  if (isPlainObject(entry)) {
    const repr = entry.repr ?? entry.value ?? entry.code;
    if (typeof repr === "string" && repr.trim()) return repr.trim().toUpperCase();
  }
  return null;
}

function wxTokensFromStructured(wxCodes: unknown): string[] {
  if (!Array.isArray(wxCodes)) return [];
  const out: string[] = [];
  for (const w of wxCodes) {
    const t = wxTokenFromEntry(w);
    if (t) out.push(t);
  }
  return out;
}

/** Present-weather-ish tokens from raw (lightweight). */
function wxTokensFromRaw(raw: string): string[] {
  const u = raw.trim().toUpperCase();
  const found = new Set<string>();
  const add = (s: string) => {
    if (s) found.add(s);
  };

  const compounds = [
    "VCTS",
    "VCSH",
    "TSRA",
    "+TSRA",
    "-TSRA",
    "TS",
    "+TS",
    "-TS",
    "SQ",
    "FC",
    "+FC",
    "DS",
    "SS",
    "GR",
    "+GR",
    "GS",
    "RA",
    "-RA",
    "+RA",
    "SN",
    "-SN",
    "+SN",
    "BR",
    "FG",
    "HZ",
    "FU",
    "DU",
    "SA",
    "PL",
    "IC",
    "UP",
  ];
  for (const c of compounds) {
    const re = new RegExp(`(?:^|\\s)${c.replace(/\+/g, "\\+")}(?=\\s|$)`);
    if (re.test(u)) add(c);
  }

  if (/\bCB\b/.test(u)) add("CB");
  if (/\bSHRA\b/.test(u)) add("SHRA");
  if (/\bSHSN\b/.test(u)) add("SHSN");

  return [...found];
}

function buildWxLabel(tokens: string[], maxTokens: number): string {
  const flat: string[] = [];
  for (const t of tokens) {
    for (const p of t.trim().toUpperCase().split(/\s+/)) {
      if (p) flat.push(p);
    }
  }
  const slice = flat.slice(0, maxTokens);
  if (slice.length === 0) return DASH;
  return slice.join(" ");
}

function hasConvectiveInTokens(tokens: string[]): boolean {
  for (const t of tokens) {
    const u = t.toUpperCase();
    if (u === "VCTS" || u === "CB" || u.includes("TS")) return true;
  }
  return false;
}

function hasConvectiveInText(text: string): boolean {
  const u = text.toUpperCase();
  return (
    /\bTS\b/.test(u) ||
    /\bVCTS\b/.test(u) ||
    /\b\+?TSRA\b/.test(u) ||
    /\b-?TSRA\b/.test(u) ||
    /\bCB\b/.test(u)
  );
}

function lowestCeilingFtFromLabel(label: string | null): number | null {
  if (!label) return null;
  const m = label.toUpperCase().match(/^(BKN|OVC|VV)(\d{3})$/);
  if (!m) return null;
  return parseInt(m[2], 10) * 100;
}

function deriveCategoryFromVisAndCeiling(visSm: number | null, ceilingFt: number | null): EnrouteFlightCategory {
  const vis = visSm;
  const ceil = ceilingFt;

  const ifrByVis = vis != null && vis < 3;
  const ifrByCeil = ceil != null && ceil < 1000;
  if (ifrByVis || ifrByCeil) return "IFR";

  const mvfrByVis = vis != null && vis >= 3 && vis < 5;
  const mvfrByCeil = ceil != null && ceil >= 1000 && ceil < 3000;
  if (mvfrByVis || mvfrByCeil) return "MVFR";

  const vfrByVis = vis != null && vis >= 5;
  const vfrByCeil = ceil != null && ceil >= 3000;
  if (vfrByVis && vfrByCeil) return "VFR";
  if (vfrByVis && ceil == null) return "VFR";
  if (vfrByCeil && vis == null) return "VFR";

  return "UNKNOWN";
}

/**
 * Maps an AVWX METAR JSON payload (root or `{ data: { ... } }`) to a pilot-facing summary.
 */
export function mapAvwxMetarToSummary(payload: unknown): EnrouteStationMetarSummary {
  const data = unwrapAvwxReport(payload);
  const raw =
    (data && typeof data.raw === "string" && data.raw.trim() ? data.raw : null) ??
    (data && typeof data.sanitized === "string" && data.sanitized.trim() ? data.sanitized : null) ??
    "";
  const sanitized =
    (data && typeof data.sanitized === "string" && data.sanitized.trim() ? data.sanitized : "") || raw;

  let flightCategory = normalizeFlightRules(readStringish(data?.flight_rules));

  let ceilingLabel = data ? ceilingFromStructuredClouds(data.clouds) : null;
  if (!ceilingLabel && raw) ceilingLabel = ceilingFromRawLine(raw);
  if (!ceilingLabel) ceilingLabel = DASH;

  let visibilityLabel = data ? formatVisibilityLabel(data, raw) : DASH;
  if (visibilityLabel === DASH && raw) visibilityLabel = formatVisibilityLabel({}, raw);

  let wxTokens = data ? wxTokensFromStructured(data.wx_codes) : [];
  if (wxTokens.length === 0 && raw) wxTokens = wxTokensFromRaw(raw);
  const wxLabel = buildWxLabel(wxTokens, 3);
  const hasAnyWx = wxLabel !== DASH;

  let hasConvectiveWx =
    hasConvectiveInTokens(wxTokens) ||
    (raw ? hasConvectiveInText(raw) : false) ||
    (sanitized && sanitized !== raw ? hasConvectiveInText(sanitized) : false);

  const observedAt = data ? parseObservationTime(data) : null;

  if (flightCategory === "UNKNOWN" && (raw || sanitized)) {
    const visSm =
      prevailingVisSmFromRaw(raw) ??
      (sanitized && sanitized !== raw ? prevailingVisSmFromRaw(sanitized) : null);
    let visForCat = visSm;
    if (visForCat == null && /\bCAVOK\b/i.test(raw + sanitized)) visForCat = 10;
    const ceilFt = lowestCeilingFtFromLabel(ceilingLabel === DASH ? null : ceilingLabel);
    flightCategory = deriveCategoryFromVisAndCeiling(visForCat, ceilFt);
  }

  return {
    flightCategory,
    ceilingLabel,
    visibilityLabel,
    wxLabel,
    hasAnyWx,
    hasConvectiveWx,
    observedAt,
  };
}
