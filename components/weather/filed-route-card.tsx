"use client";

import { useState } from "react";
import type { NextFlight } from "@/lib/weather-brief/types";
import type { FiledRouteState } from "@/lib/weather-brief/get-filed-route";
import { Route, Copy, Check } from "lucide-react";
import { normalizeRoute } from "@/lib/filed-route/normalize-route";

type Props = {
  flight: NextFlight;
  routeText?: string | null;
  loading?: boolean;
  /** When `routeText` is empty, chooses fallback copy. Defaults to `unavailable`. */
  filedRouteState?: FiledRouteState;
  /** Display-only certainty from centralized brief state (matches trimmed route text). */
  hasFiledRoute?: boolean;
};

const PENDING_IN_FEED_COPY =
  "Route not yet available from FlightAware. Public route data may appear late even when flight status is available. Verify routing in dispatch release or ForeFlight.";

export default function FiledRouteCard({
  flight,
  routeText,
  loading,
  filedRouteState = "unavailable",
  hasFiledRoute: hasFiledRouteProp,
}: Props) {
  const [copied, setCopied] = useState(false);
  const raw = (flight.flightNumber ?? "").trim();
  const numeric = raw.replace(/^(F9|FFT)\s*/i, "").replace(/\D/g, "") || raw.replace(/\D/g, "");
  const flightLabel = numeric ? `FFT${numeric}` : "Flight";
  const displayRoute = routeText ? normalizeRoute(routeText) : null;
  const hasFiledRoute = hasFiledRouteProp ?? Boolean(routeText?.trim());

  const handleCopy = () => {
    if (displayRoute) {
      navigator.clipboard.writeText(displayRoute);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0B1B2B]/60 p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-white">
          <span className="flex items-center gap-2">
            <Route className="h-4 w-4 text-[#75C043]" />
            Filed Route
          </span>
          {!hasFiledRoute ? (
            <span className="inline-flex shrink-0 items-center rounded-full border border-amber-500/35 bg-amber-950/25 px-2 py-0.5 text-[11px] font-semibold text-amber-300/95">
              Awaiting Route
            </span>
          ) : null}
        </h3>
        <span className="text-xs text-slate-400">{flightLabel}</span>
      </div>

      <div className="mt-2 text-xs text-slate-400">
        {flight.departureAirport} → {flight.arrivalAirport}
      </div>

      {!loading && !hasFiledRoute ? (
        <div className="mt-3 rounded-md border border-white/10 bg-black/25 px-3 py-2.5">
          <p className="text-sm leading-relaxed text-slate-200">
            Filed route not available yet - Once your route is filed, CrewRules™ will use the full route for
            enroute weather and analysis.
          </p>
        </div>
      ) : null}

      <div
        className={`mt-3 flex min-h-[44px] touch-manipulation items-start gap-2 rounded-md bg-black/30 px-3 py-3 font-mono text-xs leading-relaxed text-slate-200 whitespace-pre-wrap md:py-2 ${displayRoute ? "cursor-pointer active:bg-black/40" : ""}`}
        onClick={displayRoute ? handleCopy : undefined}
        role={displayRoute ? "button" : undefined}
        title={displayRoute ? "Tap to copy" : undefined}
      >
        <span className="min-w-0 flex-1">
          {loading ? (
            <span className="text-slate-500">Looking up route…</span>
          ) : displayRoute ? (
            displayRoute
          ) : (
            <span className="block text-left text-slate-400">
              {filedRouteState === "pending_in_feed" ? PENDING_IN_FEED_COPY : <span className="text-slate-500">—</span>}
            </span>
          )}
        </span>
        {displayRoute && (
          <span className="shrink-0 pt-0.5 text-slate-400" aria-hidden>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </span>
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Powered by FlightAware when available.</p>
    </div>
  );
}
