/**
 * Fetch airport weather from official Aviation Weather Center API.
 * METAR + TAF, decoded into pilot-friendly fields.
 */

import { formatInTimeZone } from "date-fns-tz";
import type { AirportWeather, DecodedWeather } from "./types";
import { lowestOperationalCeilingFt } from "./operational-ceiling";
import { resolveStationCode } from "./resolve-station-code";

const AWC_BASE = "https://aviationweather.gov/api/data";

/** Normalize airport names: use period after Intl/Regl/Rgnl, not comma; use USA not US */
function normalizeAirportName(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  return name
    .trim()
    .replace(/\b(Intl|Regl|Rgnl)\s*,\s*/g, "$1. ")
    .replace(/, US\b/g, ", USA");
}
const FETCH_OPTS: RequestInit = {
  headers: { "User-Agent": "CrewRules™-WeatherBrief/1.0 (https://crewrules.com)" },
  next: { revalidate: 300 },
};

async function safeParseJson<T>(res: Response, fallback: T): Promise<T> {
  if (!res.ok) return fallback;
  const text = await res.text();
  if (!text?.trim()) return fallback;
  try {
    const parsed = JSON.parse(text);
    return (Array.isArray(parsed) ? parsed : parsed ? [parsed] : []) as T;
  } catch {
    return fallback;
  }
}

type MetarRecord = {
  icaoId?: string;
  name?: string;
  reportTime?: string;
  temp?: number;
  dewp?: number;
  wdir?: number;
  wspd?: number;
  wgst?: number;
  visib?: number | string | null;
  altim?: number;
  clouds?: Array<{ cover?: string; base?: number }>;
  rawOb?: string;
  wxString?: string;
  fltCat?: string;
};

type TafForecastPeriod = {
  timeFrom?: number;
  timeTo?: number;
  changeInd?: string;
  wdir?: number | string;
  wspd?: number;
  wgust?: number;
  visib?: number | string | null;
  clouds?: Array<{ cover?: string; base?: number }>;
  altim?: number | null;
  rawLine?: string;
  wxString?: string;
};

/** METAR/TAF present weather code → pilot-friendly plain language */
const WX_CODE_MAP: Record<string, string> = {
  "-RA": "Light Rain",
  RA: "Moderate Rain",
  "+RA": "Heavy Rain",
  "-SN": "Light Snow",
  SN: "Moderate Snow",
  "+SN": "Heavy Snow",
  "-DZ": "Light Drizzle",
  DZ: "Drizzle",
  "+DZ": "Heavy Drizzle",
  FZDZ: "Freezing Drizzle",
  FZRA: "Freezing Rain",
  GS: "Small Hail",
  GR: "Hail",
  PL: "Ice Pellets",
  SG: "Snow Grains",
  IC: "Ice Crystals",
  "-SHRA": "Light Rain Showers",
  SHRA: "Rain Showers",
  "+SHRA": "Heavy Rain Showers",
  "-SHSN": "Light Snow Showers",
  SHSN: "Snow Showers",
  "+SHSN": "Heavy Snow Showers",
  "-SHGR": "Light Hail Showers",
  SHGR: "Hail Showers",
  "+SHGR": "Heavy Hail Showers",
  "-TSRA": "Light Thunderstorm with Rain",
  TSRA: "Thunderstorm with Rain",
  "+TSRA": "Heavy Thunderstorm with Rain",
  "-TS": "Light Thunderstorm",
  TS: "Thunderstorm",
  "+TS": "Heavy Thunderstorm",
  VCTS: "Thunderstorm in Vicinity",
  VCSH: "Showers in Vicinity",
  VCFG: "Fog in Vicinity",
  VCFC: "Funnel Cloud in Vicinity",
  VCPO: "Dust/Sand Whirls in Vicinity",
  VCBLDU: "Blowing Dust in Vicinity",
  VCBLSA: "Blowing Sand in Vicinity",
  VCBLSN: "Blowing Snow in Vicinity",
  VCVA: "Volcanic Ash in Vicinity",
  VCDS: "Duststorm in Vicinity",
  VCSS: "Sandstorm in Vicinity",
  RASN: "Rain and Snow",
  SNRA: "Snow and Rain",
  UP: "Unknown Precipitation",
  BR: "Mist",
  FG: "Fog",
  HZ: "Haze",
  FU: "Smoke",
  VA: "Volcanic Ash",
  DU: "Widespread Dust",
  SA: "Sand",
  DS: "Duststorm",
  SS: "Sandstorm",
  PO: "Dust/Sand Whirls",
  SQ: "Squalls",
  FC: "Funnel Cloud",
  PY: "Spray",
  MI: "Shallow",
  PR: "Partial",
  BC: "Patches",
  DR: "Low Drifting",
  BL: "Blowing",
  MIFG: "Shallow Fog",
  BCFG: "Patches of Fog",
  PRFG: "Partial Fog",
  BLDU: "Blowing Dust",
  BLSA: "Blowing Sand",
  BLSN: "Blowing Snow",
};

