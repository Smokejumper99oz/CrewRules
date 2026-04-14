"use client";

export type AIStatusBadgeSurface = "dark" | "light";

const darkStyles: Record<
  "active" | "not_enabled" | "processing",
  { dot: string; label: string; className: string }
> = {
  active: { dot: "🟢", label: "AI Search: Active", className: "bg-white/5 text-emerald-400" },
  processing: {
    dot: "🟡",
    label: "AI Search: Processing",
    className: "bg-white/5 text-amber-400",
  },
  not_enabled: { dot: "🔴", label: "AI Search: Not Enabled", className: "bg-white/5 text-red-400" },
};

const lightStyles: Record<
  "active" | "not_enabled" | "processing",
  { dot: string; label: string; className: string }
> = {
  active: {
    dot: "🟢",
    label: "AI Search: Active",
    className: "border border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  processing: {
    dot: "🟡",
    label: "AI Search: Processing",
    className: "border border-amber-200 bg-amber-50 text-amber-900",
  },
  not_enabled: {
    dot: "⏸",
    label: "AI Search: Not Enabled",
    className: "border border-slate-200 bg-slate-100 text-slate-800",
  },
};

export function AIStatusBadge({
  status,
  indexing,
  surface = "dark",
}: {
  status: "active" | "not_enabled" | "processing";
  indexing?: boolean;
  /** `light` for white / admin cards; `dark` for portal slate cards. */
  surface?: AIStatusBadgeSurface;
}) {
  const effective = indexing ? "processing" : status;
  const config = (surface === "light" ? lightStyles : darkStyles)[effective];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.className}`}
    >
      <span aria-hidden>{config.dot}</span>
      <span>{config.label}</span>
    </span>
  );
}
