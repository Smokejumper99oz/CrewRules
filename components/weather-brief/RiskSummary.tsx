import type { DelayRiskLevel } from "@/lib/weather-brief/types";
import { formatOutOfServiceForWeatherBriefDisplay } from "@/lib/weather-brief/format-out-of-service-for-weather-brief-display";

const NO_IMPACT = "No significant weather-related operational impacts identified.";
const ADVISORIES_FALLBACK = "Enroute aviation weather advisories present";

type Props = {
  level: DelayRiskLevel;
  reason: string;
  departureTriggers?: string[];
  arrivalTriggers?: string[];
  departureReason?: string;
  arrivalReason?: string;
  hasAdvisories?: boolean;
  /** When flight categories and headline risk disagree — short factual explanation. */
  categoryAlignmentNote?: string;
};

const LEVEL_STYLES: Record<DelayRiskLevel, string> = {
  LOW: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  MODERATE: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  HIGH: "border-red-500/40 bg-[#2a0f14] text-white",
};

const LEVEL_LABELS: Record<DelayRiskLevel, string> = {
  LOW: "No Significant Operational Impact",
  MODERATE: "Operational Watch",
  HIGH: "Operational Impact Likely",
};

function isSignificant(r: string | undefined): boolean {
  return (r ?? "").trim().length > 0 && r !== NO_IMPACT;
}

function getTriggerIcon(trigger: string) {
  const t = trigger.toLowerCase();

  if (t.includes("ifr") || t.includes("lifr")) return "⚠️";
  if (t.includes("ceiling")) return "☁️";
  if (t.includes("visibility")) return "👁";
  if (t.includes("wind") || t.includes("gust")) return "💨";
  if (t.includes("rain") || t.includes("precip")) return "🌧";
  if (t.includes("sigmet") || t.includes("airmet")) return "⚠️";

  return "•";
}

export function RiskSummary({
  level,
  reason,
  departureTriggers = [],
  arrivalTriggers = [],
  departureReason,
  arrivalReason,
  hasAdvisories,
  categoryAlignmentNote,
}: Props) {
  const style = LEVEL_STYLES[level] ?? LEVEL_STYLES.LOW;
  const label = LEVEL_LABELS[level] ?? level;

  const dep = departureTriggers.length > 0 ? departureTriggers : [];
  const arr = arrivalTriggers.length > 0 ? arrivalTriggers : [];
  const hasDep = dep.length > 0;
  const hasArr = arr.length > 0;
  const hasFallback = !hasDep && !hasArr && (level === "MODERATE" || level === "HIGH");
  const showDrivers = hasDep || hasArr || hasFallback;

  return (
    <div className={`rounded-2xl border p-4 ${style}`}>
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-sm opacity-90">
        {formatOutOfServiceForWeatherBriefDisplay(reason || "Not available")}
      </p>
      {categoryAlignmentNote?.trim() && (
        <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-snug text-amber-100/95">
          {formatOutOfServiceForWeatherBriefDisplay(categoryAlignmentNote)}
        </p>
      )}
      {showDrivers && (
        <>
          <p className="mt-2 text-sm opacity-90">Key weather drivers</p>
          {hasFallback ? (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-sm opacity-90">
              <li className="flex items-center gap-2">
                <span aria-hidden className="text-xs opacity-80">
                  {getTriggerIcon(ADVISORIES_FALLBACK)}
                </span>
                {ADVISORIES_FALLBACK}
              </li>
            </ul>
          ) : (
            <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium opacity-75">Departure</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm opacity-90">
                  {dep.map((d, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span aria-hidden className="text-xs opacity-80">
                        {getTriggerIcon(d)}
                      </span>
                      {formatOutOfServiceForWeatherBriefDisplay(d)}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium opacity-75">Arrival</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm opacity-90">
                  {arr.map((d, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span aria-hidden className="text-xs opacity-80">
                        {getTriggerIcon(d)}
                      </span>
                      {formatOutOfServiceForWeatherBriefDisplay(d)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
