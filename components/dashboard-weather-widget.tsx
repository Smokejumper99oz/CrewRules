import Link from "next/link";
import type { HomeBaseMetar } from "@/lib/weather-brief/get-home-base-metar";

type Props = {
  metar: HomeBaseMetar;
  weatherBriefHref: string;
  /** Shown when weather comes from device geolocation (e.g. "Near you"). */
  sourceLabel?: string | null;
};

function formatWind(
  windKt: number | null,
  windDir: number | string | null,
  gustKt: number | null
): string | null {
  if (!windKt || windKt < 4) return null;
  const isVariable = windDir == null || String(windDir).toUpperCase() === "VRB";
  const dir = isVariable ? "Variable" : `${String(windDir).padStart(3, "0")}°`;
  const gust = gustKt && gustKt > windKt ? ` G${gustKt}` : "";
  return `${dir} / ${windKt}${gust} kt`;
}

export function DashboardWeatherWidget({ metar, weatherBriefHref, sourceLabel }: Props) {
  const wind = formatWind(metar.windKt, metar.windDir, metar.gustKt);
  const hasFeelsLike = metar.feelsLikeF != null;

  return (
    <Link
      href={weatherBriefHref}
      className="group w-full sm:shrink-0 sm:min-w-[260px] sm:w-auto flex items-start gap-3 rounded-xl border border-white/5 bg-slate-900/40 px-4 py-2.5 transition hover:border-white/10 hover:bg-slate-900/60"
    >
      {/* Weather emoji */}
      <span className="text-2xl leading-none mt-0.5 shrink-0" aria-hidden>
        {metar.emoji}
      </span>

      {/* Info block */}
      <div className="flex-1 min-w-0">
        {/* Row 1: temp + condition — airport code */}
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2 leading-none">
            {metar.tempF != null && (
              <span className="text-xl font-light text-slate-100 tabular-nums">
                {metar.tempF}°<span className="text-sm text-slate-500">F</span>
                {metar.tempC != null && (
                  <span className="text-sm font-light text-slate-500 tabular-nums">
                    {" "}/{" "}{metar.tempC}°<span className="text-xs">C</span>
                  </span>
                )}
              </span>
            )}
            <span className="text-sm text-slate-300">{metar.condition}</span>
          </div>
          <span className="text-xs font-semibold text-slate-300 shrink-0 tabular-nums">
            {metar.icao}
          </span>
        </div>

        {/* Row 2: feels like + wind — city name */}
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0">
            {hasFeelsLike && (
              <span className="shrink-0">Feels {metar.feelsLikeF}°</span>
            )}
            {hasFeelsLike && wind && (
              <span className="text-slate-700 shrink-0">·</span>
            )}
            {wind && (
              <span className="truncate">💨 {wind}</span>
            )}
          </div>
          {(sourceLabel || metar.locationName) && (
            <span className="text-[11px] text-slate-500 shrink-0 text-right leading-tight group-hover:text-slate-400 transition flex flex-col items-end gap-0.5">
              {sourceLabel ? (
                <span className="text-[10px] text-slate-500">{sourceLabel}</span>
              ) : null}
              {metar.locationName ? <span>{metar.locationName}</span> : null}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
