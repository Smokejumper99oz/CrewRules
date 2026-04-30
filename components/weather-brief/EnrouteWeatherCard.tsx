"use client";

import Link from "next/link";
import type { EnrouteAdvisory } from "@/lib/weather-brief/types";
import type { EnrouteRiskLevel, EnrouteStation } from "@/lib/weather-brief/enroute/types";
import type { WeatherBriefRouteMessagingState } from "@/lib/weather-brief/weather-brief-route-messaging";
import {
  enrouteCorridorAvailabilityMessage,
  enrouteHazardsCertaintyMessage,
} from "@/lib/weather-brief/weather-brief-route-messaging";
import { formatOutOfServiceForWeatherBriefDisplay } from "@/lib/weather-brief/format-out-of-service-for-weather-brief-display";
import { resolveStationCode } from "@/lib/weather-brief/resolve-station-code";

type Props = {
  advisories: EnrouteAdvisory[];
  enrouteStations?: EnrouteStation[];
  departureAirport?: string;
  arrivalAirport?: string;
  /** Display-only certainty (filed route text + corridor station count); drives messaging only. */
  routeMessaging: WeatherBriefRouteMessagingState;
  /** When true, full briefing, sources, and route context; otherwise teaser + Pro upsell (NOTAM card pattern). */
  proActive?: boolean;
};

const RISK_RANK: Record<EnrouteRiskLevel, number> = {
  HIGH: 3,
  MODERATE: 2,
  LOW: 1,
  NONE: 0,
};

function highestEnrouteRiskFromStations(stations: EnrouteStation[]): EnrouteRiskLevel {
  let best: EnrouteRiskLevel = "NONE";
  let bestRank = -1;
  for (const s of stations) {
    const r = RISK_RANK[s.risk];
    if (r > bestRank) {
      bestRank = r;
      best = s.risk;
    }
  }
  return best;
}

function hasAdvisoryText(a: EnrouteAdvisory | null | undefined): boolean {
  if (!a) return false;
  const ext = a as { raw_text?: string; text?: string; message?: string };
  const text = ext.raw_text || ext.text || ext.message || a.rawText || a.description || a.title;
  return typeof text === "string" && text.trim().length > 0;
}

