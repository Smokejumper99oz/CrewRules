"use client";

import { Clock } from "lucide-react";

const VARIANT_CLASSES = {
  emerald: {
    border: "border-emerald-400/50",
    text: "text-slate-50",
    icon: "text-emerald-300",
    shadow: "shadow-emerald-500/15",
  },
  amber: {
    border: "border-amber-400/50",
    text: "text-amber-50",
    icon: "text-amber-300",
    shadow: "shadow-amber-500/15",
  },
  red: {
    border: "border-red-400/50",
    text: "text-red-50",
    icon: "text-red-300",
    shadow: "shadow-red-500/15",
  },
} as const;

type Props = {
  label: string | null;
  variant?: "emerald" | "amber" | "red";
};

export function ProBadge({ label, variant = "emerald" }: Props) {
  if (!label) return null;

  const c = VARIANT_CLASSES[variant];

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border bg-slate-900/70 px-3 py-1 text-sm font-semibold tracking-wide shadow-sm ${c.border} ${c.text} ${c.shadow}`}
    >
      <Clock className={`h-4 w-4 ${c.icon}`} />
      <span>{label}</span>
    </div>
  );
}
