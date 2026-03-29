"use client";

import Image from "next/image";
import { ProBadge } from "@/components/pro-badge";
import { ProTrialAndPricingBlock } from "@/components/pro-trial-and-pricing-block";
import { ManageSubscriptionBlock, canManageStripeSubscription } from "@/components/manage-subscription-block";
import { FOUNDING_PILOT_CAP } from "@/lib/founding-pilot-constants";

/** Mirrors `Profile` subscription + founding fields; kept local so this client file never imports `@/lib/profile` (server-only). */
export type SubscriptionSettingsProfile = {
  subscription_tier?: "free" | "pro" | "enterprise";
  stripe_customer_id?: string | null;
  billing_source?: string | null;
  billing_interval?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  is_founding_pilot?: boolean;
  founding_pilot_started_at?: string | null;
  founding_pilot_number?: number | null;
};

type Props = {
  profile: SubscriptionSettingsProfile;
  proActive: boolean;
  proBadgeLabel: string;
  proBadgeVariant: "slate" | "gold" | "emerald" | "amber" | "red";
  foundingPilotCount: number;
  /** From `getSubscriptionDisplayType` (server). */
  planDisplayType: "Free" | "Pro" | "Pro Trial" | "Enterprise";
  /** From `getActiveProTrialDaysRemaining` (server). */
  trialDaysRemaining: number | null;
  /** From `isEligibleForProTrialStartCta` (server). */
  showProTrialStartCta: boolean;
};

export function SubscriptionSettingsPanel({
  profile,
  proActive,
  proBadgeLabel,
  proBadgeVariant,
  foundingPilotCount,
  planDisplayType,
  trialDaysRemaining: _trialDaysRemaining,
  showProTrialStartCta,
}: Props) {
  const hasPaidActiveAccess = planDisplayType === "Pro" || planDisplayType === "Enterprise";
  const showChooseYourPlan = !hasPaidActiveAccess;

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6 dark:border-white/5 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-900/60 dark:to-slate-950/80 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="mb-6 border-b border-slate-200 pb-4 dark:border-white/10">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-snug text-slate-900 sm:text-lg dark:text-white">
            <span className="text-pretty">
              Crew<span className="text-[#75C043]">Rules</span>
              <span className="align-super text-[10px]">™</span> <span className="text-amber-400">Pro</span>
            </span>{" "}
            <span className="mx-1.5 text-slate-400 dark:text-slate-500 font-normal select-none" aria-hidden>
              •
            </span>{" "}
            <span className="text-slate-900 dark:text-white">Subscription</span>
          </h2>
          <p className="mt-1 text-pretty text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere] dark:text-slate-400">
            Plans, billing, and your access
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <section
          className="rounded-xl border border-slate-200/90 bg-slate-50/60 px-4 py-2.5 dark:border-white/10 dark:bg-white/[0.04] sm:px-5"
          aria-label="Subscription status"
        >
          <div className="flex min-w-0 flex-col items-start gap-2">
            <div className="min-w-0 w-fit max-w-full">
              <ProBadge label={proBadgeLabel} variant={proBadgeVariant} size="sm" />
            </div>
            {!hasPaidActiveAccess && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {planDisplayType === "Pro Trial"
                  ? "You’re currently on a Pro trial. Choose a plan anytime to continue full access."
                  : "PRO access includes trial and paid Pro. Enterprise is organization-wide."}
              </p>
            )}
            {profile?.is_founding_pilot && (
              <div className="max-w-full self-start rounded-2xl border border-amber-400/35 bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 px-4 py-3 shadow-[inset_0_1px_0_0_rgba(251,191,36,0.12),0_1px_2px_rgba(0,0,0,0.15)] dark:border-amber-400/25 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950/90">
                <div className="flex items-center gap-3">
                  <Image
                    src="/icons/founding-pilot-badge.png"
                    alt=""
                    width={56}
                    height={56}
                    className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-amber-400/35 dark:ring-amber-400/25 sm:h-14 sm:w-14"
                  />
                  <p className="min-w-0 text-base font-semibold tracking-tight text-amber-200 dark:text-amber-100">
                    Founding Pilot
                  </p>
                </div>
                {profile?.founding_pilot_number != null ? (
                  <>
                    <p className="mt-3 text-sm font-medium text-amber-400/95 dark:text-amber-300/90">
                      Frontier Airlines • Pilot #{profile.founding_pilot_number} of {FOUNDING_PILOT_CAP}
                    </p>
                    <p className="mt-2 max-w-sm text-pretty text-[11px] leading-snug text-amber-500/70 dark:text-amber-400/55">
                      Welcome aboard — You claimed one of the 100 Founding Pilot spots.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-3 text-sm font-medium text-amber-400/95 dark:text-amber-300/90">
                      Lifetime Beta Member
                    </p>
                    {profile?.founding_pilot_started_at && (
                      <p className="mt-2 text-[11px] leading-snug text-amber-500/70 dark:text-amber-400/55">
                        Since {new Date(profile.founding_pilot_started_at).getFullYear()}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        {showChooseYourPlan && (
          <section
            className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]"
            aria-labelledby="subscription-plan-heading"
          >
            <div className="border-b border-slate-200/80 pb-3 dark:border-white/10">
              <h3
                id="subscription-plan-heading"
                className="text-base font-semibold tracking-tight text-pretty text-slate-900 dark:text-white"
              >
                Choose Your Plan
              </h3>
              {!proActive && showProTrialStartCta && (
                <p className="mt-1.5 text-xs leading-relaxed text-pretty text-slate-600 dark:text-slate-400">
                  Subscribe or start your 14-day trial below.
                </p>
              )}
              {!proActive && !showProTrialStartCta && (
                <p className="mt-1.5 text-xs leading-relaxed text-pretty text-slate-600 dark:text-slate-400">
                  Choose the plan that fits your flying below.
                </p>
              )}
            </div>
            <div className="mt-4 space-y-4">
              {!proActive && showProTrialStartCta && (
                <p className="text-sm leading-relaxed text-pretty text-slate-700 dark:text-slate-300">
                  Commute Assist™, Pay Projection, Family View, and the full Pro toolkit unlock with your trial or a paid plan.
                </p>
              )}
              {!proActive && !showProTrialStartCta && (
                <p className="text-sm leading-relaxed text-pretty text-slate-700 dark:text-slate-300">
                  Commute Assist™, Pay Projection, Family View, and the full Pro toolkit unlock with a paid Pro plan.
                </p>
              )}
              <ProTrialAndPricingBlock
                profile={profile}
                proActive={proActive}
                foundingPilotCount={foundingPilotCount}
                showProTrialStartCta={showProTrialStartCta}
              />
            </div>
          </section>
        )}

        <section
          className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]"
          aria-labelledby="subscription-billing-heading"
        >
          <div className="border-b border-slate-200/80 pb-3 dark:border-white/10">
            <h3
              id="subscription-billing-heading"
              className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white"
            >
              Billing
            </h3>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-950/40">
            <ManageSubscriptionBlock profile={profile} />
            {!canManageStripeSubscription(profile) && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                When you have an active paid Pro subscription through Stripe, your renewal date and a link to manage billing will appear here. Trials and Enterprise do not use
                this portal.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