/** Cloud cover code → plain language, for decoded Sky/Ceiling. */
const COVER_MAP: Record<string, string> = {
  FEW: "Few",
  SCT: "Scattered",
  BKN: "Broken",
  OVC: "Overcast",
  CLR: "Clear",
  CAVOK: "Ceiling and Visibility OK",
  OVX: "Obscured",
};

function formatCloudLayer(cover: string | undefined, base: number | undefined): string {
  const c = (cover ?? "").trim().toUpperCase();
  const plain = COVER_MAP[c] ?? c;
  if (base != null) {
    const formatted = base.toLocaleString();
    return `${plain} ${formatted} ft`;
  }
  return plain;
}

function formatSkyCeiling(clouds: Array<{ cover?: string; base?: number }>): string {
  if (!clouds.length) return "Clear";
  return clouds.map((c) => formatCloudLayer(c.cover, c.base)).join(", ");
}

/** Decode visibility to pilot-friendly string. AWC visib: number | "10+" | null. */
function decodeVisibility(visib: number | string | null | undefined): string {
  if (visib == null) return "Not available";
  if (typeof visib === "string") {
    const s = visib.trim();
    if (!s || /^\/+$/.test(s)) return "Not available";
    if (/^10\+?$/i.test(s)) return "10+ SM";
    return `${s} SM`;
  }
  const n = Number(visib);
  if (Number.isNaN(n) || n < 0) return "Not available";
  if (n >= 10) return "10+ SM";
  if (n === 0.25) return "1/4 SM";
  if (n === 0.5) return "1/2 SM";
  if (n === 0.75) return "3/4 SM";
  const int = Math.floor(n);
  const frac = n - int;
  if (frac < 0.01) return `${int} SM`;
  if (Math.abs(frac - 0.25) < 0.01) return int ? `${int} 1/4 SM` : "1/4 SM";
  if (Math.abs(frac - 0.5) < 0.01) return int ? `${int} 1/2 SM` : "1/2 SM";
  if (Math.abs(frac - 0.75) < 0.01) return int ? `${int} 3/4 SM` : "3/4 SM";
  return `${n} SM`;
}

/** Extract present weather groups from raw METAR/TAF for fallback when wxString is empty. */
function extractWxFromRaw(raw: string): string[] {
  if (!raw?.trim()) return [];
  const tokens = raw.split(/\s+/);
  const found: string[] = [];
  for (const t of tokens) {
    const upper = t.toUpperCase();
    if (WX_CODE_MAP[upper]) found.push(upper);
  }
  return [...new Set(found)];
}

function decodePresentWeather(wxString: string | undefined, rawOb: string | undefined): string {
  const wx = (wxString ?? "").trim();
  const raw = (rawOb ?? "").trim();
  const groups = wx ? wx.split(/\s+/) : extractWxFromRaw(raw);
  if (groups.length === 0) return "None";

  const decoded: string[] = [];
  for (const code of groups) {
    const upper = code.toUpperCase();
    const plain = WX_CODE_MAP[upper];
    if (plain) {
      decoded.push(plain);
    }
  }
  if (decoded.length === 0) return "None";
  return decoded.join(", ");
}

type TafRecord = {
  icaoId?: string;
  bulletinTime?: string;
  validTimeFrom?: string;
  validTimeTo?: string;
  rawTAF?: string;
  fcsts?: TafForecastPeriod[];
};

function decodeMetarToWeather(metar: MetarRecord | null): DecodedWeather | null {
  if (!metar) return null;
  const wspd = metar.wspd ?? 0;
  const wdir = metar.wdir;
  const wgst = metar.wgst;
  const isVariable = wdir == null || String(wdir).toUpperCase() === "VRB";
  const wdir3 = typeof wdir === "number" ? String(wdir).padStart(3, "0") : String(wdir ?? "");
  const wind =
    wspd === 0
      ? "Calm"
      : isVariable
        ? `VRB at ${wspd} knots`
        : wgst != null && wgst > 0
          ? `${wdir3}° at ${wspd} knots Gusting ${wgst} knots`
          : `${wdir3}° at ${wspd} knots`;
  const visib = decodeVisibility(metar.visib);
  const clouds = metar.clouds ?? [];
  const skyCeiling = formatSkyCeiling(clouds);
  const operationalCeilingFt = lowestOperationalCeilingFt(clouds);
  const altimeter =
    metar.altim != null ? `${(metar.altim / 33.8639).toFixed(2)} inHg` : "—";
  const temp = metar.temp != null ? Math.round(metar.temp) : null;
  const dewp = metar.dewp != null ? Math.round(metar.dewp) : null;
  const tempDew = temp != null && dewp != null ? `${temp}°C / ${dewp}°C` : "—";
  const fc = (metar.fltCat ?? "UNKNOWN").toUpperCase();
  const flightCategory =
    fc === "VFR" || fc === "MVFR" || fc === "IFR" || fc === "LIFR" ? fc : "UNKNOWN";
  const weather = decodePresentWeather(metar.wxString, metar.rawOb);

  return {
    wind,
    visibility: visib,
    skyCeiling: skyCeiling || "—",
    altimeter,
    tempDew,
    weather,
    flightCategory: flightCategory as DecodedWeather["flightCategory"],
    operationalCeilingFt,
  };
}

