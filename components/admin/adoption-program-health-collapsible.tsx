"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

type Props = {
  children: React.ReactNode;
  /** One-line metrics when collapsed (same numbers as the expanded cards). */
  collapsedSummary: string;
};

/**
 * Collapsible shell for the Adoption & Program Health dashboard block.
 * Default collapsed so the four metric cards stay out of the way until expanded.
 */
export function AdoptionProgramHealthCollapsible({ children, collapsedSummary }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      aria-labelledby="adoption-program-health-heading"
    >
      <div className="bg-slate-950">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`group w-full text-left transition hover:bg-slate-900/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#75C043]/50 ${open ? "border-b border-[#75C043]/40" : ""}`}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
            <span
              id="adoption-program-health-heading"
              role="heading"
              aria-level={2}
              className="min-w-0 flex-1 text-sm font-semibold tracking-tight text-white"
            >
              Crew<span className="text-[#75C043]">Rules</span>™{" "}
              <span className="font-normal text-white/70" aria-hidden="true">
                •
              </span>{" "}
              Adoption & Program Health
            </span>
            <span className="sr-only">{open ? "Collapse section" : "Expand section"}</span>
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:text-slate-300 ${open ? "rotate-90" : ""}`}
              aria-hidden
            />
          </div>
          {!open ? (
            <>
              <div className="mx-4 h-px shrink-0 bg-[#75C043]/40 sm:mx-5" aria-hidden />
              {/* Same bg as expanded body (`bg-white` on section + card area). */}
              <span className="block w-full rounded-b-xl bg-white px-4 pb-2.5 pt-2 text-left sm:px-5">
                <span
                  className="block truncate text-[11px] tabular-nums leading-snug text-slate-600"
                  title={collapsedSummary}
                >
                  {collapsedSummary}
                </span>
              </span>
            </>
          ) : null}
        </button>
      </div>
      {open ? <div className="p-3 sm:p-4">{children}</div> : null}
    </section>
  );
}
