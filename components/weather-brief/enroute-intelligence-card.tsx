import { Sparkles } from "lucide-react";

import { getWindsAloftSimple, type WindsAloftLevels } from "@/lib/weather-brief/get-winds-aloft";
const CARD_CLASS =
  "rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] md:p-6";

/** Mock comparison tiers for prototype UI only (no live fetch). */
const COMPARE_ALTITUDES = ["FL320", "FL340", "FL360", "FL380"] as const;

/** OFP-style fallbacks when props are not supplied. */
const FALLBACK_BASELINE_TRIP_FUEL_LBS = 12_195;
const FALLBACK_BLOCK_MINUTES = 144;
const FUEL_LBS_PER_KT_PER_HOUR = 8;

type AltitudeTier = {
  wind: string;
  fuelLb: number;
};

function resolvedBlockMinutes(blockMinutes?: number | null): number {
  if (blockMinutes != null && Number.isFinite(blockMinutes) && blockMinutes > 0) {
    return blockMinutes;
  }
  return FALLBACK_BLOCK_MINUTES;
}

function resolvedBaselineTripFuelLbs(baselineTripFuelLbs?: number | null): number {
  if (baselineTripFuelLbs != null && Number.isFinite(baselineTripFuelLbs) && baselineTripFuelLbs > 0) {
    return baselineTripFuelLbs;
  }
  return FALLBACK_BASELINE_TRIP_FUEL_LBS;
}

/** Table fuel (lb): OFP trip fuel minus wind delta vs planned FL340, scaled by route time. */
function buildAltitudeRows(
  winds: WindsAloftLevels,
  flightHours: number,
  baselineTripFuelLbs: number
): Record<string, AltitudeTier> {
  const plannedWs = winds.FL340.windSpeed;
  const scale = flightHours * FUEL_LBS_PER_KT_PER_HOUR;
  const fuelFor = (fl: (typeof COMPARE_ALTITUDES)[number]) =>
    Math.round(baselineTripFuelLbs - (winds[fl].windSpeed - plannedWs) * scale);
  return {
    FL320: { wind: `${winds.FL320.windSpeed} kt`, fuelLb: fuelFor("FL320") },
    FL340: { wind: `${winds.FL340.windSpeed} kt`, fuelLb: fuelFor("FL340") },
    FL360: { wind: `${winds.FL360.windSpeed} kt`, fuelLb: fuelFor("FL360") },
    FL380: { wind: `${winds.FL380.windSpeed} kt`, fuelLb: fuelFor("FL380") },
  };
}

const JET_FUEL_LBS_PER_GALLON = 6.7;
const JET_FUEL_PRICE_PER_GALLON = 4.5;
/** Display-only; math uses JET_FUEL_PRICE_PER_GALLON. */
const JET_FUEL_PRICE_PER_GALLON_LABEL = JET_FUEL_PRICE_PER_GALLON.toFixed(2);

/** Planned vs recommended tiers for Impact math. */
const PLANNED_LEVEL = "FL340";
const RECOMMENDED_LEVEL = "FL360";

type Props = {
  departureAirport: string;
  arrivalAirport: string;
  departureIso?: string | null;
  /** Schedule block minutes; when missing, 144 min OFP-style fallback is used. */
  blockMinutes?: number | null;
  /** OFP enroute trip fuel (lb); when missing, 12195 lb fallback is used. */
  baselineTripFuelLbs?: number | null;
};

