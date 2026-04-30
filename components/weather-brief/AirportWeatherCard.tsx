"use client";

import { useState } from "react";
import { Wind, Gauge, Eye, Thermometer, Cloud } from "lucide-react";
import type { DecodedWeather, WeatherBriefProductError } from "@/lib/weather-brief/types";
import { resolveStationCode } from "@/lib/weather-brief/resolve-station-code";
import { formatOutOfServiceForWeatherBriefDisplay } from "@/lib/weather-brief/format-out-of-service-for-weather-brief-display";
import { formatLastImport } from "@/components/schedule-status-chip";
import { RawWeatherModal } from "./RawWeatherModal";

type Props = {
  airport: string;
  context?: "departure" | "arrival";
  airportName?: string | null;
  localTimeLabel?: string | null;
  zuluTimeLabel?: string | null;
  updatedAt?: string | null;
  metarRaw?: string | null;
  tafRaw?: string | null;
  sourceUrl: string;
  /** Observed (METAR): fetch/decode failure messaging */
  metarError?: WeatherBriefProductError | null;
  /** TAF-time block: fetch/decode failure messaging */
  tafError?: WeatherBriefProductError | null;
  decodedCurrent?: DecodedWeather | null;
  operationalNoteCurrent?: string | null;
  decodedForecast?: DecodedWeather | null;
  forecastWindowLabel?: string | null;
  operationalNoteForecast?: string | null;
};

const CATEGORY_STYLES: Record<string, string> = {
  VFR: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  MVFR: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  IFR: "border-red-500/40 bg-[#2a0f14] text-white",
  LIFR: "bg-pink-500/20 text-pink-300 border-pink-500/40",
  UNKNOWN: "bg-slate-500/20 text-slate-300 border-slate-500/40",
};

function fallback(s: string | null | undefined): string {
  const v = (s ?? "").trim() || "Not available";
  if (v === "Not available") return v;
  return formatOutOfServiceForWeatherBriefDisplay(v);
}

function productErrorMessage(err: WeatherBriefProductError | null | undefined): string | null {
  if (!err) return null;
  switch (err.error) {
    case "fetch_failed":
      return "Weather source unreachable";
    case "http_error":
      return "Weather service error";
    case "no_data":
      return "No weather reported";
    default:
      return null;
  }
}

/** TAF one-line summary: only operational segments; omit placeholders and "Not in TAF". */
function tafSummarySegment(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (v === "—") return null;
  if (v === "Not available") return null;
  if (v === "Not in TAF") return null;
  if (v === "None") return null;
  return v;
}

type TafSeverity = "red" | "amber";

function parseVisibilitySm(vis: string): number | null {
  const t = vis.trim();
  if (!t) return null;
  if (/^10\+\s*SM$/i.test(t)) return 10;
  const mPlus = t.match(/^(\d+)\+\s*SM$/i);
  if (mPlus) return Number(mPlus[1]);
  if (/1\/4\s*SM/i.test(t)) return 0.25;
  if (/1\/2\s*SM/i.test(t)) return 0.5;
  if (/3\/4\s*SM/i.test(t)) return 0.75;
  const mixed = t.match(/^(\d+)\s+1\/4\s*SM/i);
  if (mixed) return Number(mixed[1]) + 0.25;
  const mixedHalf = t.match(/^(\d+)\s+1\/2\s*SM/i);
  if (mixedHalf) return Number(mixedHalf[1]) + 0.5;
  const mixedThreeQ = t.match(/^(\d+)\s+3\/4\s*SM/i);
  if (mixedThreeQ) return Number(mixedThreeQ[1]) + 0.75;
  const simple = t.match(/^([\d.]+)\s*SM/i);
  if (simple) return Number(simple[1]);
  return null;
}

function visibilitySegmentSeverity(vis: string): TafSeverity | null {
  const sm = parseVisibilitySm(vis);
  if (sm == null || Number.isNaN(sm)) return null;
  if (sm <= 2) return "red";
  if (sm <= 5) return "amber";
  return null;
}

