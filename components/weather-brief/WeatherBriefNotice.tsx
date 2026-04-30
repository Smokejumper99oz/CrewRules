"use client";

import { useState, useEffect } from "react";
import { Info, FileText, Globe, Cloud, Radio } from "lucide-react";

const STORAGE_KEY_LAST_SEEN = "crewrules_weather_brief_notice_last_seen";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

type Props = {
  departureIso: string | null | undefined;
  /** Pro / Enterprise / active trial — copy uses Advanced Weather Brief. */
  advancedWeatherBrief?: boolean;
};

function shouldShowNoticeFromStorage(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LAST_SEEN);
    if (raw == null || String(raw).trim() === "") return true;
    const lastSeen = parseInt(String(raw), 10);
    if (!Number.isFinite(lastSeen)) return true;
    return Date.now() - lastSeen > FOURTEEN_DAYS_MS;
  } catch {
    return true;
  }
}

function persistLastSeenNow(): void {
  try {
    localStorage.setItem(STORAGE_KEY_LAST_SEEN, String(Date.now()));
  } catch {
    // ignore — caller keeps UX consistent where possible
  }
}

export function WeatherBriefNotice({ departureIso, advancedWeatherBrief = false }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  const productName = advancedWeatherBrief ? "Advanced Weather Brief" : "Weather Brief";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setShowModal(shouldShowNoticeFromStorage());
  }, [mounted]);

  const handleContinue = () => {
    persistLastSeenNow();
    setShowModal(false);
  };

  return (
    <>
      {/* Help banner */}
      <div className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-4 md:py-3">
        <p className="text-sm font-semibold text-slate-300">
          {productName} — Operational Overview
        </p>
        {advancedWeatherBrief ? (
          <>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              CrewRules™ Advanced Weather Brief provides filed-route-based weather analysis for departure,
              enroute, and arrival — including NOTAMs and route impacts using official aviation data.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              Always verify with official sources such as AWC, dispatch releases, and METAR/TAF before making
              operational decisions.
            </p>
          </>
        ) : (
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            CrewRules™ Weather Brief highlights the most important departure, enroute, and arrival conditions —
            including key operational factors like NOTAMs and route impacts using official aviation data. Always verify
            with official sources such as AWC, dispatch releases, and METAR/TAF before making operational decisions.
          </p>
        )}
      </div>

      {/* One-time modal */}
      {showModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60"
            aria-hidden
          />
          <div
            className="fixed left-[max(1rem,env(safe-area-inset-left,0px))] right-[max(1rem,env(safe-area-inset-right,0px))] top-1/2 z-50 max-h-[min(85dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem))] -translate-y-1/2 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-slate-900 shadow-xl md:left-1/2 md:right-auto md:w-full md:max-w-lg md:-translate-x-1/2"
            role="dialog"
            aria-labelledby="weather-brief-notice-title"
            aria-modal="true"
          >
            {/* Blue Info Header */}
            <div className="border-b border-blue-500/30 bg-blue-500/10 px-6 py-4">
              <div
                id="weather-brief-notice-title"
                className="flex min-w-0 items-start gap-2 text-blue-300"
              >
                <Info size={18} className="mt-0.5 shrink-0" aria-hidden />
                <span className="min-w-0 break-words font-semibold leading-snug">
                  {productName} Usage Notice
                </span>
              </div>
              <p className="mt-1 text-xs uppercase text-slate-400">
                Pilot operational notice
              </p>
            </div>

            <div className="space-y-4 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
              <div className="text-sm font-medium leading-relaxed text-slate-200">
                <p>
                  {advancedWeatherBrief ? (
                    <>
                      CrewRules™ Advanced Weather Brief summarizes operational weather analysis and filed-route based
                      weather intelligence — including NOTAMs and route-relevant hazards. Always verify with official sources
                      before making decisions.
                    </>
                  ) : (
                    <>
                      CrewRules™ {productName} highlights key weather and operational factors for your flight,
                      including NOTAMs and route impacts. Always verify with official sources before making
                      decisions.
                    </>
                  )}
                </p>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-sm font-semibold text-amber-200">
                  {productName} is NOT an official weather briefing
                </p>
                <p className="mt-1 text-xs text-amber-200/90">
                  Do not use it in place of dispatch releases, required briefings, or company procedures.
                </p>
                <p className="mt-3 text-xs font-medium text-amber-300">Confirm with primary sources</p>
                <ul className="mt-1.5 space-y-1 text-xs text-amber-200/90">
                  <li className="flex items-center gap-2">
                    <FileText size={14} className="shrink-0 text-amber-300" aria-hidden />
                    Dispatch or flight release
                  </li>
                  <li className="flex items-center gap-2">
                    <Globe size={14} className="shrink-0 text-amber-300" aria-hidden />
                    FAA / Aviation Weather Center (AWC)
                  </li>
                  <li className="flex items-center gap-2">
                    <Cloud size={14} className="shrink-0 text-amber-300" aria-hidden />
                    METAR, TAF, SIGMET, AIRMET
                  </li>
                  <li className="flex items-center gap-2">
                    <Radio size={14} className="shrink-0 text-amber-300" aria-hidden />
                    ATC weather information
                  </li>
                </ul>
              </div>

              <p className="text-xs text-slate-500">
                Supplemental awareness only. This notice shows about once every 14 days.
              </p>

              {/* Continue button */}
              <div className="flex justify-stretch pt-2 sm:justify-end">
                <button
                  type="button"
                  onClick={handleContinue}
                  className="min-h-[44px] w-full touch-manipulation rounded-xl bg-[#75C043] px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-[#75C043]/90 active:bg-[#75C043]/80 sm:w-auto"
                >
                  Continue to {productName}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
