import type {
  SuperAdminKpiData,
  ProTrialMetrics,
  TenantOverviewRow,
  StripeBillingMetrics,
} from "@/lib/super-admin/actions";
import {
  PRO_MONTHLY_PRICE_USD,
  ENTERPRISE_MONTHLY_PRICE_USD,
} from "@/lib/super-admin/pricing-config";
import { DollarSign, Plane, Database, Brain, Mail, Server, TrendingUp } from "lucide-react";
import { PlaceholderCard } from "./placeholder-card";

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

type SuperAdminCostMonetizationProps = {
  kpis: SuperAdminKpiData;
  trialMetrics: ProTrialMetrics;
  tenants: TenantOverviewRow[];
  stripeBilling: StripeBillingMetrics;
};

const cardBase = "rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-3";

export function SuperAdminCostMonetization({
  kpis,
  trialMetrics,
  tenants,
  stripeBilling,
}: SuperAdminCostMonetizationProps) {
  const enterpriseTenants = tenants.filter((t) => t.enterpriseCount > 0).length;

  const enterprisePrice = ENTERPRISE_MONTHLY_PRICE_USD ?? 0;
  const estimatedMRR =
    kpis.proCount * PRO_MONTHLY_PRICE_USD + kpis.enterpriseCount * enterprisePrice;
  const estimatedARR = estimatedMRR * 12;

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-slate-200">Cost & Monetization</h2>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue block */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-3">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Revenue</div>
          <div className="flex flex-wrap gap-2">
            <div className={cardBase}>
              <div className="text-slate-500 text-xs mb-0.5">Pro users</div>
              <div className="text-xl font-semibold text-slate-200">{kpis.proCount}</div>
            </div>
            <div className={cardBase}>
              <div className="text-slate-500 text-xs mb-0.5">Enterprise users</div>
              <div className="text-xl font-semibold text-slate-200">{kpis.enterpriseCount}</div>
            </div>
            <div className={cardBase}>
              <div className="text-slate-500 text-xs mb-0.5">Enterprise tenants</div>
              <div className="text-xl font-semibold text-slate-200">{enterpriseTenants}</div>
            </div>
            <div className={cardBase}>
              <div className="text-slate-500 text-xs mb-0.5">Active trials</div>
              <div className="text-xl font-semibold text-slate-200">{trialMetrics.proTrialActive}</div>
            </div>
            <div className={`${cardBase} border-[#75C043]/30`}>
              <div className="text-slate-500 text-xs mb-0.5">Converted</div>
              <div className="text-xl font-semibold text-[#75C043]">{trialMetrics.convertedFromTrial}</div>
            </div>
          </div>

          {/* Live Stripe */}
          <div className="pt-3 border-t border-slate-700/50">
            <div className="text-xs font-medium text-emerald-400/90 uppercase tracking-wider mb-2">
              Live Stripe
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              <div className={`${cardBase} border-emerald-600/30`}>
                <div className="text-slate-500 text-xs mb-0.5">Paid Pro users</div>
                <div className="text-xl font-semibold text-emerald-300">{stripeBilling.paidProCount}</div>
              </div>
              <div className={cardBase}>
                <div className="text-slate-500 text-xs mb-0.5">Monthly</div>
                <div className="text-xl font-semibold text-slate-200">{stripeBilling.monthlyCount}</div>
              </div>
              <div className={cardBase}>
                <div className="text-slate-500 text-xs mb-0.5">Annual</div>
                <div className="text-xl font-semibold text-slate-200">{stripeBilling.annualCount}</div>
              </div>
              <div className={cardBase}>
                <div className="text-slate-500 text-xs mb-0.5">Cancel at period end</div>
                <div className="text-xl font-semibold text-slate-200">{stripeBilling.cancelAtPeriodEndCount}</div>
              </div>
            </div>
            <div
              className={`${cardBase} border-emerald-600/40 flex flex-col gap-0.5 bg-emerald-950/20`}
              title="Stripe-paid Pro subscriptions only."
            >
              <div className="flex items-center gap-2 text-emerald-300/90 text-xs">
                <DollarSign className="size-3.5" />
                Live MRR
              </div>
              <div className="text-xl font-semibold text-emerald-200">{formatUsd(stripeBilling.liveMRR)}</div>
              <div className="text-xs text-slate-400">ARR: {formatUsd(stripeBilling.liveARR)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Stripe-paid Pro only · active/trialing
              </div>
            </div>
          </div>

          {/* Estimated (pre-billing) */}
          <div className="pt-3 border-t border-slate-700/50">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              Pre-billing estimate
            </div>
            <div
              className={`${cardBase} border-amber-600/30 flex flex-col gap-0.5`}
              title="Pre-billing estimate. Based on current user counts × configured prices."
            >
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <DollarSign className="size-3.5" />
                Estimated MRR
              </div>
              <div className="text-xl font-semibold text-amber-400">{formatUsd(estimatedMRR)}</div>
              <div className="text-xs text-slate-500">
                ARR: {formatUsd(estimatedARR)}
              </div>
              <div className="text-[10px] text-slate-600 mt-0.5">
                Based on tier counts × configured prices
              </div>
            </div>
          </div>
        </div>

        {/* Cost block */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-3">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Cost</div>
          <div className="flex flex-wrap gap-2">
            <PlaceholderCard
              title="FlightAware"
              subtitle="Not yet wired"
              icon={<Plane className="size-3.5" />}
              variant="chip"
            />
            <PlaceholderCard
              title="AeroDataBox"
              subtitle="Not yet wired"
              icon={<Database className="size-3.5" />}
              variant="chip"
            />
            <PlaceholderCard
              title="OpenAI"
              subtitle="Not yet wired"
              icon={<Brain className="size-3.5" />}
              variant="chip"
            />
            <PlaceholderCard
              title="Email"
              subtitle="Not yet wired"
              icon={<Mail className="size-3.5" />}
              variant="chip"
            />
            <PlaceholderCard
              title="Supabase / Vercel"
              subtitle="Not yet wired"
              icon={<Server className="size-3.5" />}
              variant="chip"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-700/50">
            <PlaceholderCard
              title="Total platform cost"
              subtitle="Not yet wired"
              icon={<Server className="size-3.5" />}
              variant="chip"
            />
            <PlaceholderCard
              title="Estimated margin"
              subtitle="Not yet wired"
              icon={<TrendingUp className="size-3.5" />}
              variant="chip"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