/** Lowest BKN/OVC/Broken/Overcast (etc.) base in ft, or null. */
function parseOperationalCeilingFt(sky: string): number | null {
  const parts = sky.split(",").map((p) => p.trim()).filter(Boolean);
  let minFt: number | null = null;
  const driving = /\b(BKN|Broken|OVC|Overcast|VV|OVX)\b/i;
  for (const part of parts) {
    if (!driving.test(part)) continue;
    const normalized = part.replace(/,/g, "");
    const m = normalized.match(/(\d{1,3}(?:,\d{3})+|\d+)\s*ft/i);
    if (!m) continue;
    const ft = parseInt(m[1].replace(/,/g, ""), 10);
    if (!Number.isFinite(ft)) continue;
    if (minFt == null || ft < minFt) minFt = ft;
  }
  return minFt;
}

function skySegmentSeverity(sky: string): TafSeverity | null {
  const ft = parseOperationalCeilingFt(sky);
  if (ft == null) return null;
  if (ft <= 1000) return "red";
  if (ft > 1000 && ft <= 3000) return "amber";
  return null;
}

function weatherSegmentSeverity(wx: string): TafSeverity | null {
  const w = wx;
  if (/thunderstorm|TSRA|\bTS\b|VCTS/i.test(w)) return "red";
  if (/rain|shower/i.test(w)) return "amber";
  return null;
}

function segmentSeverity(
  text: string,
  kind: "wind" | "visibility" | "sky" | "weather"
): TafSeverity | null {
  if (kind === "wind") return null;
  if (kind === "visibility") return visibilitySegmentSeverity(text);
  if (kind === "sky") return skySegmentSeverity(text);
  if (kind === "weather") return weatherSegmentSeverity(text);
  return null;
}

function withTafSeverityIcon(text: string, kind: "wind" | "visibility" | "sky" | "weather"): string {
  const sev = segmentSeverity(text, kind);
  if (sev === "red") return `🔴 ${text}`;
  if (sev === "amber") return `🔶 ${text}`;
  return text;
}

function buildTafSummaryLine(decoded: DecodedWeather): string {
  const w = tafSummarySegment(decoded.wind);
  const vis = tafSummarySegment(decoded.visibility);
  const sky = tafSummarySegment(decoded.skyCeiling);
  const wx = tafSummarySegment(decoded.weather);
  const parts: string[] = [];
  if (w) parts.push(withTafSeverityIcon(w, "wind"));
  if (vis) parts.push(withTafSeverityIcon(vis, "visibility"));
  if (sky) parts.push(withTafSeverityIcon(sky, "sky"));
  if (wx) parts.push(withTafSeverityIcon(wx, "weather"));
  return formatOutOfServiceForWeatherBriefDisplay(parts.join(" · "));
}

function TafSummaryRow({
  decoded,
  tafError,
}: {
  decoded: DecodedWeather | null | undefined;
  tafError?: WeatherBriefProductError | null;
}) {
  const errMsg = productErrorMessage(tafError);
  if (errMsg) {
    return <p className="text-sm leading-snug text-slate-500">TAF unavailable</p>;
  }
  if (!decoded) {
    return <p className="text-sm leading-snug text-slate-500">TAF unavailable</p>;
  }
  const line = buildTafSummaryLine(decoded);
  if (!line) {
    return <p className="text-sm leading-snug text-slate-500">TAF unavailable</p>;
  }
  return (
    <p className="break-words font-mono text-sm font-semibold leading-snug text-white">{line}</p>
  );
}

const GRID_ICON_CLASS = "shrink-0 text-slate-500";
const GRID_ICON_SIZE = 14;

