"use client";

import { useEffect } from "react";
import Image from "next/image";

export const SPLASH_START_KEY = "crewrules-portal-splash-start";

export function CrewSplashScreen({ staticMode, fadeOut }: { staticMode?: boolean; fadeOut?: boolean }) {
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SPLASH_START_KEY, String(Date.now()));
    }
  }, []);

  return (
    <div className={`crew-splash-screen ${staticMode ? "crew-splash-screen--static" : ""} ${fadeOut ? "crew-splash-fade-out" : ""}`}>
      <div className={`crew-splash-content ${staticMode ? "crew-splash-content--static" : ""}`}>
        <div className="w-[260px] sm:w-[320px] md:w-[440px] lg:w-[560px] xl:w-[640px] 2xl:w-[720px] max-w-[85vw]">
          <Image
            src="/logo/crewrules-logo.png"
            alt="CrewRules"
            width={720}
            height={288}
            className="h-auto w-full"
            priority
          />
        </div>

        {/* Progress + status */}
        <div className="mt-3 w-[240px] sm:w-[280px] md:w-[340px] lg:w-[380px] max-w-[70vw]">
          <div className="relative h-[3px] overflow-hidden rounded-full bg-emerald-400/10">
            <div className={`crew-splash-bar ${fadeOut ? "crew-splash-bar--static" : ""}`} />
          </div>

          <div className={`mt-3 text-[11px] md:text-xs text-slate-300/85 tracking-wide ${staticMode ? "" : "crew-splash-loading-text"}`}>
            Loading your dashboard…
          </div>
        </div>
      </div>
    </div>
  );
}