export function EnrouteWeatherCard({
  advisories,
  enrouteStations,
  departureAirport,
  arrivalAirport,
  routeMessaging,
  proActive,
}: Props) {
  const validAdvisories = (advisories ?? []).filter(hasAdvisoryText);
  const isPro = proActive === true;
  const corridorNote = enrouteCorridorAvailabilityMessage(routeMessaging);

  if (!isPro) {
    const typeLabels = [...new Set(validAdvisories.map((a) => a.type.replace(/_/g, " ")))];
    const typesTeaser =
      typeLabels.length > 0 ? typeLabels.join(", ") : null;

    let teaserBody: string;
    if (validAdvisories.length > 0) {
      teaserBody =
        typesTeaser != null
          ? `Enroute products on file for your leg include ${typesTeaser} — Open the full card for decoded wording, validity, and official links.`
          : "Enroute SIGMET/AIRMET products apply to your leg — Open the full card for decoded wording, validity, and official links.";
    } else {
      teaserBody = enrouteHazardsCertaintyMessage(routeMessaging);
    }

    return (
      <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] md:p-6">
        <h3 className="text-lg font-semibold leading-snug break-words">
          <span className="text-white">Crew</span>
          <span className="text-[#75C043]">Rules</span>
          <span className="align-super text-xs font-normal text-white">™</span>
          <span className="text-white"> Enroute Intelligence</span>
          <span className="align-super text-xs font-normal text-white">™</span>
        </h3>
        <div className="mt-4 space-y-4">
          <p className="text-sm text-slate-300">{teaserBody}</p>
          <div className="rounded-lg border border-amber-500/25 bg-amber-950/15 px-3 py-3">
            <p className="text-xs leading-relaxed text-amber-400">
              🔒 Full CrewRules™ Enroute Intelligence™ is available with CrewRules™ Pro.
            </p>
            <Link
              href="/frontier/pilots/portal/settings/subscription"
              className="mt-2 inline-block text-xs font-medium text-amber-300 underline-offset-2 transition hover:text-amber-200 hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-500/40 rounded-sm"
            >
              View Pro trial
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const routeStations = enrouteStations ?? [];
  const hasAwcAdvisory = validAdvisories.some((a) => a.provider === "awc");
  const hasAvwxAdvisory = validAdvisories.some((a) => a.provider === "avwx");

  const routeRiskLevel =
    routeStations.length > 0 ? highestEnrouteRiskFromStations(routeStations) : null;

  const isDepartureArrivalOnlySampling =
    routeStations.length === 2 &&
    !!departureAirport &&
    !!arrivalAirport &&
    routeStations[0].icao === resolveStationCode(departureAirport).toUpperCase() &&
    routeStations[1].icao === resolveStationCode(arrivalAirport).toUpperCase();

  /** NBM route risk is only meaningful with corridor sampling, not dep+arr-only. */
  const hideNbmRouteRisk = isDepartureArrivalOnlySampling;

  const hazardsEmptyMessage = enrouteHazardsCertaintyMessage(routeMessaging);
  const suppressCorridorNoteDuplicate =
    validAdvisories.length === 0 &&
    corridorNote != null &&
    corridorNote === hazardsEmptyMessage;

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] md:p-6">
      <h3 className="text-lg font-semibold leading-snug break-words">
        <span className="text-white">Crew</span>
        <span className="text-[#75C043]">Rules</span>
        <span className="align-super text-xs font-normal text-white">™</span>
        <span className="text-white"> Enroute Intelligence</span>
        <span className="align-super text-xs font-normal text-white">™</span>
      </h3>
      {routeStations.length === 0 ? (
        suppressCorridorNoteDuplicate ? null : (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-400">
              {corridorNote ??
                "Route station sampling is not available for this flight yet — Departure and arrival weather are shown in the airport cards."}
            </p>
          </div>
        )
      ) : hideNbmRouteRisk ? (
        corridorNote != null && !suppressCorridorNoteDuplicate ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-slate-400">{corridorNote}</p>
          </div>
        ) : null
      ) : (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p>
            <span className="text-slate-500">Route Risk Level:</span>{" "}
            <span className="font-medium text-slate-200">{routeRiskLevel}</span>
          </p>
        </div>
      )}
      {validAdvisories.length === 0 ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-slate-400">{hazardsEmptyMessage}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {validAdvisories.map((adv, i) => {
            const body =
              (adv.pilotSummary && adv.pilotSummary.trim()) ||
              (adv.description && adv.description.trim()) ||
              (adv.title && adv.title.trim()) ||
              "";
            return (
              <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-1 text-xs tracking-wide text-sky-400">
                  {(adv.type ?? "ADVISORY").replace(/_/g, " ")}
                </div>

                <div className="font-medium max-w-full text-sm leading-snug whitespace-normal break-words md:text-[15px]">
                  {formatOutOfServiceForWeatherBriefDisplay(typeof body === "string" ? body : "")}
                </div>

                {adv.timeRelevance === "near_term" ? (
                  <p className="mt-1.5 text-xs text-slate-500">Near-term — Valid at departure; ends soon after.</p>
                ) : null}

                {adv.operationalDecode?.trim() ? (
                  <p className="mt-1.5 text-xs leading-snug text-slate-500">
                    Operational note: {adv.operationalDecode.trim()}
                  </p>
                ) : null}

                <a
                  href={(adv as { source?: string }).source || adv.sourceUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex min-h-[44px] items-center touch-manipulation text-sm text-emerald-400 hover:underline"
                >
                  View source →
                </a>
              </div>
            );
          })}
          <p className="text-[11px] leading-relaxed text-slate-500">
            {hasAwcAdvisory && hasAvwxAdvisory
              ? "SIGMET/AIRMET: U.S. Aviation Weather Center (government baseline) plus supplemental station-area reports from AVWX."
              : hasAvwxAdvisory && !hasAwcAdvisory
                ? "SIGMET/AIRMET: AVWX station-area reports only for this load — The AWC feed returned no matching advisories or was unavailable; confirm on aviationweather.gov."
                : "SIGMET/AIRMET: U.S. Aviation Weather Center (government baseline)."}
          </p>
        </div>
      )}
    </div>
  );
}