function decodeTafPeriodToWeather(
  period: TafForecastPeriod | undefined,
  rawLine?: string
): DecodedWeather | null {
  if (!period) return null;
  const wdir = period.wdir ?? 0;
  const wdir3 = typeof wdir === "number" ? String(wdir).padStart(3, "0") : String(wdir ?? "");
  const wspeed = period.wspd ?? 0;
  const wgust = period.wgust;
  const wind = wspeed > 0
    ? `${wdir3}° at ${wspeed}${wgust ? `G${wgust}` : ""} kt`
    : "Calm";
  const visib = decodeVisibility(period.visib);
  const clouds = period.clouds ?? [];
  const skyCeiling = formatSkyCeiling(clouds);
  const operationalCeilingFt = lowestOperationalCeilingFt(clouds);
  const altimeter =
    period.altim != null ? `${(period.altim / 33.8639).toFixed(2)} inHg` : "—";
  const tempDew = "—";
  const raw = rawLine ?? "";
  const fc = /(VFR|MVFR|IFR|LIFR)/i.exec(raw)?.[1]?.toUpperCase() ?? "UNKNOWN";
  const flightCategory =
    fc === "VFR" || fc === "MVFR" || fc === "IFR" || fc === "LIFR" ? fc : "UNKNOWN";
  const weatherDecoded = decodePresentWeather(period.wxString, raw);
  const weather = weatherDecoded && weatherDecoded !== "None" ? weatherDecoded : "None";

  return {
    wind,
    visibility: visib,
    skyCeiling: skyCeiling || "—",
    altimeter,
    tempDew,
    weather,
    flightCategory: flightCategory as DecodedWeather["flightCategory"],
    operationalCeilingFt,
  };
}

/** Find TAF period whose validity window best contains the target time.
 * Aviation-correct behavior:
 * 1. If target is within a period (from ≤ target < to) → select that period.
 * 2. If target is after the last TAF period → select the last period.
 * 3. If target is before the first TAF period → select the first period.
 * 4. Otherwise (e.g. target in gap between periods) → use midpoint comparison.
 */
function pickTafPeriodForTime(
  forecast: TafForecastPeriod[] | undefined,
  targetIso: string,
  timezone: string,
  labelType: "departure" | "arrival"
): { period: TafForecastPeriod; label: string } | null {
  if (!forecast?.length) return null;
  const target = new Date(targetIso).getTime();

  const toMs = (val: number | string | undefined | null): number =>
    val != null
      ? typeof val === "number"
        ? val * 1000
        : new Date(val).getTime()
      : 0;

  const buildLabel = (p: TafForecastPeriod) => {
    const fromDate = p.timeFrom != null ? (typeof p.timeFrom === "number" ? new Date(p.timeFrom * 1000) : new Date(p.timeFrom)) : null;
    const toDate = p.timeTo != null ? (typeof p.timeTo === "number" ? new Date(p.timeTo * 1000) : new Date(p.timeTo)) : null;
    const fromLocal = fromDate ? formatInTimeZone(fromDate, timezone, "HH:mm") : "";
    const toLocal = toDate ? formatInTimeZone(toDate, timezone, "HH:mm") : "";
    const timeWindow = fromLocal && toLocal ? `(${fromLocal}–${toLocal})` : "";
    return labelType === "arrival"
      ? `Forecast near arrival time${timeWindow ? ` ${timeWindow}` : ""}`
      : `Forecast near departure time${timeWindow ? ` ${timeWindow}` : ""}`;
  };

  const first = forecast[0];
  const last = forecast[forecast.length - 1];
  const firstFrom = toMs(first.timeFrom);
  const lastTo = toMs(last.timeTo);

  // 1. Target within a period → select that period
  for (const p of forecast) {
    const from = toMs(p.timeFrom);
    const to = toMs(p.timeTo);
    if (from <= target && target < to) {
      return { period: p, label: buildLabel(p) };
    }
  }

  // 2. Target after last period → select last period
  if (target >= lastTo) {
    return { period: last, label: buildLabel(last) };
  }

  // 3. Target before first period → select first period
  if (target < firstFrom) {
    return { period: first, label: buildLabel(first) };
  }

  // 4. Target in gap between periods → use midpoint comparison
  let best: { period: TafForecastPeriod; label: string; diff: number } | null = null;
  for (const p of forecast) {
    const from = toMs(p.timeFrom);
    const to = toMs(p.timeTo);
    const mid = (from + to) / 2;
    const diff = Math.abs(target - mid);
    const label = buildLabel(p);
    if (!best || diff < best.diff) best = { period: p, label, diff };
  }
  return best ? { period: best.period, label: best.label } : null;
}

