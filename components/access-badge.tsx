"use client";

export function AccessBadge({ aiEnabled }: { aiEnabled: boolean }) {
  if (aiEnabled) {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-200">
        AI Enabled
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium text-slate-300">
      Download only
    </span>
  );
}
