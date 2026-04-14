"use client";

export type AccessBadgeSurface = "dark" | "light";

export function AccessBadge({
  aiEnabled,
  surface = "dark",
}: {
  aiEnabled: boolean;
  /** `light` for white / admin cards; `dark` for portal slate cards. */
  surface?: AccessBadgeSurface;
}) {
  if (aiEnabled) {
    if (surface === "light") {
      return (
        <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900">
          AI Enabled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-200">
        AI Enabled
      </span>
    );
  }

  if (surface === "light") {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
        Download only
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium text-slate-300">
      Download only
    </span>
  );
}
