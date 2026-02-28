"use client";

import { useEffect, useState } from "react";
import { toZonedTime } from "date-fns-tz/toZonedTime";

type Props = {
  startTime: string;
  endTime: string;
  timezone: string;
};

function formatRemaining(remainingMinutes: number): { timePart: string; suffix: string } {
  if (remainingMinutes < 1) return { timePart: "Ending now", suffix: "" };
  const m = Math.floor(remainingMinutes);
  if (m >= 60) {
    const hours = Math.floor(m / 60);
    const mins = m % 60;
    return { timePart: `${hours}h ${mins}m`, suffix: " remaining" };
  }
  return { timePart: `${m}m`, suffix: " remaining" };
}

export function OnDutyTimer({ startTime, endTime, timezone }: Props) {
  const [formatted, setFormatted] = useState<{ timePart: string; suffix: string }>({ timePart: "", suffix: "" });
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const startUtc = new Date(startTime);
      const endUtc = new Date(endTime);
      const nowUtc = new Date();
      const startLocal = toZonedTime(startUtc, timezone);
      const endLocal = toZonedTime(endUtc, timezone);
      const nowLocal = toZonedTime(nowUtc, timezone);
      const MS_PER_MIN = 60 * 1000;
      const totalMinutes = (endLocal.getTime() - startLocal.getTime()) / MS_PER_MIN;
      let elapsedMinutes = (nowLocal.getTime() - startLocal.getTime()) / MS_PER_MIN;
      if (elapsedMinutes < 0) elapsedMinutes = 0;
      if (elapsedMinutes > totalMinutes) elapsedMinutes = totalMinutes;
      const remainingMinutes = totalMinutes - elapsedMinutes;
      const progress = totalMinutes > 0 ? elapsedMinutes / totalMinutes : 0;
      setFormatted(formatRemaining(remainingMinutes));
      setProgress(progress * 100);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [startTime, endTime, timezone]);

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center gap-2 text-sm text-slate-300">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-3.5 w-3.5 shrink-0 text-slate-400"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
            clipRule="evenodd"
          />
        </svg>
        <span>
          <span className="font-medium">{formatted.timePart}</span>
          {formatted.suffix}
        </span>
      </div>
      <div className="h-0.5 overflow-hidden rounded-full bg-slate-800/90" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}
