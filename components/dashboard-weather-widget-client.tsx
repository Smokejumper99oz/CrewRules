"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { HomeBaseMetar } from "@/lib/weather-brief/get-home-base-metar";
import { DashboardWeatherWidget } from "@/components/dashboard-weather-widget";

const GEO_TIMEOUT_MS = 10_000;

/** Skip repeating geolocation prompts / reads when revisiting dashboard within this window. */
const GEO_PROMPT_COOLDOWN_MS = 12 * 60 * 60 * 1000;

const STORAGE_KEY = "crewrules_dashboard_geo_last_attempt_ms";

const API_PATH = "/api/frontier/pilots/portal/dashboard-weather";

type Props = {
  fallbackMetar: HomeBaseMetar | null;
  weatherBriefHref: string;
  /** Pro / Enterprise / active trial — link label matches Advanced Weather Brief. */
  advancedWeatherBrief?: boolean;
};

function readCooldownActive(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const last = parseInt(raw, 10);
    if (!Number.isFinite(last)) return false;
    return Date.now() - last < GEO_PROMPT_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markCooldown(): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Storage unavailable (private mode, disabled, quota).
  }
}

function readPosition(timeoutMs: number): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      reject(new Error("geolocation unavailable"));
      return;
    }
    const id = window.setTimeout(() => reject(new Error("geolocation timeout")), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(id);
        resolve(pos);
      },
      (err) => {
        window.clearTimeout(id);
        reject(err);
      },
      { enableHighAccuracy: false, maximumAge: 300_000 }
    );
  });
}

export function DashboardWeatherWidgetClient({
  fallbackMetar,
  weatherBriefHref,
  advancedWeatherBrief = false,
}: Props) {
  const widgetTitle = advancedWeatherBrief ? "Advanced Weather Brief" : "Weather Brief";
  const [metar, setMetar] = useState<HomeBaseMetar | null>(fallbackMetar);
  const [geoActive, setGeoActive] = useState(false);

  useEffect(() => {
    let dead = false;

    void (async () => {
      try {
        if (readCooldownActive()) return;

        try {
          const pending = navigator.permissions?.query?.({
            name: "geolocation" as PermissionName,
          });
          if (pending) {
            const status = await pending;
            if (status.state === "denied") {
              markCooldown();
              return;
            }
          }
        } catch {
          // Permissions API unsupported or throws — continue to getCurrentPosition path.
        }

        let pos: GeolocationPosition;
        try {
          pos = await readPosition(GEO_TIMEOUT_MS);
        } catch {
          markCooldown();
          return;
        }

        markCooldown();

        if (dead) return;
        const res = await fetch(API_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        });
        if (dead || !res.ok) return;
        const data = (await res.json()) as { metar?: HomeBaseMetar | null };
        if (dead || !data.metar) return;
        setMetar(data.metar);
        setGeoActive(true);
      } catch {
        // Silent fallback: keep server METAR; placeholder link renders when still no metar.
      }
    })();

    return () => {
      dead = true;
    };
  }, []);

  if (!metar) {
    return (
      <Link
        href={weatherBriefHref}
        aria-label={widgetTitle}
        className="group w-full sm:shrink-0 sm:min-w-[260px] sm:w-auto flex flex-col gap-0.5 rounded-xl border border-white/5 bg-slate-900/40 px-4 py-2.5 transition hover:border-white/10 hover:bg-slate-900/60"
      >
        <span className="text-sm font-semibold text-slate-100">{widgetTitle}</span>
        <span className="text-xs text-slate-500">Weather unavailable</span>
      </Link>
    );
  }

  return (
    <DashboardWeatherWidget
      metar={metar}
      weatherBriefHref={weatherBriefHref}
      sourceLabel={geoActive ? "Near you" : null}
      linkAriaLabel={widgetTitle}
    />
  );
}
