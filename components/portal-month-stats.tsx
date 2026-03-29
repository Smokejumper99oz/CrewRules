"use client";

import { useState, useTransition, useOptimistic, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { formatMinutesToHhMm } from "@/lib/schedule-time";
import { ProBadge } from "@/components/pro-badge";
import { getPlanBadgeLabel, getPlanBadgeVariant } from "@/lib/profile-badge";
import type { MonthOption, MonthStats } from "@/app/frontier/pilots/portal/schedule/actions";
import { getBidPeriodForTimestamp, getFrontierBidPeriodTimezone } from "@/lib/frontier-bid-periods";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";
import { setShowPayProjection } from "@/app/frontier/pilots/portal/profile/actions";
import type { Profile } from "@/lib/profile";

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
  profile: Profile | null;
  availableMonths: MonthOption[];
  statsByMonth: Record<string, MonthStats>;
};

function monthKey(year: number, month: number): string {
  return `${year}-${month}`;
}

export function PortalMonthStatsClient({ tenant, portal, profile, availableMonths, statsByMonth }: Props) {
  const router = useRouter();
  const baseTimezone = getFrontierBidPeriodTimezone({
    baseTimezone: profile?.base_timezone ?? (profile?.base_airport ? getTimezoneFromAirport(profile.base_airport) : null),
    profileBaseTimezone: profile?.base_timezone ?? null,
  });
  const nowYear = new Date().getFullYear();
  const currentBid = getBidPeriodForTimestamp(new Date().toISOString(), baseTimezone, nowYear);
  const currentIndex = availableMonths.findIndex(
    (m) => m.year === nowYear && m.month === (currentBid?.bidMonthIndex ?? 0)
  );
  const [selectedIndex, setSelectedIndex] = useState(currentIndex >= 0 ? currentIndex : 0);

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
    startTransition(() => {
      setOptimisticShow(next);
    });
    void (async () => {
      try {
        await setShowPayProjection(next);
        router.refresh();
      } catch {
        startTransition(() => {
          setOptimisticShow(!next);
        });
      }
    })();
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
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-400/30 dark:border-white/5 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-900/60 dark:to-slate-950/80 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)] dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] dark:hover:border-emerald-400/20">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-2 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">Month Overview</h2>
          {availableMonths.length > 1 && (
            <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 p-0.5 dark:border-white/10">
              {availableMonths.map((m, i) => (
                <button
                  key={monthKey(m.year, m.month)}
                  type="button"
                  onClick={() => setSelectedIndex(i)}
                  className={`touch-target touch-pad rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    i === selectedIndex
                      ? "bg-emerald-100 text-emerald-800 dark:bg-white/10 dark:text-white"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-200"
                  }`}
                >
                  {m.shortLabel}
                </button>
              ))}
            </div>
          )}
        </div>
        <ProBadge label={getPlanBadgeLabel(profile)} variant={getPlanBadgeVariant(profile)} size="sm" />
      </div>
      <div className="mt-4">
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-300">{selectedMonth?.label}</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center dark:border-white/10 dark:bg-white/5">
            <p className="truncate tabular-nums text-2xl font-bold text-emerald-700 dark:text-emerald-300">{stats.trip}</p>
            <p className="text-xs text-slate-500 dark:text-slate-300">Trips</p>
          </div>
          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center dark:border-white/10 dark:bg-white/5">
            <p className="truncate tabular-nums text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.reserve}</p>
            <p className="text-xs text-slate-500 dark:text-slate-300">Reserve days</p>
          </div>
          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center dark:border-white/10 dark:bg-white/5">
            <p className="truncate tabular-nums text-2xl font-bold text-slate-700 dark:text-slate-300">{stats.vacationOff}</p>
            <p className="text-xs text-slate-500 dark:text-slate-300">Days off</p>
          </div>
          <div className="min-w-0 overflow-hidden rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center dark:border-amber-500/20 dark:bg-amber-500/5">
            <div className="space-y-2">
              <div className="min-w-0">
                <p className="tabular-nums text-2xl font-normal leading-tight text-amber-800 dark:text-amber-300">
                  {formatMinutesToHhMm(stats.rawCreditMinutes ?? 0)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-300">Credit</p>
              </div>
              <div className="min-w-0 border-t border-slate-200 pt-2 dark:border-white/10">
                <p className="tabular-nums text-base font-normal leading-tight text-amber-800 dark:text-amber-300">
                  {formatMinutesToHhMm(Math.round((stats.totalBlock ?? 0) * 60))}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-300">Block</p>
              </div>
            </div>
          </div>
        </div>
        <div
          className={`mt-4 rounded-2xl border border-slate-200 bg-slate-50/90 px-5 py-4 dark:border-white/10 dark:bg-slate-900/40 ${
            stats.payEligible && !optimisticShow ? "opacity-60 saturate-75" : ""
          }`}
        >
          {!stats.payEligible ? (
            <div className="mt-3 space-y-2">
              <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                Pay Estimate{"\u00A0"}·{"\u00A0"}PRO
              </span>
              <p className="text-xs text-slate-500">See your projected monthly pay based on credit and guarantee.</p>
              <p className="text-xs text-slate-500">Start a 14-day PRO trial to unlock this feature.</p>
              <Link
                href={`/${tenant}/${portal}/portal/settings`}
                className="inline-block text-sm font-medium text-[#75C043] hover:underline"
              >
                Go to Profile →
              </Link>
            </div>
          ) : (
            <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200/90">
                  Pay Estimate
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Based on your credited hours this month
                </p>
              </div>

              <button
                type="button"
                onClick={onTogglePay}
                disabled={isPending}
                className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1.5 text-xs text-emerald-800 hover:bg-emerald-200 disabled:opacity-60 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100 dark:hover:bg-emerald-500/20"
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

            {!stats.payProjection ? (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-200/90">
                  Complete your Profile to enable pay estimate
                </p>
                <p className="text-xs text-slate-500">
                  Missing: {Array.isArray(stats.payMissingInputs) && stats.payMissingInputs.length
                  ? stats.payMissingInputs.join(", ")
                  : "required info"}
                </p>
                <p className="text-xs text-slate-500">
                  Add it in your Profile to calculate your pay scale year.
                </p>
                <Link
                  href={`/${tenant}/${portal}/portal/settings`}
                  className="inline-block text-sm font-medium text-[#75C043] hover:underline"
                >
                  Go to Profile →
                </Link>
              </div>
            ) : (
            <>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs text-slate-500 dark:text-slate-300">Estimated Payment</p>
                <p className="text-xs text-slate-500 dark:text-slate-300">(20th)</p>
                <p className="mt-1 break-words font-semibold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-200">
                  {optimisticShow && stats.payProjection
                    ? formatUSD(stats.payProjection.pay20thGross)
                    : "••••••"}
                </p>
              </div>

              <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/5">
                <p className="text-xs text-slate-500 dark:text-slate-300">Estimated Payment</p>
                <p className="text-xs text-slate-500 dark:text-slate-300">(5th)</p>
                <p className="mt-1 break-words text-base font-medium tabular-nums tracking-tight text-emerald-700 dark:text-emerald-200/90">
                  {optimisticShow && stats.payProjection
                    ? formatUSD(stats.payProjection.pay5thGross)
                    : "••••••"}
                </p>
              </div>

              <div className="min-w-0 overflow-hidden rounded-xl border border-emerald-500/35 bg-emerald-50/80 p-3 dark:border-emerald-500/40 dark:bg-emerald-500/10">
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-100/90">
                  Estimated Monthly <span className="font-normal text-emerald-700 dark:text-emerald-200/70">(Total)</span>
                </p>

                <p className="mt-1 break-words text-xl font-bold tabular-nums tracking-tight text-emerald-800 dark:text-emerald-100">
                  {optimisticShow && stats.payProjection
                    ? formatUSD(animatedTotal)
                    : "••••••"}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-1.5 text-left text-xs text-slate-500 dark:text-slate-400">
              {optimisticShow && stats.payProjection ? (
                <span>
                  Rate{" "}
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                    {formatUSD(stats.payProjection.rate)}/hr
                  </span>{" "}
                  · Year {stats.payProjection.year}
                </span>
              ) : (
                <span>—</span>
              )}
              <span>Tap the eye to hide pay before showing your dashboard.</span>
            </div>

            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-white/10">
              <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                CrewRules™ provides pay estimates only (before tax) and is not an official Frontier Airlines pay statement.
                For pay questions or discrepancies, please contact the Frontier Airlines Payroll Department.
              </p>
            </div>
            </>
            )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
