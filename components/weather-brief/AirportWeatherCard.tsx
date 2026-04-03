"use client";

import { useState } from "react";
import { Wind, Gauge, Eye, Thermometer, Cloud } from "lucide-react";
import type { DecodedWeather } from "@/lib/weather-brief/types";
import { resolveStationCode } from "@/lib/weather-brief/resolve-station-code";
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
  /** Block 1: Current conditions */
  decodedCurrent?: DecodedWeather | null;
  operationalNoteCurrent?: string | null;
  /** Block 2: Expected near event */
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
  return (s ?? "").trim() || "Not available";
}

const GRID_ICON_CLASS = "shrink-0 text-slate-500";
const GRID_ICON_SIZE = 16;

function WeatherGrid({ decoded }: { decoded: DecodedWeather | null | undefined }) {
  if (!decoded) {
    return (
      <p className="text-base text-slate-500">Not available</p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:gap-x-8 md:gap-y-3">
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-400">
          <Wind className={GRID_ICON_CLASS} size={GRID_ICON_SIZE} />
          Wind
        </p>
        <p className="font-mono text-lg font-semibold text-white">{fallback(decoded.wind)}</p>
      </div>
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-400">
          <Gauge className={GRID_ICON_CLASS} size={GRID_ICON_SIZE} />
          Altimeter
        </p>
        <p className="font-mono text-lg font-semibold text-white">{fallback(decoded.altimeter)}</p>
      </div>
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-400">
          <Eye className={GRID_ICON_CLASS} size={GRID_ICON_SIZE} />
          Visibility
        </p>
        <p className="font-mono text-lg font-semibold text-white">{fallback(decoded.visibility)}</p>
      </div>
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-400">
          <Thermometer className={GRID_ICON_CLASS} size={GRID_ICON_SIZE} />
          Temp/Dew
        </p>
        <p className="font-mono text-lg font-semibold text-white">{fallback(decoded.tempDew)}</p>
      </div>
      <div className="col-span-2 flex flex-col gap-1">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-400">
          <Cloud className={GRID_ICON_CLASS} size={GRID_ICON_SIZE} />
          Sky/Ceiling
        </p>
        <p className="font-mono text-lg font-semibold text-white">{fallback(decoded.skyCeiling)}</p>
      </div>
      <div className="col-span-2 flex flex-col gap-1">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-400">
          <Cloud className={GRID_ICON_CLASS} size={GRID_ICON_SIZE} />
          Weather
        </p>
        <p className="font-mono text-lg font-semibold text-white">{fallback(decoded.weather)}</p>
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
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] md:p-6 lg:p-8">
        {/* Header: context + large ICAO + airport name, category + RAW top right */}
        <div className="flex items-start justify-between gap-4 pt-0">
          <div className="min-w-0">
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-2xl font-bold tracking-tight text-white">
              {context && <span className="capitalize">{context} —</span>}
              <span>{station}</span>
              <span>
                {context && " • "}
                {airportName ?? airport}
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Last updated:{" "}
              <span className="font-semibold">
                {updatedAt ? formatLastImport(updatedAt) : "—"}
              </span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              title="Category from latest METAR when available, else from TAF window below."
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-medium ${catStyle}`}
            >
              {fc}
            </span>
            <button
              type="button"
              onClick={() => setRawOpen(true)}
              className="touch-manipulation inline-flex items-center rounded-full border border-slate-500/40 bg-slate-500/20 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-500/30 active:bg-slate-500/40"
            >
              RAW
            </button>
          </div>
        </div>

        {/* Local / Zulu row */}
        <div className="mt-4 flex gap-8 text-sm text-slate-400">
          <span>Local {fallback(localTimeLabel)}</span>
          <span>Zulu {fallback(zuluTimeLabel)}</span>
        </div>

        {/* Block 1: Current conditions */}
        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Observed now (METAR)
          </p>
          <WeatherGrid decoded={decodedCurrent} />
          {operationalNoteCurrent?.trim() && (
            <p className="mt-2 text-xs text-amber-400/90">{operationalNoteCurrent}</p>
          )}
        </div>

        {/* Block 2: Expected near event */}
        <div className="mt-6 border-t border-white/5 pt-5">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
            At {context === "arrival" ? "arrival" : "departure"} time (TAF)
          </p>
          <p className="mb-2 text-xs text-slate-500">
            {forecastWindowLabel || "Selected TAF period for your scheduled time"} — compare to observed block above.
          </p>
          <WeatherGrid decoded={decodedForecast} />
          {operationalNoteForecast?.trim() && (
            <p className="mt-2 text-xs text-amber-400/90">{operationalNoteForecast}</p>
          )}
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
