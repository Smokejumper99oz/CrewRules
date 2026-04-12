"use client";

import { useEffect, useState } from "react";
import type { HomeBaseMetar } from "@/lib/weather-brief/get-home-base-metar";
import { DashboardWeatherWidget } from "@/components/dashboard-weather-widget";

const GEO_TIMEOUT_MS = 10_000;

const API_PATH = "/api/frontier/pilots/portal/dashboard-weather";

type Props = {
  fallbackMetar: HomeBaseMetar | null;
  weatherBriefHref: string;
};

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

export function DashboardWeatherWidgetClient({ fallbackMetar, weatherBriefHref }: Props) {
  const [metar, setMetar] = useState<HomeBaseMetar | null>(fallbackMetar);
  const [geoActive, setGeoActive] = useState(false);

  useEffect(() => {
    let dead = false;

    void (async () => {
      try {
        const pos = await readPosition(GEO_TIMEOUT_MS);
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
        // Silent fallback: keep server METAR or stay hidden if none.
      }
    })();

    return () => {
      dead = true;
    };
  }, []);

  if (!metar) return null;

  return (
    <DashboardWeatherWidget
      metar={metar}
      weatherBriefHref={weatherBriefHref}
      sourceLabel={geoActive ? "Near you" : null}
    />
  );
}
