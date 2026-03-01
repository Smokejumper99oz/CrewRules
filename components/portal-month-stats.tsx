"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMinutesToHhMm } from "@/lib/schedule-time";
import type { MonthOption, MonthStats } from "@/app/frontier/pilots/portal/schedule/actions";

type Props = {
  tenant: string;
  portal: string;
  availableMonths: MonthOption[];
  statsByMonth: Record<string, MonthStats>;
};

function monthKey(year: number, month: number): string {
  return `${year}-${month}`;
}

export function PortalMonthStatsClient({ tenant, portal, availableMonths, statsByMonth }: Props) {
  const nowYear = new Date().getFullYear();
  const nowMonth = new Date().getMonth();
  const currentIndex = availableMonths.findIndex((m) => m.year === nowYear && m.month === nowMonth);
  const [selectedIndex, setSelectedIndex] = useState(currentIndex >= 0 ? currentIndex : 0);
  const scheduleHref = `/${tenant}/${portal}/portal/schedule`;

  const selectedMonth = availableMonths[selectedIndex];
  const stats = selectedMonth ? statsByMonth[monthKey(selectedMonth.year, selectedMonth.month)] : null;

  if (!stats || availableMonths.length === 0) return null;

  return (
    <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20">
      <div className="flex flex-col gap-3 border-b border-white/5 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">Month at a Glance</h2>
          {availableMonths.length > 1 && (
            <div className="flex rounded-lg border border-white/10 p-0.5">
              {availableMonths.map((m, i) => (
                <button
                  key={monthKey(m.year, m.month)}
                  type="button"
                  onClick={() => setSelectedIndex(i)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    i === selectedIndex
                      ? "bg-white/10 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {m.shortLabel}
                </button>
              ))}
            </div>
          )}
        </div>
        <Link href={scheduleHref} className="text-sm font-medium text-[#75C043] hover:underline shrink-0">
          View schedule →
        </Link>
      </div>
      <div className="mt-4">
        <p className="mb-3 text-sm text-slate-400">{selectedMonth?.label}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-emerald-300">{stats.trip}</p>
            <p className="text-xs text-slate-400">Trips</p>
          </div>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-blue-300">{stats.reserve}</p>
            <p className="text-xs text-slate-400">Reserve days</p>
          </div>
          <div className="rounded-xl border border-slate-500/20 bg-slate-500/5 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-slate-300">{stats.vacationOff}</p>
            <p className="text-xs text-slate-400">Days off</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-amber-300">
              {stats.totalCredit != null && stats.totalCredit > 0
                ? formatMinutesToHhMm(Math.round(stats.totalCredit * 60))
                : "0:00"}
            </p>
            <p className="text-xs text-slate-400">
              Credit
              {((stats.totalBlock ?? 0) > 0 || (stats.totalExtraCredit ?? 0) > 0) && (
                <span className="mt-0.5 block text-slate-500">
                  Block {formatMinutesToHhMm(Math.round((stats.totalBlock ?? 0) * 60))}
                  {(stats.totalExtraCredit ?? 0) > 0 && (
                    <> • +{formatMinutesToHhMm(Math.round((stats.totalExtraCredit ?? 0) * 60))}</>
                  )}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
