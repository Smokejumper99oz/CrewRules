"use client";

import { AlertTriangle, Clock } from "lucide-react";

function formatMinutesRemaining(minutes: number): string {
  const m = Math.abs(Math.floor(minutes));
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return min > 0
      ? `${h} hour${h !== 1 ? "s" : ""} ${min} minute${min !== 1 ? "s" : ""}`
      : `${h} hour${h !== 1 ? "s" : ""}`;
  }
  return `${m} minute${m !== 1 ? "s" : ""}`;
}

function formatMinutesToHMM(totalMinutes: number): string {
  const m = Math.floor(totalMinutes);
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h}:${String(min).padStart(2, "0")}`;
}

export function Far117FdpBanner({
  remainingMinutes,
  maxFdpMinutes,
}: {
  remainingMinutes: number;
  maxFdpMinutes: number;
}) {
  if (remainingMinutes >= 30) return null;

  const severity =
    remainingMinutes < 0 ? "exceeded" : remainingMinutes < 10 ? "critical" : "watch";

  const isWatch = severity === "watch";
  const Icon = severity === "watch" ? Clock : AlertTriangle;
  const title =
    severity === "exceeded"
      ? "FAR 117 Exceeded"
      : severity === "critical"
        ? "FAR 117 Critical"
        : "FAR 117 Watch";
  const detail =
    severity === "exceeded"
      ? `Projected duty exceeds FDP by ${formatMinutesRemaining(remainingMinutes)}`
      : `Projected FDP Remaining: ${formatMinutesRemaining(remainingMinutes)}`;

  const borderClass = isWatch ? "border-yellow-500/50 bg-yellow-500/15" : "border-red-400/35 bg-red-500/10";
  const textClass = isWatch ? "text-white" : "text-red-200";
  const iconClass = isWatch ? "text-white" : "text-red-300";

  return (
    <div
      className={`mb-3 rounded-xl border px-4 py-2.5 ${borderClass}`}
      role="alert"
    >
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs ${textClass}`}>
        <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} aria-hidden />
        <span className="font-bold">{title}</span>
        <span className="opacity-90">{detail}</span>
        <span className="opacity-90">Max FDP: {formatMinutesToHMM(maxFdpMinutes)}</span>
      </div>
    </div>
  );
}
