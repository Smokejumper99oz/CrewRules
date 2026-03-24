"use client";

import { useState } from "react";

type BannerProps = {
  status: "expiring_soon" | "expiring_urgent";
  daysRemaining: number;
};

function getBannerCopy(daysRemaining: number): string {
  if (daysRemaining === 1) {
    return "Your Pro trial ends tomorrow. Upgrade now to keep your advanced tools.";
  }
  if (daysRemaining === 3) {
    return "Your Pro trial ends in 3 days. Upgrade now to keep your advanced tools.";
  }
  if (daysRemaining === 7) {
    return "Your Pro trial ends in 7 days. Upgrade to keep your advanced tools.";
  }
  if (daysRemaining <= 3) {
    return `Your Pro trial ends in ${daysRemaining} days. Upgrade now to keep your advanced tools.`;
  }
  return `Your Pro trial ends in ${daysRemaining} days. Upgrade to keep your advanced tools.`;
}

export function PortalTrialUpgradeBanner({ status, daysRemaining }: BannerProps) {
  const [loading, setLoading] = useState(false);
  const copy = getBannerCopy(daysRemaining);
  const isUrgent = status === "expiring_urgent";

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval: "founding_pilot_annual" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <div
      className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
        isUrgent
          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-600/40 dark:bg-amber-950/20 dark:text-amber-100"
          : "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600/40 dark:bg-slate-800/50 dark:text-slate-200"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1">{copy}</p>
        <button
          type="button"
          onClick={handleUpgrade}
          disabled={loading}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
            isUrgent
              ? "bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600/80 dark:hover:bg-amber-600"
              : "bg-slate-600 text-white hover:bg-slate-700 dark:bg-slate-700/80 dark:hover:bg-slate-700"
          }`}
        >
          {loading ? "Redirecting…" : "Upgrade to Pro"}
        </button>
      </div>
    </div>
  );
}