export async function EnrouteIntelligenceCard({
  departureAirport,
  arrivalAirport,
  departureIso,
  blockMinutes: blockMinutesProp,
  baselineTripFuelLbs: baselineTripFuelLbsProp,
}: Props) {
  const { winds, source } = await getWindsAloftSimple({ departureAirport, arrivalAirport });
  const planned = PLANNED_LEVEL;
  const recommended = RECOMMENDED_LEVEL;

  const baselineTripFuelLbs = resolvedBaselineTripFuelLbs(baselineTripFuelLbsProp);
  const blockMinutes = resolvedBlockMinutes(blockMinutesProp);
  const flightHours = blockMinutes / 60;

  const plannedWind = winds.FL340.windSpeed;
  const recommendedWind = winds.FL360.windSpeed;
  const deltaWind = recommendedWind - plannedWind;
  const fuelSavedLbs = deltaWind * flightHours * FUEL_LBS_PER_KT_PER_HOUR;
  /* plannedFuel = baselineTripFuelLbs; recommendedFuel = baselineTripFuelLbs - fuelSavedLbs — reflected in table rows for FL340 / FL360. */

  const rowsByAltitude = buildAltitudeRows(winds, flightHours, baselineTripFuelLbs);
  const gallonsSaved = fuelSavedLbs / JET_FUEL_LBS_PER_GALLON;
  const dollarsSaved = gallonsSaved * JET_FUEL_PRICE_PER_GALLON;
  const fuelSavedLbsRounded = Math.round(fuelSavedLbs);
  const dollarsSavedRounded = Math.round(dollarsSaved);

  return (
    <div className={CARD_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#75C043]" aria-hidden />
          <div>
            <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold tracking-tight text-white">
              <span>
                Preflight Enroute Intelligence<span className="align-super text-xs">™</span>
              </span>
              <span
                aria-label="Beta"
                className="inline-flex shrink-0 items-center rounded-full border border-fuchsia-500/40 bg-fuchsia-500/20 px-2 py-0.5 text-xs font-semibold text-fuchsia-400"
              >
                BETA
              </span>
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              {departureAirport.replace(/^K/, "")} → {arrivalAirport.replace(/^K/, "")}
              {departureIso ? (
                <>
                  {" "}
                  <span className="text-slate-500">· Dep {new Date(departureIso).toISOString().slice(0, 16).replace("T", " ")}Z</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Planned altitude</dt>
          <dd className="mt-1 text-xl font-semibold text-white">{planned}</dd>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/25 px-4 py-3">
          <dt className="text-xs uppercase tracking-wide text-emerald-400/90">Recommended altitude</dt>
          <dd className="mt-1 text-xl font-semibold text-emerald-100">{recommended}</dd>
        </div>
      </dl>

      <div className="mt-6 border-t border-white/10 pt-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">Compared levels (prototype)</p>
        <p className="mt-1 text-xs text-slate-500">
          {source === "awc_fb"
            ? "Winds: Forecast — High confidence within 12h of departure"
            : "Winds: estimated fallback — Real winds unavailable"}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[280px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-slate-500">
                <th className="py-2 pr-3 font-medium">Level</th>
                <th className="py-2 pr-3 font-medium">Wind</th>
                <th className="py-2 font-medium text-right">Fuel (lb)</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              {COMPARE_ALTITUDES.map((fl) => {
                const row = rowsByAltitude[fl];
                const highlight = fl === planned || fl === recommended;
                return (
                  <tr
                    key={fl}
                    className={`border-b border-white/5 last:border-0 ${highlight ? "bg-white/[0.04]" : ""}`}
                  >
                    <td className="py-2.5 pr-3 font-mono text-xs">{fl}</td>
                    <td className="py-2.5 pr-3">{row?.wind ?? "—"}</td>
                    <td className="py-2.5 text-right tabular-nums">{row?.fuelLb.toLocaleString() ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold text-white">Why</h4>
          <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm leading-relaxed text-slate-300">
            <li>Better wind component</li>
            <li>Estimated smoother ride</li>
            <li>More efficient altitude</li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white">Impact</h4>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-300">
            <li>{`~${fuelSavedLbsRounded} lbs fuel saved`}</li>
            <li>{`~$${dollarsSavedRounded} savings based on $${JET_FUEL_PRICE_PER_GALLON_LABEL}/gal`}</li>
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Based on OFP trip fuel and route duration.
          </p>
          <p className="mt-3 text-xs text-slate-500">Prototype estimate — not final performance data.</p>
        </div>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-slate-500">
        Preflight recommendation based on forecast data. Confirm with Dispatch and ATC.
      </p>
    </div>
  );
}
