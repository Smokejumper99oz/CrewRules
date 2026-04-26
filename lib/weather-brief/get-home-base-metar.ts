/**
 * Lightweight METAR fetch for the dashboard consumer weather widget.
 * Returns plain-language, consumer-friendly fields — not aviation jargon.
 * Uses Aviation Weather Center (free, no API key).
 */

import { resolveStationCode } from "./resolve-station-code";

const AWC_BASE = "https://aviationweather.gov/api/data";
const FETCH_OPTS: RequestInit = {
  headers: { "User-Agent": "CrewRules™-WeatherBrief/1.0 (https://crewrules.com)" },
  next: { revalidate: 300 },
};

type MetarRecord = {
  icaoId?: string;
  name?: string;
  temp?: number | null;
  dewp?: number | null;
  wdir?: number | string | null;
  wspd?: number | null;
  wgst?: number | null;
  visib?: number | string | null;
  clouds?: Array<{ cover?: string; base?: number }> | null;
  wxString?: string | null;
  fltCat?: string | null;
  reportTime?: string | null;
};

/** Convert Celsius to Fahrenheit, rounded. */
function toF(c: number): number {
  return Math.round(c * 9 / 5 + 32);
}

/**
 * Wind chill in °F (NWS formula). Only valid when temp ≤ 50°F and wind > 3 mph.
 * AWC wind speed is in knots; 1 kt = 1.15078 mph.
 */
function windChill(tempF: number, windKt: number): number | null {
  if (tempF > 50 || windKt < 3) return null;
  const mph = windKt * 1.15078;
  const wc = 35.74 + 0.6215 * tempF - 35.75 * Math.pow(mph, 0.16) + 0.4275 * tempF * Math.pow(mph, 0.16);
  return Math.round(wc);
}

/** Map METAR wx codes + cloud cover to a single consumer-friendly label and emoji. */
function resolveCondition(
  wxString: string | null | undefined,
  clouds: Array<{ cover?: string; base?: number }> | null | undefined,
  fltCat: string | null | undefined
): { label: string; emoji: string } {
  const wx = (wxString ?? "").toUpperCase();

  if (wx.includes("TS"))          return { label: "Thunderstorms",    emoji: "⛈️"  };
  if (wx.includes("+RA"))         return { label: "Heavy Rain",        emoji: "🌧️"  };
  if (wx.includes("FZRA") || wx.includes("FZDZ"))
                                  return { label: "Freezing Rain",     emoji: "🌨️"  };
  if (wx.includes("RA") || wx.includes("DZ"))
                                  return { label: "Rain",              emoji: "🌧️"  };
  if (wx.includes("SN") || wx.includes("SG") || wx.includes("PL"))
                                  return { label: "Snow",              emoji: "❄️"  };
  if (wx.includes("SHSN"))        return { label: "Snow Showers",      emoji: "🌨️"  };
  if (wx.includes("SHRA"))        return { label: "Rain Showers",      emoji: "🌦️"  };
  if (wx.includes("FG") || wx.includes("MIFG") || wx.includes("BCFG"))
                                  return { label: "Foggy",             emoji: "🌫️"  };
  if (wx.includes("BR"))          return { label: "Mist",              emoji: "🌫️"  };
  if (wx.includes("HZ"))          return { label: "Hazy",              emoji: "🌫️"  };
  if (wx.includes("FU"))          return { label: "Smoky",             emoji: "🌫️"  };

  // Fall back to cloud cover
  const covers = (clouds ?? []).map((c) => (c.cover ?? "").toUpperCase());
  if (covers.some((c) => c === "OVC" || c === "OVX"))
                                  return { label: "Overcast",          emoji: "☁️"  };
  if (covers.some((c) => c === "BKN"))
                                  return { label: "Mostly Cloudy",     emoji: "🌥️"  };
  if (covers.some((c) => c === "SCT"))
                                  return { label: "Partly Cloudy",     emoji: "⛅"  };
  if (covers.some((c) => c === "FEW"))
                                  return { label: "Mostly Clear",      emoji: "🌤️"  };
  if (covers.some((c) => c === "CLR" || c === "CAVOK" || c === "SKC"))
                                  return { label: "Clear",             emoji: "☀️"  };

  // If IFR/LIFR but nothing else matched, likely low vis/ceiling
  const cat = (fltCat ?? "").toUpperCase();
  if (cat === "IFR" || cat === "LIFR") return { label: "Low Visibility", emoji: "🌫️" };

  return { label: "Clear",                                              emoji: "☀️"  };
}

/** Shorten "Denver Intl, CO US" → "Denver, CO" */
function formatLocationName(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return raw
    .replace(/\s*Intl\.?\s*,?/i, ",")
    .replace(/\s*Regional\.?\s*,?/i, ",")
    .replace(/\s*Airport\.?\s*,?/i, ",")
    .replace(/,?\s*USA?\s*$/i, "")
    .replace(/,\s*,/g, ",")
    .trim()
    .replace(/,$/, "")
    .trim();
}

export type HomeBaseMetar = {
  icao: string;
  locationName: string | null;
  tempF: number | null;
  tempC: number | null;
  feelsLikeF: number | null;
  condition: string;
  emoji: string;
  windKt: number | null;
  windDir: number | string | null;
  gustKt: number | null;
};

export async function getHomeBaseMetar(
  airport: string
): Promise<HomeBaseMetar | null> {
  const code = airport?.trim();
  if (!code) return null;

  try {
    const icao = resolveStationCode(code);
    const url = `${AWC_BASE}/metar?ids=${icao}&format=json`;
    const res = await fetch(url, FETCH_OPTS);
    if (!res.ok) return null;

    const text = await res.text();
    if (!text?.trim()) return null;

    const parsed: MetarRecord[] = JSON.parse(text);
    const metar = Array.isArray(parsed) ? parsed[0] : null;
    if (!metar) return null;

    const tempC = metar.temp ?? null;
    const tempF = tempC != null ? toF(tempC) : null;
    const windKt = metar.wspd ?? null;
    const gustKt = metar.wgst ?? null;
    const windDir = metar.wdir ?? null;
    const { label, emoji } = resolveCondition(metar.wxString, metar.clouds, metar.fltCat);

    const feelsLikeF =
      tempF != null && windKt != null
        ? (windChill(tempF, windKt) ?? tempF)
        : tempF;

    return {
      icao,
      locationName: formatLocationName(metar.name),
      tempF,
      tempC: tempC != null ? Math.round(tempC) : null,
      feelsLikeF: feelsLikeF !== tempF ? feelsLikeF : null,
      condition: label,
      emoji,
      windKt,
      windDir,
      gustKt,
    };
  } catch {
    return null;
  }
}
