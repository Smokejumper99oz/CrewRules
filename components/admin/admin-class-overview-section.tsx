"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarRange } from "lucide-react";
import {
  FRONTIER_CLASS_OVERVIEW_TEST_COHORT_YMD,
  type AdminClassOverviewHealth,
  type AdminClassOverviewRow,
} from "@/lib/mentoring/frontier-admin-class-overview";
import { ClassOverviewHelpPopover } from "@/components/admin/class-overview-help-popover";

/** Three-band cards (header / metrics / footer) aligned with admin class-overview mockups. */
const CLASS_OVERVIEW_HEALTH: Record<
  AdminClassOverviewHealth,
  {
    shell: string;
    header: string;
    headerTitleClass: string;
    middle: string;
    footer: string;
    middleText: string;
    statusText: string;
    statusClass: string;
    statusTitleClass: string;
  }
> = {
  healthy: {
    shell: "border border-emerald-200/90 bg-white shadow-sm ring-1 ring-emerald-100/60",
    header: "bg-[#77B368]",
    headerTitleClass: "text-left",
    middle: "bg-[#F1F5F0]",
    footer: "bg-[#D4E6CA]",
    middleText: "text-[#1a2b4b]",
    statusText: "Healthy",
    statusClass: "font-semibold text-black",
    statusTitleClass: "text-left",
  },
  watch: {
    shell: "border border-amber-200/90 bg-white shadow-sm ring-1 ring-amber-100/70",
    header: "bg-amber-600",
    headerTitleClass: "text-left",
    middle: "bg-amber-50/90",
    footer: "bg-amber-100/95",
    middleText: "text-[#1a2b4b]",
    statusText: "Monitor",
    statusClass: "font-semibold text-amber-950",
    statusTitleClass: "text-left",
  },
  needs_work: {
    shell: "border border-red-200/90 bg-white shadow-sm ring-1 ring-red-100/70",
    header: "bg-[#E15356]",
    headerTitleClass: "text-left",
    middle: "bg-[#FDF7F7]",
    footer: "bg-[#F0DCDC]",
    middleText: "text-red-800",
    statusText: "Needs Attention",
    statusClass: "font-bold text-red-900",
    statusTitleClass: "text-left",
  },
};

type YearFilter = "all" | 2025 | 2026;
type QuarterNum = 1 | 2 | 3 | 4;
type QuarterFilter = QuarterNum | null;

/** Default year filter: current calendar year when 2025/2026, otherwise show all cohorts. */
function defaultClassOverviewYearFilter(): YearFilter {
  const y = new Date().getFullYear();
  if (y === 2025 || y === 2026) return y;
  return "all";
}

/** Same shell as `FailedMilestoneReviewRowActions` (Resolve / Archive) for admin UI consistency. */
const yearFilterBtnBase =
  "inline-flex shrink-0 items-center justify-center rounded-md border px-2 py-1 text-[11px] font-semibold leading-none tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2";

function monthFromYmd(ymd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return Number.parseInt(ymd.slice(5, 7), 10);
}

function quarterForMonth(m: number): QuarterNum {
  if (m <= 3) return 1;
  if (m <= 6) return 2;
  if (m <= 9) return 3;
  return 4;
}

function rowInYearQuarter(ymd: string, year: 2025 | 2026, q: QuarterNum): boolean {
  if (!ymd.startsWith(`${year}-`)) return false;
  const m = monthFromYmd(ymd);
  if (m == null || m < 1 || m > 12) return false;
  return quarterForMonth(m) === q;
}

/** Calendar quarter (Q1–Q4) for a cohort date, any year — used when year filter is “All”. */
function rowInQuarterAnyYear(ymd: string, q: QuarterNum): boolean {
  const m = monthFromYmd(ymd);
  if (m == null || m < 1 || m > 12) return false;
  return quarterForMonth(m) === q;
}

function AllYearPill({ active, onSelectAll }: { active: boolean; onSelectAll: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelectAll();
      }}
      aria-pressed={active}
      className={`${yearFilterBtnBase} min-w-[calc(1rem+4ch)] ${
        active
          ? "border-emerald-600/40 bg-emerald-50 text-emerald-800 hover:border-emerald-500/60 hover:bg-emerald-100"
          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
      }`}
    >
      All
    </button>
  );
}

