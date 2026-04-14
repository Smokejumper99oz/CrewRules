/**
 * Fields read from mentee roster rows for class cohorts (same shape as `MenteeRosterRow`).
 * Declared here so this module does not import `"use client"` UI — avoids RSC/webpack graph issues.
 */
export type AdminClassOverviewRosterInput = {
  hire_date: string | null;
  status: "live" | "not_live" | "unassigned";
};

/**
 * Normalize hire_date / DOH to YYYY-MM-DD for cohort key.
 * Keep in sync with `hireDateToYyyyMmDd` in `mentee-roster-table.tsx` (class filter).
 */
function hireDateToYyyyMmDd(value: string | null | undefined): string | null {
  if (value == null || !String(value).trim()) return null;
  const raw = String(value).trim();
  const head = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
  const mdY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (mdY) {
    const m = Number(mdY[1]);
    const d = Number(mdY[2]);
    const y = Number(mdY[3]);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addMonthsLocal(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatClassLabel(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [ys, ms, ds] = ymd.split("-");
  const dt = new Date(Number(ys), Number(ms) - 1, Number(ds));
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Hire cohort reserved for test mentee data — not a real training class. */
export const FRONTIER_CLASS_OVERVIEW_TEST_COHORT_YMD = "2026-04-01";

/** Locale date plus a plain-text test marker when `ymd` is {@link FRONTIER_CLASS_OVERVIEW_TEST_COHORT_YMD} (e.g. native `<select>` options). */
export function formatFrontierAdminClassCohortLabel(ymd: string): string {
  const base = formatClassLabel(ymd);
  return ymd === FRONTIER_CLASS_OVERVIEW_TEST_COHORT_YMD ? `${base} · TEST` : base;
}

export type AdminClassOverviewHealth = "healthy" | "watch" | "needs_work";

export type AdminClassOverviewRow = {
  /** Normalized cohort date (YYYY-MM-DD), same key as Mentee Roster class filter. */
  classDateYmd: string;
  /** e.g. Jan 15, 2026 (locale); test cohort uses `classDateYmd` — overview card adds amber “TEST”. */
  label: string;
  pilots: number;
  matchedCount: number;
  matchedPct: number;
  health: AdminClassOverviewHealth;
};

/**
 * Read-only aggregates for the Frontier admin dashboard: one card per distinct hire date
 * in the mentee roster (same definition as the roster “Class” filter). No DB access.
 *
 * Window: inclusive hire dates from 12 calendar months before today through 12 calendar
 * months after today (local date), so near-future classes appear alongside recent cohorts.
 */
export function buildFrontierClassOverviewFromRoster(roster: AdminClassOverviewRosterInput[]): AdminClassOverviewRow[] {
  const now = new Date();
  const startYmd = formatLocalYmd(addMonthsLocal(now, -12));
  const endYmd = formatLocalYmd(addMonthsLocal(now, 12));

  const byYmd = new Map<string, { pilots: number; matched: number }>();

  for (const row of roster) {
    const ymd = hireDateToYyyyMmDd(row.hire_date);
    if (!ymd || ymd < startYmd || ymd > endYmd) continue;
    const cur = byYmd.get(ymd) ?? { pilots: 0, matched: 0 };
    cur.pilots += 1;
    if (row.status !== "unassigned") cur.matched += 1;
    byYmd.set(ymd, cur);
  }

  const rows: AdminClassOverviewRow[] = [];
  for (const [classDateYmd, { pilots, matched }] of byYmd) {
    const ratio = pilots > 0 ? matched / pilots : 0;
    const matchedPct = Math.round(ratio * 100);
    let health: AdminClassOverviewHealth;
    if (matched === pilots) {
      health = "healthy";
    } else if (ratio >= 0.85) {
      health = "watch";
    } else {
      health = "needs_work";
    }

    rows.push({
      classDateYmd,
      label: formatClassLabel(classDateYmd),
      pilots,
      matchedCount: matched,
      matchedPct,
      health,
    });
  }

  rows.sort((a, b) => a.classDateYmd.localeCompare(b.classDateYmd));
  return rows;
}
