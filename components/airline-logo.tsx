"use client";

import * as React from "react";
import { getLocalAirlineLogoPath, getAirlineLogoUrl } from "@/lib/airlines";

/** Frontier-style container: rounded-xl, soft border, subtle shadow */
const LOGO_CONTAINER_CLASS =
  "inline-flex items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5 p-0.5 shadow-[0_0_15px_rgba(255,255,255,0.06)]";

export function AirlineLogo({
  carrier,
  size = 24,
  className = "",
}: {
  carrier: string;
  size?: number;
  className?: string;
}) {
  const [loadState, setLoadState] = React.useState<"local" | "favicon" | "failed">("local");
  const code = (carrier ?? "").trim().toUpperCase().slice(0, 2);
  if (!code) return null;

  const localPath = getLocalAirlineLogoPath(carrier);
  const faviconUrl = getAirlineLogoUrl(carrier);

  // Fallback badge when no image available
  if (loadState === "failed" || (!localPath && !faviconUrl)) {
    return (
      <span
        className={[
          LOGO_CONTAINER_CLASS,
          "bg-slate-800/60 text-slate-200 font-semibold tabular-nums",
          className,
        ].join(" ")}
        style={{ width: size, height: size, fontSize: Math.max(10, Math.floor(size * 0.5)) }}
        title={carrier}
      >
        {code}
      </span>
    );
  }

  const currentSrc =
    loadState === "local" && localPath
      ? localPath
      : loadState === "favicon" && faviconUrl
        ? faviconUrl
        : null;

  if (!currentSrc) {
    return (
      <span
        className={[
          LOGO_CONTAINER_CLASS,
          "bg-slate-800/60 text-slate-200 font-semibold tabular-nums",
          className,
        ].join(" ")}
        style={{ width: size, height: size, fontSize: Math.max(10, Math.floor(size * 0.5)) }}
        title={carrier}
      >
        {code}
      </span>
    );
  }

  return (
    <span
      className={[LOGO_CONTAINER_CLASS, "shrink-0", className].join(" ")}
      style={{ width: size, height: size }}
      title={carrier}
    >
      <img
        key={currentSrc}
        src={currentSrc}
        alt={`${carrier} logo`}
        width={size - 4}
        height={size - 4}
        className="object-contain"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => {
          if (loadState === "local" && faviconUrl) setLoadState("favicon");
          else setLoadState("failed");
        }}
      />
    </span>
  );
}
