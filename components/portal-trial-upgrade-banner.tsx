"use client";

import { useState } from "react";

type BannerProps = {
  displayName: string;
  status: "expiring_soon" | "expiring_urgent";
  daysRemaining: number;
  foundingPilotCount: number;
  foundingPilotCap: number;
  foundingPilotSpotsRemaining: number;
};

/** First word of trimmed displayName; null if unusable for personalization. */
function getBannerFirstName(displayName: string): string | null {
  const trimmed = displayName.trim();
  if (!trimmed) return null;
  const firstWord = trimmed.split(/\s+/).find(Boolean) ?? "";
  if (!firstWord) return null;
  if (firstWord.toLowerCase() === "user") return null;
  return firstWord;
}

export function PortalTrialUpgradeBanner(props: BannerProps) {
  const { displayName, status, daysRemaining, foundingPilotSpotsRemaining } = props;
  const [loading, setLoading] = useState(false);
  const firstName = getBannerFirstName(displayName);
  const N = daysRemaining;
  const primary = firstName
    ? `${firstName}, your Pro trial ends in ${N} day${N === 1 ? "" : "s"}. Upgrade to keep your advanced tools active.`
    : `Your Pro trial ends in ${N} day${N === 1 ? "" : "s"}. Upgrade to keep your advanced tools active.`;
  const showFoundingLine = foundingPilotSpotsRemaining > 0;
  const isUrgent = status === "expiring_urgent";

  async function handleUpgrade() {
    setLoading(true);
    const checkoutTab = window.open("about:blank", "_blank", "noopener,noreferrer");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval: "founding_pilot_annual" }),
      });
      const data = await res.json();
      if (data.url) {
        if (checkoutTab) {
          checkoutTab.location.href = data.url;
        } else {
          window.open(data.url, "_blank", "noopener,noreferrer");
        }
      } else {
        checkoutTab?.close();
      }
    } catch {
      checkoutTab?.close();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={[
        "mb-4 rounded-xl border px-4 py-3.5 text-sm shadow-sm ring-1 backdrop-blur-sm",
        isUrgent
          ? "border-amber-400/85 bg-gradient-to-br from-amber-50 via-amber-50/95 to-amber-100/80 text-amber-950 ring-amber-400/35 dark:from-amber-950/55 dark:via-amber-950/40 dark:to-amber-900/35 dark:text-amber-50 dark:border-amber-500/55 dark:ring-amber-500/25"
          : "border-amber-300/80 bg-gradient-to-br from-amber-50/98 via-white to-amber-50/90 text-amber-950 ring-amber-300/30 dark:from-amber-950/45 dark:via-amber-950/30 dark:to-slate-900/40 dark:text-amber-100 dark:border-amber-600/40 dark:ring-amber-600/20",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="min-w-0 font-medium leading-snug text-amber-950 dark:text-amber-50">{primary}</p>
          {showFoundingLine ? (
            <p className="text-xs font-normal leading-snug text-amber-800/90 dark:text-amber-200/85">
              Founding Pilot spots still available — Limited to 100 pilots at your Airline.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleUpgrade}
          disabled={loading}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow transition disabled:opacity-50 ${
            isUrgent
              ? "bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500"
              : "bg-amber-700/90 hover:bg-amber-800 dark:bg-amber-600/95 dark:hover:bg-amber-600"
          }`}
        >
          {loading ? "Opening…" : "Upgrade to Pro"}
        </button>
      </div>
    </div>
  );
}
