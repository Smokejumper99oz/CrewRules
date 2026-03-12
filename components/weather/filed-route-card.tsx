"use client";

import { useState } from "react";
import type { NextFlight } from "@/lib/weather-brief/types";
import { Route, Copy, Check } from "lucide-react";
import { normalizeRoute } from "@/lib/filed-route/normalize-route";

type Props = {
  flight: NextFlight;
  routeText?: string | null;
  loading?: boolean;
};

export default function FiledRouteCard({ flight, routeText, loading }: Props) {
  const [copied, setCopied] = useState(false);
  const raw = (flight.flightNumber ?? "").trim();
  const numeric = raw.replace(/^(F9|FFT)\s*/i, "").replace(/\D/g, "") || raw.replace(/\D/g, "");
  const flightLabel = numeric ? `FFT${numeric}` : "Flight";
  const displayRoute = routeText ? normalizeRoute(routeText) : null;

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
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Route className="h-4 w-4 text-[#75C043]" />
          Filed Route
        </h3>
        <span className="text-xs text-slate-400">{flightLabel}</span>
      </div>

      <div className="mt-2 text-xs text-slate-400">
        {flight.departureAirport} → {flight.arrivalAirport}
      </div>

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
            <span className="text-slate-400">
              {"Filed route not yet available. Routes typically appear closer to departure time."}
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
      <p className="mt-2 text-[11px] text-slate-500">
        Route shown when available from FlightAware data.
      </p>
    </div>
  );
}
