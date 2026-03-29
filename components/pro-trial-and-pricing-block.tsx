"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { startProTrial } from "@/app/frontier/pilots/portal/profile/actions";
import { FOUNDING_PILOT_CAP } from "@/lib/founding-pilot-constants";
import {
  PILOT_FOUNDING_ANNUAL_DISPLAY_USD,
  PILOT_PRO_ANNUAL_DISPLAY_USD,
  PILOT_PRO_MONTHLY_DISPLAY_USD,
  formatPilotListPriceUsd,
  formatUsdAmount,
  getFoundingSavingsPercentVsProMonthlyRounded,
  getFoundingYearlySavingsVsProMonthlyUsd,
  getProAnnualSavingsPercentVsProMonthlyRounded,
} from "@/lib/pilot-pro-display-pricing";

const PRO_ANNUAL_SAVE_PERCENT = getProAnnualSavingsPercentVsProMonthlyRounded();
const FOUNDING_SAVE_PERCENT = getFoundingSavingsPercentVsProMonthlyRounded();
const FOUNDING_SAVE_DOLLARS = formatUsdAmount(getFoundingYearlySavingsVsProMonthlyUsd());
const FOUNDING_MONTHLY_EQUIV = formatUsdAmount(
  Math.round((PILOT_FOUNDING_ANNUAL_DISPLAY_USD / 12) * 100) / 100
);
const PRO_ANNUAL_MONTHLY_EQUIV = formatUsdAmount(
  Math.round((PILOT_PRO_ANNUAL_DISPLAY_USD / 12) * 100) / 100
);

/** Shared Pro feature bullets — same entitlements on Monthly & Annual; keeps copy aligned with “Pro includes” on this page. */
function StandardProPlanFeaturesList() {
  const checkClass = "mt-0.5 shrink-0 font-bold text-[#75C043]";
  const nameClass = "font-medium text-slate-600 dark:text-slate-300";
  return (
    <ul className="w-full max-w-[16rem] space-y-1.5 text-left text-[11px] leading-snug text-slate-500 dark:text-slate-400 sm:text-xs">
      <li className="flex gap-2">
        <span className={checkClass} aria-hidden>
          ✓
        </span>
        <span>
          <span className={nameClass}>Commute Assist™</span>
          {" — "}Smart commute planning from your schedule.
        </span>
      </li>
      <li className="flex gap-2">
        <span className={checkClass} aria-hidden>
          ✓
        </span>
        <span>
          <span className={nameClass}>Pay Projections</span>
          {" — "}Trip and monthly credit, block, and pay forecasts.
        </span>
      </li>
      <li className="flex gap-2">
        <span className={checkClass} aria-hidden>
          ✓
        </span>
        <span>
          <span className={nameClass}>Advanced Weather Brief™</span>
          {" — "}Operational weather for your next scheduled flight.
        </span>
      </li>
      <li className="flex gap-2">
        <span className={checkClass} aria-hidden>
          ✓
        </span>
        <span>
          <span className={nameClass}>Family View™</span>
          {" — "}Share schedule insights with family and friends.
        </span>
      </li>
    </ul>
  );
}

export type ProTrialPricingProfile = {
  subscription_tier?: "free" | "pro" | "enterprise";
};

type CheckoutInterval = "pro_monthly" | "pro_annual" | "founding_pilot_annual";

const CHECKOUT_INTERVALS = new Set<CheckoutInterval>(["pro_monthly", "pro_annual", "founding_pilot_annual"]);

function isCheckoutInterval(v: unknown): v is CheckoutInterval {
  return typeof v === "string" && CHECKOUT_INTERVALS.has(v as CheckoutInterval);
}

