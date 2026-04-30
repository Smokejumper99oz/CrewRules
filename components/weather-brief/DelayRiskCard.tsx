import type { DelayRiskLevel } from "@/lib/weather-brief/types";
import { resolveStationCode } from "@/lib/weather-brief/resolve-station-code";
import { formatOutOfServiceForWeatherBriefDisplay } from "@/lib/weather-brief/format-out-of-service-for-weather-brief-display";

type Props = {
  departureAirport?: string | null;
  arrivalAirport?: string | null;
  departureRisk: DelayRiskLevel;
  departureReason: string;
  arrivalRisk: DelayRiskLevel;
  arrivalReason: string;
};

const LEVEL_STYLES: Record<DelayRiskLevel, string> = {
  LOW: "text-emerald-300",
  MODERATE: "text-amber-300",
  HIGH: "text-red-300",
};

export function DelayRiskCard({
  departureAirport,
  arrivalAirport,
  departureRisk,
  departureReason,
  arrivalRisk,
  arrivalReason,
}: Props) {
  const depCode = departureAirport ? resolveStationCode(departureAirport) : null;
  const arrCode = arrivalAirport ? resolveStationCode(arrivalAirport) : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] md:p-6">
      <h3 className="text-lg font-semibold text-white">Delay Risk</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {depCode ? `Departure Airport (${depCode})` : "Departure Airport"}
          </p>
          <p className={`mt-1 font-semibold ${LEVEL_STYLES[departureRisk] ?? LEVEL_STYLES.LOW}`}>
            {departureRisk}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {formatOutOfServiceForWeatherBriefDisplay(departureReason || "Not available")}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {arrCode ? `Arrival Airport (${arrCode})` : "Arrival Airport"}
          </p>
          <p className={`mt-1 font-semibold ${LEVEL_STYLES[arrivalRisk] ?? LEVEL_STYLES.LOW}`}>
            {arrivalRisk}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {formatOutOfServiceForWeatherBriefDisplay(arrivalReason || "Not available")}
          </p>
        </div>
      </div>
    </div>
  );
}
