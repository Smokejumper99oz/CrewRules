import type {
  SuperAdminKpiData,
  ProTrialMetrics,
  TenantOverviewRow,
  StripeBillingMetrics,
  ChurnRenewalMetrics,
  FlightAwareUsageMetrics,
} from "@/lib/super-admin/actions";
import {
  PRO_MONTHLY_PRICE_USD,
  ENTERPRISE_MONTHLY_PRICE_USD,
} from "@/lib/super-admin/pricing-config";
import { DollarSign, Database, Brain, Mail, Server, TrendingUp } from "lucide-react";
import { PlaceholderCard } from "./placeholder-card";

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUsdCost(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

type SuperAdminCostMonetizationProps = {
  kpis: SuperAdminKpiData;
  trialMetrics: ProTrialMetrics;
  tenants: TenantOverviewRow[];
  stripeBilling: StripeBillingMetrics;
  churnRenewal: ChurnRenewalMetrics;
  flightAwareMetrics: FlightAwareUsageMetrics;
};

const cardBase = "rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-3";

export function SuperAdminCostMonetization({
  kpis,
  trialMetrics,
  tenants,
  churnRenewal,
  stripeBilling,
  flightAwareMetrics,
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
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-4">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Revenue</div>

          {/* Live MRR hero */}
          <div
            className="rounded-xl border-2 border-emerald-600/50 bg-emerald-950/30 p-5 flex flex-col gap-1"
            title="Stripe-paid Pro subscriptions only."
          >
            <div className="flex items-center gap-2 text-emerald-300/90 text-xs uppercase tracking-wider">
              <DollarSign className="size-4" />
              Live MRR
            </div>
            <div className="text-3xl font-bold text-emerald-200">{formatUsd(stripeBilling.liveMRR)}</div>
            <div className="text-sm text-slate-400">ARR {formatUsd(stripeBilling.liveARR)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Stripe-paid Pro only</div>
          </div>

          {/* Live Stripe breakdown */}
          <div className="flex flex-wrap gap-2">
            <div className={`${cardBase} border-emerald-600/20 py-2 px-3`}>
              <div className="text-slate-500 text-[10px] mb-0.5">Paid Pro</div>
              <div className="text-lg font-semibold text-emerald-300/90">{stripeBilling.paidProCount}</div>
            </div>
            <div className={`${cardBase} py-2 px-3`}>
              <div className="text-slate-500 text-[10px] mb-0.5">Monthly</div>
              <div className="text-lg font-semibold text-slate-200">{stripeBilling.monthlyCount}</div>
            </div>
            <div className={`${cardBase} py-2 px-3`}>
              <div className="text-slate-500 text-[10px] mb-0.5">Annual</div>
              <div className="text-lg font-semibold text-slate-200">{stripeBilling.annualCount}</div>
            </div>
          </div>

          {/* Churn & Renewal Watch */}
          <div className="pt-3 border-t border-slate-700/50 space-y-2">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Churn & Renewal Watch
            </div>
            <div className="flex flex-wrap gap-2">
              <div
                className={`${cardBase} py-2 px-3 ${
                  churnRenewal.cancelAtPeriodEndCount > 0 ? "border-amber-600/40 bg-amber-950/20" : ""
                }`}
              >
                <div className="text-slate-500 text-[10px] mb-0.5">Cancel at period end</div>
                <div
                  className={`text-lg font-semibold ${
                    churnRenewal.cancelAtPeriodEndCount > 0 ? "text-amber-400" : "text-slate-200"
                  }`}
                >
                  {churnRenewal.cancelAtPeriodEndCount}
                </div>
              </div>
              <div
                className={`${cardBase} py-2 px-3 ${
                  churnRenewal.pastDueCount > 0 ? "border-amber-600/40 bg-amber-950/20" : ""
                }`}
              >
                <div className="text-slate-500 text-[10px] mb-0.5">Past due</div>
                <div
                  className={`text-lg font-semibold ${
                    churnRenewal.pastDueCount > 0 ? "text-amber-400" : "text-slate-200"
                  }`}
                >
                  {churnRenewal.pastDueCount}
                </div>
              </div>
              <div className={`${cardBase} py-2 px-3`}>
                <div className="text-slate-500 text-[10px] mb-0.5">Renewals 7d</div>
                <div className="text-lg font-semibold text-slate-200">{churnRenewal.renewalsDueIn7Days}</div>
              </div>
              <div className={`${cardBase} py-2 px-3`}>
                <div className="text-slate-500 text-[10px] mb-0.5">Renewals 30d</div>
                <div className="text-lg font-semibold text-slate-200">{churnRenewal.renewalsDueIn30Days}</div>
              </div>
            </div>
          </div>

          {/* Tier overview */}
          <div className="pt-3 border-t border-slate-700/50">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              Tier overview
            </div>
            <div className="flex flex-wrap gap-2">
              <div className={`${cardBase} py-2 px-3 opacity-90`}>
                <div className="text-slate-500 text-[10px] mb-0.5">Pro users</div>
                <div className="text-base font-medium text-slate-300">{kpis.proCount}</div>
              </div>
              <div className={`${cardBase} py-2 px-3 opacity-90`}>
                <div className="text-slate-500 text-[10px] mb-0.5">Enterprise users</div>
                <div className="text-base font-medium text-slate-300">{kpis.enterpriseCount}</div>
              </div>
              <div className={`${cardBase} py-2 px-3 opacity-90`}>
                <div className="text-slate-500 text-[10px] mb-0.5">Enterprise tenants</div>
                <div className="text-base font-medium text-slate-300">{enterpriseTenants}</div>
              </div>
              <div className={`${cardBase} py-2 px-3 opacity-90`}>
                <div className="text-slate-500 text-[10px] mb-0.5">Active trials</div>
                <div className="text-base font-medium text-slate-300">{trialMetrics.proTrialActive}</div>
              </div>
              <div className={`${cardBase} py-2 px-3 opacity-90 border-[#75C043]/20`}>
                <div className="text-slate-500 text-[10px] mb-0.5">Converted</div>
                <div className="text-base font-medium text-[#75C043]/90">{trialMetrics.convertedFromTrial}</div>
              </div>
            </div>
          </div>

          {/* Estimated (pre-billing) */}
          <div className="pt-3 border-t border-slate-700/50">
            <div className="text-[10px] font-medium text-slate-600 uppercase tracking-wider mb-1.5">
              Pre-billing estimate
            </div>
            <div
              className="rounded-lg border border-slate-700/40 bg-slate-900/40 px-3 py-2 flex flex-col gap-0.5"
              title="Based on tier counts × configured prices."
            >
              <div className="flex items-center gap-2 text-slate-500 text-xs">
                <DollarSign className="size-3" />
                Estimated MRR
              </div>
              <div className="text-sm font-medium text-slate-500">
                {formatUsd(estimatedMRR)} <span className="text-slate-600">· ARR {formatUsd(estimatedARR)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Cost block */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4 space-y-3">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Cost</div>
          <div className="flex flex-wrap gap-2">
            <div className={`${cardBase} py-2 px-3`}>
              <div className="text-slate-500 text-[10px] mb-0.5">FlightAware</div>
              <div className="text-lg font-semibold text-slate-200">{flightAwareMetrics.totalCalls}</div>
              <div className="text-xs text-slate-500">{formatUsdCost(flightAwareMetrics.estimatedCost)}</div>
            </div>
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