/** Trial CTA, upgrade callout, founding pilot spots, and Pro includes — shared by Profile and Settings > Subscription. */
export function ProTrialAndPricingBlock({
  profile,
  proActive,
  foundingPilotCount,
  showProTrialStartCta,
}: {
  profile: ProTrialPricingProfile | null | undefined;
  proActive: boolean;
  foundingPilotCount: number;
  /** From server: `isEligibleForProTrialStartCta` — free path, no `pro_trial_started_at`. */
  showProTrialStartCta: boolean;
}) {
  const router = useRouter();
  const [trialStarting, setTrialStarting] = useState(false);
  const [trialMessage, setTrialMessage] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<CheckoutInterval | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

  const showBetaPaymentInfo =
    profile?.subscription_tier !== "enterprise" &&
    (!proActive || profile?.subscription_tier !== "pro");

  /** UI only: match FOUNDING_PILOT_CAP (100) — hide Founding tier card when program is full; Monthly & Annual always stay. */
  const showFoundingPilotPlan = foundingPilotCount < FOUNDING_PILOT_CAP;

  const planGridClass = showFoundingPilotPlan
    ? "grid grid-cols-1 gap-3 min-[560px]:grid-cols-3 min-w-0 items-stretch overflow-visible"
    : "grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 min-w-0 items-stretch overflow-visible";

  const standardPlanCard =
    "flex h-full min-h-[220px] w-full min-w-0 flex-col rounded-2xl border border-amber-500/30 border-t-2 border-t-[#75C043]/40 bg-gradient-to-b from-white/[0.06] to-slate-950/25 px-3 pb-4 pt-4 text-center shadow-sm ring-1 ring-inset ring-white/[0.06] sm:px-4 dark:from-amber-500/[0.07] dark:to-slate-950/50 dark:ring-white/[0.04]";

  /** Premium emphasis for Pro Annual only — stronger shell + subtle desktop scale (layout box unchanged for row alignment). */
  const proAnnualHeroCard =
    "relative z-[1] flex h-full min-h-[220px] w-full min-w-0 origin-center flex-col rounded-2xl border border-amber-400/55 border-t-2 border-t-[#75C043]/60 bg-gradient-to-b from-white/[0.12] via-amber-500/[0.06] to-slate-950/40 px-3 pb-4 pt-4 text-center shadow-md shadow-amber-500/20 ring-1 ring-inset ring-white/10 ring-amber-400/20 outline outline-1 outline-amber-500/15 sm:px-4 dark:from-amber-500/[0.11] dark:via-amber-950/25 dark:to-slate-950/60 dark:border-amber-400/50 dark:shadow-[0_0_28px_-8px_rgba(245,158,11,0.35)] dark:ring-amber-400/15 dark:outline-amber-400/10 min-[480px]:scale-[1.018] min-[480px]:transition-transform min-[480px]:duration-200 min-[480px]:ease-out";

  const foundingPlanCard =
    "flex h-full min-h-[220px] w-full min-w-0 flex-col rounded-2xl border border-amber-400/45 bg-gradient-to-b from-amber-500/14 to-amber-950/28 px-3 pb-4 pt-4 text-center shadow-md shadow-amber-500/8 ring-1 ring-inset ring-amber-400/25 sm:px-4 dark:from-amber-500/18 dark:to-amber-950/38";

  const planCtaClass =
    "w-full shrink-0 rounded-xl bg-amber-500/90 px-3 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-500 transition disabled:opacity-50 disabled:pointer-events-none";

  /** Pins CTA to card bottom; padding creates space below helper text (equal across cards). */
  const planCtaRowClass = "mt-auto w-full shrink-0 pt-5";

  /** Primary price line — Monthly, Annual, Founding annual headline amounts. */
  const planMainPriceClass =
    "text-xl font-bold tabular-nums leading-none text-white sm:text-2xl";

  /** “$X per month (effective)” — shared typography with Founding card. */
  const planEffectiveMonthlyClass =
    "inline-block text-xs font-normal tabular-nums leading-none text-amber-300/90 dark:text-amber-300/80 sm:text-sm";

  /**
   * Same text specs as Founding, but neutralizes Pro Annual hero `scale-[1.018]` so effective line matches Founding visually.
   * scale ≈ 1/1.018
   */
  const planEffectiveMonthlyOnScaledCardClass = `${planEffectiveMonthlyClass} min-[480px]:origin-center min-[480px]:scale-[0.9823]`;

  /** All plan cards: pill is last child so it paints over the top border. */
  const planCardPillWrapClass =
    "relative z-0 flex h-full min-h-0 w-full min-w-0 flex-col overflow-visible";

  /** Centered on the card’s top edge (half above / half below); opaque fill hides the border segment. */
  const pillBorderAnchorClass =
    "pointer-events-none absolute left-1/2 top-0 z-20 w-max max-w-[min(100%,calc(100%-1.5rem))] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-3 py-1 text-center text-[10px] font-bold uppercase tracking-wide shadow-md sm:px-3.5 sm:text-[11px]";

  /** Monthly: pay-as-you-go — filled muted blue (same shell as SAVE pills; less saturated than sky). */
  const pillMonthlyPayAsYouGoClass = `${pillBorderAnchorClass} bg-[#5f6f82] text-white shadow-md dark:bg-[#556579] dark:text-white`;

  const pillMostPopularClass = `${pillBorderAnchorClass} bg-[#ea580c] text-white`;
  /** CrewRules™ brand green — same as primary CTAs site-wide (`#75C043` + dark label). */
  const pillFoundingSaveClass = `${pillBorderAnchorClass} bg-[#75C043] text-slate-950`;

  async function startCheckout(interval: CheckoutInterval) {
    if (!isCheckoutInterval(interval)) {
      console.error("[checkout] Invalid interval (avoid passing the click event here):", interval);
      setCheckoutMessage("Could not start checkout. Please try again.");
      return;
    }
    setCheckoutMessage(null);
    setCheckoutLoading(interval);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = (await res.json()) as { url?: string; error?: unknown };
      if (data.url) {
        window.location.href = data.url;
      } else {
        const errRaw = data.error;
        const errText =
          typeof errRaw === "string"
            ? errRaw
            : errRaw != null && typeof (errRaw as { message?: unknown }).message === "string"
              ? (errRaw as { message: string }).message
              : res.ok
                ? "Could not start checkout."
                : "Checkout failed.";
        setCheckoutMessage(errText);
      }
    } catch {
      setCheckoutMessage("Checkout failed. Please try again.");
    } finally {
      setCheckoutLoading(null);
    }
  }

  const handleStartProTrialClick = useCallback(async () => {
    setTrialMessage(null);
    setTrialStarting(true);
    const result = await startProTrial();
    setTrialStarting(false);
    if (result.ok) {
      router.refresh();
    } else if (result.reason === "trial_active") {
      setTrialMessage("Trial already active");
    } else if (result.reason === "trial_already_used") {
      setTrialMessage("You've already used your Pro trial");
    } else if (result.reason === "already_paid") {
      setTrialMessage("You already have PRO access");
    }
  }, [router]);

  return (
    <>
      {showBetaPaymentInfo && (
        <>
          {showProTrialStartCta && (
            <div className="mt-3 rounded-xl border border-slate-700/80 bg-gradient-to-b from-slate-900 to-slate-950 px-6 py-7 text-center shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-black/20 dark:border-white/10 dark:from-[#1f1a16] dark:to-[#14110e] dark:shadow-[0_16px_48px_-16px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-8 sm:py-8">
              <p className="text-lg font-bold leading-tight tracking-tight text-white sm:text-xl">
                Ready to upgrade?
              </p>
              <p className="mx-auto mt-3 max-w-md text-sm font-normal leading-relaxed text-slate-400 sm:mt-3.5 sm:text-[0.9375rem]">
                Start with a 14-day free trial of Pro. No credit card required.
              </p>
              <button
                type="button"
                onClick={() => {
                  void handleStartProTrialClick();
                }}
                disabled={trialStarting || checkoutLoading !== null}
                className="mt-5 min-h-11 w-full max-w-sm rounded-xl bg-amber-500/90 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-md transition hover:bg-amber-500 disabled:pointer-events-none disabled:opacity-50 sm:mt-6 sm:inline-flex sm:w-auto sm:justify-center sm:px-8"
              >
                {trialStarting ? "Starting…" : "Start 14-Day PRO Trial"}
              </button>
              {trialMessage && (
                <p className="mt-3 text-center text-sm text-amber-200/95 dark:text-amber-200/90" role="status">
                  {trialMessage}
                </p>
              )}
            </div>
          )}
          {!proActive && (
            <p
              className={
                showProTrialStartCta
                  ? "mt-2.5 text-xs leading-relaxed text-pretty text-slate-500 dark:text-slate-400"
                  : "mt-3 text-xs leading-relaxed text-pretty text-slate-500 dark:text-slate-400"
              }
            >
              Early members help shape what we ship; pick the plan that fits you below.
            </p>
          )}
          {foundingPilotCount > 0 && (
            <div className="mt-3 flex flex-col gap-0.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
              <span className="text-xs font-medium text-amber-400/90">Founding Pilot Program</span>
              <span className="text-xs text-amber-400/80">
                {foundingPilotCount} / {FOUNDING_PILOT_CAP} spots claimed
              </span>
            </div>
          )}
          <div className="mt-4 overflow-visible rounded-2xl border border-amber-500/25 bg-gradient-to-b from-amber-500/[0.07] to-transparent p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:border-amber-400/20 dark:from-amber-500/[0.05] dark:to-transparent sm:p-5">
            <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-600/95 dark:text-amber-400/95 sm:mb-2.5 sm:text-xs">
              Pro plans
            </p>
            <p className="mb-5 w-full text-center text-xs leading-relaxed text-pretty text-slate-600 dark:text-slate-400 sm:text-sm sm:leading-relaxed">
              {showFoundingPilotPlan ? (
                <>
                  <span className="font-medium text-slate-700 dark:text-slate-200">Full Pro on every tier</span>
                  {" — "}same features, your choice of billing. Subscribe monthly, save with annual, or lock in Founding Pilot while spots stay open. Cancel any time.
                </>
              ) : (
                <>
                  <span className="font-medium text-slate-700 dark:text-slate-200">Full Pro on every tier</span>
                  {" — "}same features, your choice of billing. Subscribe monthly or save with annual. Cancel any time.
                </>
              )}
            </p>
            {checkoutMessage && (
              <p className="mb-3 text-center text-xs text-amber-200/90" role="alert">
                {checkoutMessage}
              </p>
            )}
            <div className={`${planGridClass} pt-2`}>
              <div className={planCardPillWrapClass}>
                <div className={standardPlanCard}>
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-start gap-1.5 pt-3">
                    <span className="text-sm font-semibold leading-snug text-pretty text-amber-100 dark:text-amber-200">Pro Monthly</span>
                    <span className={planMainPriceClass}>
                      {formatPilotListPriceUsd(PILOT_PRO_MONTHLY_DISPLAY_USD)} / month
                    </span>
                    <span className="max-w-[14rem] text-center text-[11px] leading-snug text-slate-500 dark:text-slate-400 sm:text-xs">
                      Billed monthly
                    </span>
                    <div className="mt-2 flex min-h-0 w-full flex-1 flex-col items-center justify-center px-0.5 pb-0.5">
                      <StandardProPlanFeaturesList />
                      <p className="mt-2.5 max-w-[16rem] text-center text-[10px] leading-snug text-pretty text-slate-500 dark:text-slate-500 sm:text-[11px]">
                        Full Pro access every month. Move to annual whenever it fits you.
                      </p>
                    </div>
                  </div>
                  <div className={planCtaRowClass}>
                    <button
                      type="button"
                      className={planCtaClass}
                      disabled={checkoutLoading !== null}
                      onClick={() => startCheckout("pro_monthly")}
                    >
                      {checkoutLoading === "pro_monthly" ? "Opening checkout…" : "Subscribe monthly"}
                    </button>
                  </div>
                </div>
                <span className={pillMonthlyPayAsYouGoClass}>PAY AS YOU GO</span>
              </div>
              <div className={planCardPillWrapClass}>
                <div className={proAnnualHeroCard}>
                  <div className="flex min-h-0 flex-1 flex-col items-center justify-start gap-1.5 pt-3">
                    <span className="text-sm font-semibold leading-snug text-pretty text-amber-100 dark:text-amber-200">Pro Annual</span>
                    <span className={planMainPriceClass}>$99 / year</span>
                    <span className={planEffectiveMonthlyOnScaledCardClass}>
                      {PRO_ANNUAL_MONTHLY_EQUIV} per month (effective)
                    </span>
                    <span className="max-w-[14rem] text-center text-[11px] leading-snug text-slate-500 dark:text-slate-400 sm:text-xs">
                      Billed yearly
                    </span>
                    <div className="mt-2 flex min-h-0 w-full flex-1 flex-col items-center justify-center px-0.5 pb-0.5 min-[480px]:origin-top min-[480px]:scale-[0.9823]">
                      <StandardProPlanFeaturesList />
                      <p className="mt-2.5 max-w-[16rem] text-center text-[10px] leading-snug text-pretty text-slate-500 dark:text-slate-500 sm:text-[11px]">
                        Same Pro feature set — standard annual rate and savings vs twelve monthly charges.
                      </p>
                    </div>
                  </div>
                  <div className={planCtaRowClass}>
                    <button
                      type="button"
                      className={planCtaClass}
                      disabled={checkoutLoading !== null}
                      onClick={() => startCheckout("pro_annual")}
                    >
                      {checkoutLoading === "pro_annual" ? "Opening checkout…" : "Subscribe annually"}
                    </button>
                  </div>
                </div>
                <span className={pillMostPopularClass} aria-hidden>
                  Save {PRO_ANNUAL_SAVE_PERCENT}%
                </span>
              </div>
              {showFoundingPilotPlan && (
                <div className={planCardPillWrapClass}>
                  <div className={foundingPlanCard}>
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-start gap-1.5 pt-3">
                      <span className="text-sm font-semibold leading-snug text-pretty text-amber-100 dark:text-amber-200">
                        Founding Pilot
                      </span>
                      <span className={planMainPriceClass}>
                        {formatPilotListPriceUsd(PILOT_FOUNDING_ANNUAL_DISPLAY_USD)} / year
                      </span>
                      <span className={planEffectiveMonthlyClass}>
                        {FOUNDING_MONTHLY_EQUIV} per month (effective)
                      </span>
                      <span className="-mt-0.5 max-w-[14rem] text-center text-[11px] font-normal leading-snug text-slate-500 dark:text-slate-400 sm:text-xs">
                        Best value • Billed yearly
                      </span>
                      <div className="mt-0.5 w-full max-w-[15.5rem] rounded-xl border border-amber-400/50 bg-gradient-to-b from-amber-500/20 to-amber-700/10 px-3 py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-amber-300/20 dark:border-amber-400/40 dark:from-amber-500/25 dark:to-amber-950/40 dark:ring-amber-400/25">
                        <p className="text-sm font-bold tabular-nums tracking-tight text-white sm:text-[0.95rem]">
                          {foundingPilotCount} of {FOUNDING_PILOT_CAP} claimed
                        </p>
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100/90 dark:text-amber-200/95 sm:text-[11px]">
                          Limited founding program
                        </p>
                        <p className="mt-1 text-[10px] leading-snug text-amber-100/75 dark:text-amber-300/80 sm:text-[11px]">
                          Only {FOUNDING_PILOT_CAP} pilots per airline
                        </p>
                      </div>
                      <div className="mt-2.5 max-w-[17rem] border-t border-amber-500/20 pt-2.5 text-center text-[11px] leading-relaxed text-pretty text-slate-500 dark:border-amber-400/20 dark:text-slate-400 sm:text-xs">
                        <p>
                          By choosing the Founding Pilot plan, you are getting{" "}
                          <strong className="font-semibold text-amber-200/95 dark:text-amber-200/90">more than 7 months free</strong> compared to
                          paying monthly—that&apos;s{" "}
                          <strong className="font-semibold tabular-nums text-amber-200/95 dark:text-amber-200/90">{FOUNDING_SAVE_DOLLARS}</strong>{" "}
                          a year.
                        </p>
                        <p className="mt-3 text-slate-400 dark:text-slate-500 sm:mt-3.5">
                          Founding Pilots lock in that annual price for life.
                        </p>
                      </div>
                    </div>
                    <div className={planCtaRowClass}>
                      <button
                        type="button"
                        className={planCtaClass}
                        disabled={checkoutLoading !== null}
                        onClick={() => startCheckout("founding_pilot_annual")}
                      >
                        {checkoutLoading === "founding_pilot_annual" ? "Opening checkout…" : "Subscribe as Founding Pilot"}
                      </button>
                    </div>
                  </div>
                  <span className={pillFoundingSaveClass} aria-hidden>
                    Save {FOUNDING_SAVE_PERCENT}%
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-gradient-to-b from-amber-500/[0.06] to-transparent px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:border-amber-400/15 dark:from-amber-500/[0.05] dark:to-transparent sm:px-5 sm:py-4">
            <p className="text-xs font-medium leading-snug text-pretty text-slate-600 dark:text-slate-300 sm:text-sm">
              After checkout, manage everything in{" "}
              <span className="text-slate-700 dark:text-slate-200">Subscription → Billing</span>. Update payment methods, view invoices, or adjust your plan anytime.
            </p>
            <ul className="mt-3.5 space-y-2.5 text-xs leading-relaxed text-pretty text-slate-500 dark:text-slate-400 sm:text-[13px] sm:leading-relaxed">
              <li className="flex gap-3">
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/80 shadow-[0_0_0_1px_rgba(251,191,36,0.25)] dark:bg-amber-400/70"
                  aria-hidden
                />
                <span>
                  <span className="font-medium text-slate-600 dark:text-slate-300">CrewRules™ Pro unlocks the full platform</span>
                  {" — "}smarter scheduling, commute planning, and operational tools built for airline crew.
                </span>
              </li>
              <li className="flex gap-3">
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/80 shadow-[0_0_0_1px_rgba(251,191,36,0.25)] dark:bg-amber-400/70"
                  aria-hidden
                />
                <span>
                  <span className="font-medium text-slate-600 dark:text-slate-300">Founding Pilots get early access</span>
                  {" "}to new features and help shape what CrewRules™ becomes.
                </span>
              </li>
              <li className="flex gap-3">
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/80 shadow-[0_0_0_1px_rgba(251,191,36,0.25)] dark:bg-amber-400/70"
                  aria-hidden
                />
                <span>
                  <span className="font-medium text-slate-600 dark:text-slate-300">Product direction is pilot-driven</span>
                  {" "}— improvements are built from real line feedback.
                </span>
              </li>
              <li className="flex gap-3">
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/80 shadow-[0_0_0_1px_rgba(251,191,36,0.25)] dark:bg-amber-400/70"
                  aria-hidden
                />
                <span>
                  <span className="font-medium text-slate-600 dark:text-slate-300">Built for the line</span>
                  {" — "}fast, practical tools that make every trip easier.
                </span>
              </li>
            </ul>
          </div>
        </>
      )}
      {!proActive && (
        <>
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950/40 px-4 py-4 opacity-60">
            <p className="mb-2 text-sm font-medium text-slate-300">CrewRules™ Pro includes</p>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-slate-500">•</span>
                <span>
                  Commute <span className="text-[#75C043]">Assist</span>
                  <span className="align-super text-[10px]">™</span> — Smart commute planning based on your schedule.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-slate-500">•</span>
                <span>Pay Projections — Forecast trip and monthly credit, block, and pay</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-slate-500">•</span>
                <span>Advanced Weather Brief™ — Operational weather analysis for your next scheduled flight.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-slate-500">•</span>
                <span>CrewRules™ Family View™ — Share schedule insights with your family and friends.</span>
              </li>
            </ul>
          </div>
        </>
      )}
    </>
  );
}
