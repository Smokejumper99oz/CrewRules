"use client";

import { useState, useEffect } from "react";
import { Info, FileText, Globe, Cloud, Radio } from "lucide-react";

const STORAGE_PREFIX = "crewrules_weatherbrief_notice_";

type Props = {
  departureIso: string | null | undefined;
};

export function WeatherBriefNotice({ departureIso }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !departureIso) return;

    const key = `${STORAGE_PREFIX}${departureIso}`;
    try {
      const acknowledged = localStorage.getItem(key);
      if (!acknowledged) {
        setShowModal(true);
      }
    } catch {
      setShowModal(true);
    }
  }, [mounted, departureIso]);

  const handleContinue = () => {
    if (!departureIso) return;
    const key = `${STORAGE_PREFIX}${departureIso}`;
    try {
      localStorage.setItem(key, "1");
    } catch {
      // ignore
    }
    setShowModal(false);
  };

  return (
    <>
      {/* Help banner */}
      <div className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-4 md:py-3">
        <p className="text-sm font-semibold text-slate-300">
          Weather Brief — Operational Overview
        </p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          CrewRules™ Weather Brief provides a quick overview of departure, enroute,
          and arrival weather conditions using official aviation weather sources.
          This page is intended to help pilots quickly locate relevant weather
          information. Always verify weather using official sources such as the
          Aviation Weather Center (AWC), company dispatch releases, and official
          METAR/TAF products before making operational decisions.
        </p>
      </div>

      {/* One-time modal */}
      {showModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60"
            aria-hidden
          />
          <div
            className="fixed left-4 right-4 top-1/2 z-50 max-h-[85vh] -translate-y-1/2 overflow-y-auto rounded-xl border border-white/10 bg-slate-900 shadow-xl md:left-1/2 md:right-auto md:w-full md:max-w-lg md:-translate-x-1/2"
            role="dialog"
            aria-labelledby="weather-brief-notice-title"
            aria-modal="true"
          >
            {/* Blue Info Header */}
            <div className="border-b border-blue-500/30 bg-blue-500/10 px-6 py-4">
              <div
                id="weather-brief-notice-title"
                className="flex items-center gap-2 text-blue-300"
              >
                <Info size={18} className="shrink-0" />
                <span className="font-semibold">Weather Brief Usage Notice</span>
              </div>
              <p className="mt-1 text-xs uppercase text-slate-400">
                Pilot operational notice
              </p>
            </div>

            <div className="space-y-4 p-6">
              {/* Text paragraph */}
              <div className="text-sm leading-relaxed text-slate-300">
                <p>
                  CrewRules™ Weather Brief provides a quick operational overview of
                  weather conditions for your upcoming flight using official aviation
                  weather sources such as METAR, TAF, and aviation advisories. This
                  tool is designed to help pilots quickly identify relevant weather
                  information for situational awareness.
                </p>
              </div>

              {/* Amber Safety Box */}
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-sm font-semibold text-amber-200">
                  Weather Brief is NOT an official weather briefing
                </p>
                <p className="mt-1 text-xs text-amber-200/90">
                  and should not replace required preflight weather briefings,
                  dispatch releases, or company operational procedures.
                </p>
                <p className="mt-3 text-xs text-amber-200/90">
                  Before making operational decisions, pilots must verify weather
                  using official sources such as:
                </p>
                <p className="mb-2 mt-2 text-xs uppercase tracking-wider text-amber-300">
                  Operational Decision Sources
                </p>
                <ul className="space-y-1 text-sm text-amber-200/90">
                  <li className="flex items-center gap-2">
                    <FileText size={14} className="shrink-0 text-amber-300" />
                    Company dispatch or flight release
                  </li>
                  <li className="flex items-center gap-2">
                    <Globe size={14} className="shrink-0 text-amber-300" />
                    FAA / Aviation Weather Center (AWC)
                  </li>
                  <li className="flex items-center gap-2">
                    <Cloud size={14} className="shrink-0 text-amber-300" />
                    METAR / TAF / SIGMET / AIRMET products
                  </li>
                  <li className="flex items-center gap-2">
                    <Radio size={14} className="shrink-0 text-amber-300" />
                    ATC weather information
                  </li>
                </ul>
              </div>

              {/* Weather conditions note */}
              <p className="text-sm leading-relaxed text-slate-400">
                Weather conditions may change rapidly. Always confirm the most
                current weather reports before departure and during flight
                operations. CrewRules™ Weather Brief is provided as a supplemental
                situational awareness tool only.
              </p>

              {/* Footer note */}
              <p className="text-xs text-slate-500">
                This notice will appear once per trip.
              </p>

              {/* Continue button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleContinue}
                  className="min-h-[44px] touch-manipulation rounded-xl bg-[#75C043] px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-[#75C043]/90 active:bg-[#75C043]/80"
                >
                  Continue to Weather Brief
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
