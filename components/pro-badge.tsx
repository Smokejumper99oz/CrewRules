"use client";

import { Clock } from "lucide-react";

const VARIANT_CLASSES = {
  slate: {
    border: "border-slate-500/50",
    text: "text-slate-400",
    icon: "text-slate-400",
    shadow: "shadow-slate-500/10",
    bg: "bg-slate-900/70",
  },
  gold: {
    border: "border-amber-400/60",
    text: "text-amber-400",
    icon: "text-amber-400",
    shadow: "shadow-amber-500/10",
    bg: "bg-slate-900/70",
  },
  emerald: {
    border: "border-emerald-400/50",
    text: "text-slate-50",
    icon: "text-emerald-300",
    shadow: "shadow-emerald-500/15",
    bg: "bg-slate-900/70",
  },
  amber: {
    border: "border-amber-400/50",
    text: "text-amber-50",
    icon: "text-amber-300",
    shadow: "shadow-amber-500/15",
    bg: "bg-slate-900/70",
  },
  red: {
    border: "border-red-400/50",
    text: "text-red-50",
    icon: "text-red-300",
    shadow: "shadow-red-500/15",
    bg: "bg-slate-900/70",
  },
} as const;

type Props = {
  label: string | null;
  variant?: "slate" | "gold" | "emerald" | "amber" | "red";
  /** "sm" matches Up to date badge size for dashboard; "default" for larger badges elsewhere */
  size?: "sm" | "default";
};

export function ProBadge({ label, variant = "gold", size = "default" }: Props) {
  if (!label) return null;

  const c = VARIANT_CLASSES[variant];
  const bgClass = "bg" in c ? c.bg : "bg-slate-900/70";

  const isSm = size === "sm";
  const sizeClasses = isSm
    ? "gap-1.5 px-2.5 py-0.5 text-xs font-medium"
    : "gap-2 px-3 py-1 text-sm font-semibold tracking-wide shadow-sm";

  return (
    <div
      className={`inline-flex items-center rounded-full border ${sizeClasses} ${bgClass} ${c.border} ${c.text} ${c.shadow}`}
    >
      <Clock className={isSm ? `h-3 w-3 ${c.icon}` : `h-4 w-4 ${c.icon}`} />
      <span>{label}</span>
    </div>
  );
}