export async function getAirportWeather(
  icao: string,
  timezone: string,
  options?: {
    departureIso?: string;
    arrivalIso?: string | null;
    label?: "departure" | "arrival";
  }
): Promise<AirportWeather> {
  const ids = resolveStationCode(icao);
  const metarUrl = `${AWC_BASE}/metar?ids=${ids}&format=json`;
  const tafUrl = `${AWC_BASE}/taf?ids=${ids}&format=json`;

  const [metarRes, tafRes] = await Promise.all([
    fetch(metarUrl, FETCH_OPTS),
    fetch(tafUrl, FETCH_OPTS),
  ]);

  const metarData = await safeParseJson<MetarRecord[]>(metarRes, []);
  const tafData = await safeParseJson<TafRecord[]>(tafRes, []);

  const metar = Array.isArray(metarData) ? metarData[0] : null;
  const taf = Array.isArray(tafData) ? tafData[0] : null;

  const decodedCurrent = decodeMetarToWeather(metar);
  const metarRaw = metar?.rawOb ?? null;
  const tafRaw = taf?.rawTAF ?? null;

  const targetIso =
    options?.label === "arrival" && options?.arrivalIso
      ? options.arrivalIso
      : options?.label === "departure" && options?.departureIso
        ? options.departureIso
        : null;

  const fcsts = taf?.fcsts ?? [];
  const tafPick = targetIso
    ? pickTafPeriodForTime(
        fcsts,
        targetIso,
        timezone,
        options?.label ?? "departure"
      )
    : null;

  const label = options?.label ?? "departure";
  const periodsForLog = fcsts.map((p, i) => {
    const fromMs = p.timeFrom != null ? (typeof p.timeFrom === "number" ? p.timeFrom * 1000 : new Date(p.timeFrom).getTime()) : null;
    const toMs = p.timeTo != null ? (typeof p.timeTo === "number" ? p.timeTo * 1000 : new Date(p.timeTo).getTime()) : null;
    return {
      i,
      timeFrom: p.timeFrom,
      timeTo: p.timeTo,
      fromUtc: fromMs != null ? new Date(fromMs).toISOString() : null,
      toUtc: toMs != null ? new Date(toMs).toISOString() : null,
    };
  });
  console.log("[getAirportWeather]", label, ids, {
    "options.label": options?.label,
    "options.departureIso": options?.departureIso,
    "options.arrivalIso": options?.arrivalIso,
    targetIso,
    periodCount: fcsts.length,
    periods: periodsForLog,
    selected: tafPick
      ? {
          timeFrom: tafPick.period.timeFrom,
          timeTo: tafPick.period.timeTo,
          label: tafPick.label,
        }
      : null,
  });
  let decodedForecast = tafPick ? decodeTafPeriodToWeather(tafPick.period, tafPick.period.rawLine) : null;
  if (decodedForecast) {
    if (decodedForecast.altimeter === "—") {
      decodedForecast = { ...decodedForecast, altimeter: "Not in TAF" };
    }
    if (decodedForecast.tempDew === "—") {
      decodedForecast = { ...decodedForecast, tempDew: "Not in TAF" };
    }
  }
  const forecastWindowLabel = tafPick?.label ?? null;

  const now = new Date();
  const localTimeLabel = formatInTimeZone(now, timezone, "HH:mm zzz");
  const zuluTimeLabel = formatInTimeZone(now, "UTC", "HH:mm 'Z'");
  const updatedAt = metar?.reportTime ?? now.toISOString();

  const baseUrl = "https://aviationweather.gov";
  return {
    airport: ids,
    airportName: normalizeAirportName(metar?.name) || null,
    localTimeLabel,
    zuluTimeLabel,
    updatedAt,
    metarRaw,
    tafRaw,
    decodedCurrent: decodedCurrent ?? undefined,
    decodedForecast: decodedForecast ?? undefined,
    forecastWindowLabel: forecastWindowLabel ?? undefined,
    tafSelectedPeriodRawLine: tafPick?.period.rawLine ?? null,
    tafSelectedPeriodWxString: tafPick?.period.wxString ?? null,
    sourceLinks: {
      metarTaf: `${baseUrl}/metar?ids=${ids}`,
      airportStatus: "https://nasstatus.faa.gov",
      notams: "https://notams.aim.faa.gov",
    },
  };
}