function WeatherGrid({
  decoded,
  productError,
}: {
  decoded: DecodedWeather | null | undefined;
  productError?: WeatherBriefProductError | null;
}) {
  const errMsg = productErrorMessage(productError);
  if (errMsg) {
    return <p className="text-sm leading-snug text-slate-500">METAR unavailable</p>;
  }
  if (!decoded) {
    return <p className="text-sm leading-snug text-slate-500">METAR unavailable</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:gap-x-4 sm:gap-y-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          <Wind className={GRID_ICON_CLASS} size={GRID_ICON_SIZE} />
          Wind
        </p>
        <p className="break-words font-mono text-sm font-semibold leading-snug text-white">
          {fallback(decoded.wind)}
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          <Gauge className={GRID_ICON_CLASS} size={GRID_ICON_SIZE} />
          Altimeter
        </p>
        <p className="break-words font-mono text-sm font-semibold leading-snug text-white">
          {fallback(decoded.altimeter)}
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          <Eye className={GRID_ICON_CLASS} size={GRID_ICON_SIZE} />
          Visibility
        </p>
        <p className="break-words font-mono text-sm font-semibold leading-snug text-white">
          {fallback(decoded.visibility)}
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          <Thermometer className={GRID_ICON_CLASS} size={GRID_ICON_SIZE} />
          Temp/Dew
        </p>
        <p className="break-words font-mono text-sm font-semibold leading-snug text-white">
          {fallback(decoded.tempDew)}
        </p>
      </div>
      <div className="col-span-2 flex min-w-0 flex-col gap-0.5">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          <Cloud className={GRID_ICON_CLASS} size={GRID_ICON_SIZE} />
          Sky/Ceiling
        </p>
        <p className="break-words font-mono text-sm font-semibold leading-snug text-white">
          {fallback(decoded.skyCeiling)}
        </p>
      </div>
      <div className="col-span-2 flex min-w-0 flex-col gap-0.5">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
          <Cloud className={GRID_ICON_CLASS} size={GRID_ICON_SIZE} />
          Weather
        </p>
        <p className="break-words font-mono text-sm font-semibold leading-snug text-white">
          {fallback(decoded.weather)}
        </p>
      </div>
    </div>
  );
}

export function AirportWeatherCard({
  airport,
  context,
  airportName,
  localTimeLabel,
  zuluTimeLabel,
  updatedAt,
  metarRaw,
  tafRaw,
  metarError,
  tafError,
  sourceUrl,
  decodedCurrent,
  operationalNoteCurrent,
  decodedForecast,
  forecastWindowLabel,
  operationalNoteForecast,
}: Props) {
  const [rawOpen, setRawOpen] = useState(false);
  const station = resolveStationCode(airport);
  const fc = decodedCurrent?.flightCategory ?? decodedForecast?.flightCategory ?? "UNKNOWN";
  const catStyle = CATEGORY_STYLES[fc] ?? CATEGORY_STYLES.UNKNOWN;

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-lg font-bold leading-tight tracking-tight text-white md:text-xl">
              {context && <span className="capitalize">{context} —</span>}
              <span>{station}</span>
              <span className="text-base font-semibold text-slate-200 md:text-lg">
                {context && " • "}
                {airportName ?? airport}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Last updated:{" "}
              <span className="font-semibold text-slate-400">
                {updatedAt ? formatLastImport(updatedAt) : "—"}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span
              title="Category from latest METAR when available, else from TAF window below."
              className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${catStyle}`}
            >
              {fc}
            </span>
            <button
              type="button"
              onClick={() => setRawOpen(true)}
              className="touch-manipulation inline-flex items-center rounded-full border border-slate-500/40 bg-slate-500/20 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-500/30 active:bg-slate-500/40"
            >
              RAW
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400">
          <span>Local {fallback(localTimeLabel)}</span>
          <span>Zulu {fallback(zuluTimeLabel)}</span>
        </div>

        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Observed now (METAR)
          </p>
          <WeatherGrid decoded={decodedCurrent} productError={metarError} />
          {operationalNoteCurrent?.trim() && (
            <p className="mt-1.5 text-xs leading-snug text-amber-400/90">
              {formatOutOfServiceForWeatherBriefDisplay(operationalNoteCurrent.trim())}
            </p>
          )}
        </div>

        <div className="mt-4">
          <div className="rounded-lg border border-sky-500/15 border-l-[3px] border-l-sky-400/40 bg-slate-950/70 p-2.5 pl-3 shadow-[inset_0_1px_0_0_rgba(56,189,248,0.06)]">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              At {context === "arrival" ? "arrival" : "departure"} time
            </p>
            <p className="mb-1.5 text-[11px] leading-snug text-slate-500">
              {forecastWindowLabel || "Selected TAF period for your scheduled time"} — compare to observed block above.
            </p>
            <TafSummaryRow decoded={decodedForecast} tafError={tafError} />
            {operationalNoteForecast?.trim() && (
              <p className="mt-1.5 text-xs leading-snug text-amber-400/90">
                {formatOutOfServiceForWeatherBriefDisplay(operationalNoteForecast.trim())}
              </p>
            )}
          </div>
        </div>
      </div>
      <RawWeatherModal
        open={rawOpen}
        onClose={() => setRawOpen(false)}
        metarRaw={metarRaw}
        tafRaw={tafRaw}
        airport={airport}
        sourceUrl={sourceUrl}
      />
    </>
  );
}
