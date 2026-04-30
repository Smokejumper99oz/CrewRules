"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

const CARD_CLASS =
  "rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] md:p-6";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  defaultOpen: boolean;
  children: ReactNode;
};

export function CollapsibleWeatherBriefSection({ title, subtitle, defaultOpen, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={CARD_CLASS}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 rounded-xl text-left text-white outline-none transition hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
      >
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold tracking-tight text-white">{title}</div>
          {subtitle != null && subtitle !== "" ? (
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        <ChevronDown
          className={`mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? <div className="mt-5 border-t border-white/10 pt-5">{children}</div> : null}
    </div>
  );
}
