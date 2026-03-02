"use client";

import { useState, useTransition, useOptimistic, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { formatMinutesToHhMm } from "@/lib/schedule-time";
import type { MonthOption, MonthStats } from "@/app/frontier/pilots/portal/schedule/actions";
import { setShowPayProjection } from "@/app/frontier/pilots/portal/profile/actions";

const formatUSD = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

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
  const router = useRouter();
  const nowYear = new Date().getFullYear();
  const nowMonth = new Date().getMonth();
  const currentIndex = availableMonths.findIndex((m) => m.year === nowYear && m.month === nowMonth);
  const [selectedIndex, setSelectedIndex] = useState(currentIndex >= 0 ? currentIndex : 0);
  const scheduleHref = `/${tenant}/${portal}/portal/schedule`;

  const selectedMonth = availableMonths[selectedIndex];
  const stats = selectedMonth ? statsByMonth[monthKey(selectedMonth.year, selectedMonth.month)] : null;

  const [isPending, startTransition] = useTransition();
  // stats.payHidden is true when show_pay_projection is false
  const [optimisticShow, setOptimisticShow] = useOptimistic(
    stats ? !stats.payHidden : false,
    (_prev, next: boolean) => next
  );

  const onTogglePay = () => {
    const next = !optimisticShow;
    setOptimisticShow(next);

    startTransition(async () => {
      try {
        await setShowPayProjection(next);
        router.refresh();
      } catch {
        setOptimisticShow(!next);
      }
    });
  };

  const totalTarget = useMemo(() => {
    if (!optimisticShow || !stats?.payProjection) return 0;
    return stats.payProjection.totalGross ?? 0;
  }, [optimisticShow, stats?.payProjection]);

  const [animatedTotal, setAnimatedTotal] = useState(0);

  useEffect(() => {
    // reset when hidden or missing data
    if (!optimisticShow || !stats?.payProjection) {
      setAnimatedTotal(0);
      return;
    }

    const durationMs = 1800;
    const start = performance.now();
    const from = 0;
    const to = totalTarget;

    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // smooth ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedTotal(from + (to - from) * eased);

      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [totalTarget, optimisticShow]);

  if (!stats || availableMonths.length === 0) return null;

  return (
    <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20">
      <div className="flex flex-col gap-3 border-b border-white/5 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">Month Overview</h2>
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
                      : "text-slate-300 hover:text-slate-200"
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
        <p className="mb-3 text-sm text-slate-300">{selectedMonth?.label}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-emerald-300">{stats.trip}</p>
            <p className="text-xs text-slate-300">Trips</p>
          </div>
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-blue-300">{stats.reserve}</p>
            <p className="text-xs text-slate-300">Reserve days</p>
          </div>
          <div className="rounded-xl border border-slate-500/20 bg-slate-500/5 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-slate-300">{stats.vacationOff}</p>
            <p className="text-xs text-slate-300">Days off</p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-center">
            <div className="space-y-2">
              <div>
                <p className="text-2xl font-normal text-amber-300/80">
                  {formatMinutesToHhMm(stats.rawCreditMinutes ?? 0)}
                </p>
                <p className="text-xs text-slate-300">Credit</p>
              </div>
              <div className="border-t border-white/5 pt-2">
                <p className="text-xs font-normal text-amber-300/80">
                  {formatMinutesToHhMm(Math.round((stats.totalBlock ?? 0) * 60))}
                </p>
                <p className="text-xs text-slate-300">Block</p>
              </div>
            </div>
          </div>
        </div>
        {(stats.payHidden || stats.payProjection) && (
          <div
            className={`mt-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-slate-900/40 to-slate-950/40 px-5 py-4 shadow-[0_0_0_1px_rgba(16,185,129,0.12),0_20px_60px_rgba(0,0,0,0.35)] transition-all duration-200 hover:shadow-[0_0_0_1px_rgba(16,185,129,0.2),0_0_30px_rgba(16,185,129,0.1),0_20px_60px_rgba(0,0,0,0.35)] ${
              !optimisticShow ? "opacity-60 saturate-75" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-200/80">
                  Pay projection
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Based on your credited hours this month
                </p>
              </div>

              <button
                type="button"
                onClick={onTogglePay}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60"
                aria-label={optimisticShow ? "Hide pay" : "Show pay"}
                title={optimisticShow ? "Hide pay" : "Show pay"}
              >
                {optimisticShow ? (
                  <>
                    <Eye className="h-4 w-4" />
                    Visible
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Hidden
                  </>
                )}
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                <p className="text-xs text-slate-300">Estimated Payment</p>
                <p className="text-xs text-slate-300">(20th)</p>
                <p className="mt-1 font-semibold tracking-tight text-emerald-200">
                  {optimisticShow && stats.payProjection
                    ? formatUSD(stats.payProjection.pay20thGross)
                    : "••••••"}
                </p>
              </div>

              <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                <p className="text-xs text-slate-300">Estimated Payment</p>
                <p className="text-xs text-slate-300">(5th)</p>
                <p className="mt-1 text-base font-medium tracking-tight text-emerald-200/90">
                  {optimisticShow && stats.payProjection
                    ? formatUSD(stats.payProjection.pay5thGross)
                    : "••••••"}
                </p>
              </div>

              <div className="relative overflow-hidden rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
                {/* subtle glow */}
                <div className="pointer-events-none absolute -inset-10 opacity-40 blur-2xl bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.35),transparent_60%)]" />
                <div className="pointer-events-none absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.25),transparent_70%)]" />

                <p className="relative text-xs font-bold text-emerald-100/80 leading-tight">
                  Estimated Monthly <span className="text-emerald-100/60">(Total)</span>
                </p>

                <p className="relative mt-1 text-xl font-bold tracking-tight text-emerald-100">
                  {optimisticShow && stats.payProjection
                    ? formatUSD(animatedTotal)
                    : "••••••"}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
              {optimisticShow && stats.payProjection ? (
                <span>
                  Rate{" "}
                  <span className="font-semibold text-emerald-300">
                    {formatUSD(stats.payProjection.rate)}/hr
                  </span>{" "}
                  • Year {stats.payProjection.year}
                </span>
              ) : (
                <span className="text-slate-500">—</span>
              )}
              <span className="italic text-slate-300">
                Tap the eye to hide pay before showing your dashboard.
              </span>
            </div>

            <div className="mt-3 border-t border-white/[0.12] pt-3">
              <p className="text-[11px] text-slate-500">
                CrewRules™ provides pay estimates only (before tax) and is not an official Frontier Airlines pay statement.
                For pay questions or discrepancies, please contact the Frontier Airlines Payroll Department.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