function YearPill({
  label,
  active,
  year,
  onSelectYear,
}: {
  label: string;
  active: boolean;
  year: 2025 | 2026;
  onSelectYear: (y: 2025 | 2026) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelectYear(year);
      }}
      aria-pressed={active}
      className={`${yearFilterBtnBase} ${
        active
          ? "border-emerald-600/40 bg-emerald-50 text-emerald-800 hover:border-emerald-500/60 hover:bg-emerald-100"
          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function QuarterPill({
  label,
  active,
  disabled,
  tooltip,
  quarter,
  onSelectQuarter,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  tooltip?: string;
  quarter: QuarterNum;
  onSelectQuarter: (q: QuarterNum) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={tooltip}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) onSelectQuarter(quarter);
      }}
      aria-pressed={active}
      className={`${yearFilterBtnBase} ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-80"
          : active
            ? "border-emerald-600/40 bg-emerald-50 text-emerald-800 hover:border-emerald-500/60 hover:bg-emerald-100"
            : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

export function AdminClassOverviewSection({
  classOverview,
  base,
}: {
  classOverview: AdminClassOverviewRow[];
  base: string;
}) {
  const [yearFilter, setYearFilter] = useState<YearFilter>(defaultClassOverviewYearFilter);
  const [quarterFilter, setQuarterFilter] = useState<QuarterFilter>(null);

  useEffect(() => {
    if (yearFilter !== "all" && yearFilter !== 2025 && yearFilter !== 2026) {
      setYearFilter("all");
      setQuarterFilter(null);
    }
    if (
      quarterFilter !== null &&
      quarterFilter !== 1 &&
      quarterFilter !== 2 &&
      quarterFilter !== 3 &&
      quarterFilter !== 4
    ) {
      setQuarterFilter(null);
    }
  }, [yearFilter, quarterFilter]);

  /** Selected calendar year for filtering, or null when showing all years. */
  const activeYear: 2025 | 2026 | null = yearFilter === 2025 || yearFilter === 2026 ? yearFilter : null;
  const activeQuarter: QuarterFilter =
    quarterFilter === 1 || quarterFilter === 2 || quarterFilter === 3 || quarterFilter === 4
      ? quarterFilter
      : null;

  const quarterHasData = useMemo(() => {
    const flags: Record<QuarterNum, boolean> = { 1: false, 2: false, 3: false, 4: false };
    if (activeYear != null) {
      for (const r of classOverview) {
        if (!r.classDateYmd.startsWith(`${activeYear}-`)) continue;
        for (const q of [1, 2, 3, 4] as const) {
          if (rowInYearQuarter(r.classDateYmd, activeYear, q)) flags[q] = true;
        }
      }
    } else {
      for (const r of classOverview) {
        for (const q of [1, 2, 3, 4] as const) {
          if (rowInQuarterAnyYear(r.classDateYmd, q)) flags[q] = true;
        }
      }
    }
    return flags;
  }, [classOverview, activeYear]);

  const filtered = useMemo(() => {
    let rows = classOverview;
    if (activeYear != null) {
      rows = rows.filter((c) => c.classDateYmd.startsWith(`${activeYear}-`));
      if (activeQuarter != null) {
        rows = rows.filter((c) => rowInYearQuarter(c.classDateYmd, activeYear, activeQuarter));
      }
    } else if (activeQuarter != null) {
      rows = rows.filter((c) => rowInQuarterAnyYear(c.classDateYmd, activeQuarter));
    }
    return rows;
  }, [classOverview, activeYear, activeQuarter]);

  function handleSelectYear(y: YearFilter) {
    setQuarterFilter(null);
    if (y === "all") {
      setYearFilter("all");
      return;
    }
    setYearFilter((prev) => (prev === y ? "all" : y));
  }

  function handleSelectQuarter(q: QuarterNum) {
    if (!quarterHasData[q]) return;
    setQuarterFilter((prev) => (prev === q ? null : q));
  }

  return (
    <section className="overflow-x-hidden overflow-y-visible rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100">
      <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-0">
          <div className="flex min-w-0 w-full flex-wrap items-start justify-between gap-x-2 gap-y-0.5">
            <div className="min-w-0 max-w-full">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 sm:gap-x-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200/80">
                  <CalendarRange className="h-4 w-4" aria-hidden />
                </div>
                <h2 className="shrink-0 text-sm font-semibold uppercase tracking-wider text-[#1a2b4b]">
                  Class overview
                </h2>
                <ClassOverviewHelpPopover />
              </div>
            </div>
            <div
              className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1"
              role="group"
              aria-label="Filter by class year or all years"
            >
              <AllYearPill active={yearFilter === "all"} onSelectAll={() => handleSelectYear("all")} />
              <YearPill label="2025" year={2025} active={yearFilter === 2025} onSelectYear={handleSelectYear} />
              <YearPill label="2026" year={2026} active={yearFilter === 2026} onSelectYear={handleSelectYear} />
            </div>
          </div>
          <div
            className="flex w-full flex-wrap items-center justify-end gap-1"
            role="group"
            aria-label={
              activeYear != null
                ? `${activeYear} quarter`
                : "Calendar quarter (all years shown when no quarter is selected)"
            }
          >
            {([1, 2, 3, 4] as const).map((q) => (
              <QuarterPill
                key={q}
                label={`Q${q}`}
                quarter={q}
                active={activeQuarter === q}
                disabled={!quarterHasData[q]}
                tooltip={
                  !quarterHasData[q]
                    ? activeYear != null
                      ? "No classes in this quarter for the selected year"
                      : "No classes in this quarter across all cohorts in this window"
                    : undefined
                }
                onSelectQuarter={handleSelectQuarter}
              />
            ))}
          </div>
        </div>
      </div>

      {classOverview.length === 0 ? (
        <p className="px-4 py-8 text-sm text-slate-600 sm:px-5">
          No hire-date cohorts in this window, or no parseable dates on roster rows.
        </p>
      ) : filtered.length === 0 ? (
        <p className="px-4 py-8 text-sm text-slate-600 sm:px-5">
          {activeYear != null && activeQuarter != null
            ? `No classes for ${activeYear} Q${activeQuarter} in this window. Pick another quarter, clear the quarter (click Q${activeQuarter} again), or change year.`
            : activeYear != null
              ? `No classes for ${activeYear} in this window. Choose All, the other year, or clear the quarter to see more cohorts.`
              : activeQuarter != null
                ? `No classes in Q${activeQuarter} across all years in this window. Pick another quarter or clear the quarter (click Q${activeQuarter} again).`
                : "No cohorts match the current filters in this roster window."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 p-3 min-[440px]:grid-cols-2 sm:grid-cols-3 sm:gap-2.5 sm:p-3 lg:grid-cols-4">
          {filtered.map((c) => {
            const h = CLASS_OVERVIEW_HEALTH[c.health];
            const isTestCohort = c.classDateYmd === FRONTIER_CLASS_OVERVIEW_TEST_COHORT_YMD;
            return (
              <Link
                key={c.classDateYmd}
                href={`${base}/mentoring/mentee-roster?class=${encodeURIComponent(c.classDateYmd)}`}
                className={`group flex w-full min-w-0 flex-col overflow-hidden rounded-md transition hover:brightness-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${h.shell}`}
              >
                <div className={`min-w-0 px-1.5 py-1 ${h.header}`}>
                  <p
                    className={`truncate text-[12px] font-bold leading-tight text-white sm:text-[13px] ${h.headerTitleClass}`}
                  >
                    {c.label}
                    {isTestCohort ? (
                      <span
                        className={
                          c.health === "watch"
                            ? "ml-1 text-amber-950"
                            : "ml-1 text-amber-200 sm:text-amber-100"
                        }
                      >
                        TEST
                      </span>
                    ) : null}
                  </p>
                </div>
                <div
                  className={`flex min-w-0 flex-row flex-nowrap items-center justify-between px-1.5 py-1 ${h.middle}`}
                >
                  <p
                    className={`min-w-0 truncate text-[11px] leading-none sm:text-[12px] ${h.middleText}`}
                  >
                    <strong className="font-bold tabular-nums">{c.pilots}</strong>{" "}
                    <span className="font-normal text-black">{c.pilots === 1 ? "Pilot" : "Pilots"}</span>
                  </p>
                  <p
                    className={`shrink-0 whitespace-nowrap text-[11px] leading-none sm:text-[12px] ${h.middleText}`}
                  >
                    <strong className="font-bold tabular-nums">{c.matchedPct}%</strong>{" "}
                    <span className="font-normal text-black">Matched</span>
                  </p>
                </div>
                <div className={`min-w-0 px-1.5 py-1 ${h.footer}`}>
                  <p
                    className={`text-[10px] tracking-wide sm:text-[11px] ${h.statusTitleClass} ${h.statusClass}`}
                  >
                    {h.statusText}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
