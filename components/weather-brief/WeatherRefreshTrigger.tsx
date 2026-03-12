"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const MS_PER_MINUTE = 60 * 1000;
const HOURS_24_MS = 24 * 60 * MS_PER_MINUTE;
const HOURS_6_MS = 6 * 60 * MS_PER_MINUTE;
const INTERVAL_30_MIN_MS = 30 * MS_PER_MINUTE;
const INTERVAL_15_MIN_MS = 15 * MS_PER_MINUTE;

type Props = {
  departureIso: string | null | undefined;
};

function getIntervalMs(depTime: number): number | null {
  const remaining = depTime - Date.now();
  if (remaining <= 0 || remaining > HOURS_24_MS) return null;
  return remaining > HOURS_6_MS ? INTERVAL_30_MIN_MS : INTERVAL_15_MIN_MS;
}

export function WeatherRefreshTrigger({ departureIso }: Props) {
  const router = useRouter();
  const lastRefreshRef = useRef<number>(0);

  useEffect(() => {
    if (!departureIso) return;

    const depTime = new Date(departureIso).getTime();
    if (Number.isNaN(depTime)) return;

    const tick = () => {
      const intervalMs = getIntervalMs(depTime);
      if (intervalMs === null) return;

      const now = Date.now();
      const elapsed = now - lastRefreshRef.current;
      if (lastRefreshRef.current === 0 || elapsed >= intervalMs) {
        lastRefreshRef.current = now;
        router.refresh();
      }
    };

    if (getIntervalMs(depTime) === null) return;

    const id = setInterval(tick, MS_PER_MINUTE);

    return () => clearInterval(id);
  }, [departureIso, router]);

  return null;
}
