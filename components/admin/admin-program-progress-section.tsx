import { BarChart3 } from "lucide-react";
import type { FrontierProgramProgressItem } from "@/lib/mentoring/frontier-admin-program-progress";

type Props = {
  items: FrontierProgramProgressItem[];
};

export function AdminProgramProgressSection({ items }: Props) {
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100">
      <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-2 sm:px-4">
        <div className="flex flex-wrap items-start gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200/80">
            <BarChart3 className="h-3.5 w-3.5" aria-hidden />
          </div>
          <h2 className="min-w-0 shrink pt-0.5 text-[11px] font-semibold uppercase leading-tight tracking-wider text-[#1a2b4b] sm:text-xs">
            Progress Through Program
          </h2>
        </div>
      </div>

      <div className="px-3 py-2 sm:px-4 sm:py-2.5">
        <ul className="flex flex-col gap-2.5">
          {items.map((row) => (
            <li key={row.milestoneType}>
              <div className="flex w-full min-w-0 items-center gap-2">
                <div className="flex min-w-0 shrink items-center gap-1.5 text-left">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-sky-500" aria-hidden />
                  <span className="min-w-0 text-[11px] font-medium leading-snug text-slate-800 sm:text-xs">
                    {row.label}
                  </span>
                </div>
                <div
                  className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200"
                  role="presentation"
                  aria-hidden
                >
                  <div
                    className="h-full rounded-full bg-sky-500"
                    style={{ width: `${Math.min(100, Math.max(0, row.pct))}%` }}
                  />
                </div>
                <span
                  className="w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums text-slate-700 sm:text-xs"
                  aria-label={`${row.label}: ${row.pct}%`}
                >
                  {row.pct}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
