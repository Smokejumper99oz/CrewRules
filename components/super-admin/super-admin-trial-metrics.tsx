import type { ProTrialMetrics, ProTrialUsers } from "@/lib/super-admin/actions";
import { Activity, Clock, AlertTriangle, XCircle, TrendingUp } from "lucide-react";
import { SuperAdminTrialUsers } from "./super-admin-trial-users";

type SuperAdminTrialMetricsProps = {
  metrics: ProTrialMetrics;
  trialUsers: ProTrialUsers;
};

const cardBase = "rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-3";

/** Tinted card shells (same idea as Pending Deletions KPI: soft bg + border, no solid fills). */
const trialCardAmberLight = `${cardBase} border-amber-700/35 bg-amber-950/12`;
const trialCardAmberStrong = `${cardBase} border-amber-500/38 bg-amber-950/18`;
const trialCardDanger = `${cardBase} border-red-900/35 bg-red-950/14`;
const trialCardSuccess = `${cardBase} border-emerald-700/35 bg-emerald-950/12`;

export function SuperAdminTrialMetrics({ metrics, trialUsers }: SuperAdminTrialMetricsProps) {
  const hasAnyTrials =
    metrics.trialsStarted > 0 ||
    metrics.proTrialActive > 0 ||
    metrics.expiringIn7Days > 0 ||
    metrics.expiringIn3Days > 0 ||
    metrics.trialExpired > 0 ||
    metrics.convertedFromTrial > 0;

  if (!hasAnyTrials) {
    return (
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
          <Activity className="size-4 text-slate-400 shrink-0" />
          Pro Trial Health
        </h2>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-4 text-sm text-slate-400">
          No active Pro trials
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
        <Activity className="size-4 text-slate-400 shrink-0" />
        Pro Trial Health
      </h2>

      {/* Funnel row */}
      <div className="flex flex-wrap items-stretch gap-2">
        <div className={cardBase}>
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-0.5">
            <Clock className="size-3.5 shrink-0 text-slate-400" />
            Trials Started
          </div>
          <div className="text-xl font-semibold text-slate-200">{metrics.trialsStarted}</div>
        </div>
        <div className="text-slate-500 self-center shrink-0">→</div>
        <div className={trialCardAmberLight}>
          <div className="flex items-center gap-2 text-amber-200/75 text-xs mb-0.5">
            <AlertTriangle className="size-3.5 shrink-0 text-amber-400/70" />
            Expiring in 7 days
          </div>
          <div className="text-xl font-semibold text-amber-50/95">{metrics.expiringIn7Days}</div>
        </div>
        <div className="text-slate-500 self-center shrink-0">→</div>
        <div className={trialCardAmberStrong}>
          <div className="flex items-center gap-2 text-amber-200/85 text-xs mb-0.5">
            <AlertTriangle className="size-3.5 shrink-0 text-amber-400/85" />
            Expiring in 3 days
          </div>
          <div className="text-xl font-semibold text-amber-100">{metrics.expiringIn3Days}</div>
        </div>
        <div className="text-slate-500 self-center shrink-0">→</div>
        <div className={trialCardDanger}>
          <div className="flex items-center gap-2 text-rose-200/78 text-xs mb-0.5">
            <XCircle className="size-3.5 shrink-0 text-rose-400/72" />
            Trial Expired
          </div>
          <div className="text-xl font-semibold text-rose-50/95">{metrics.trialExpired}</div>
        </div>
        <div className="text-slate-500 self-center shrink-0">|</div>
        <div className={trialCardSuccess}>
          <div className="flex items-center gap-2 text-emerald-200/80 text-xs mb-0.5">
            <TrendingUp className="size-4 shrink-0 text-emerald-400/78" />
            Converted
          </div>
          <div className="text-xl font-semibold text-[#75C043]">{metrics.convertedFromTrial}</div>
        </div>
      </div>

      {/* Conversion rate + Avg days + Active */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/40 px-4 py-2">
          <TrendingUp className="size-4 text-slate-400" />
          <span className="text-xs text-slate-400">Trial conversion rate:</span>
          <span className="text-sm font-semibold text-slate-200">
            {metrics.trialConversionRate != null ? `${metrics.trialConversionRate}%` : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/40 px-4 py-2">
          <Clock className="size-4 text-slate-400" />
          <span className="text-xs text-slate-400">Active:</span>
          <span className="text-sm font-semibold text-slate-200">{metrics.proTrialActive}</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/40 px-4 py-2">
          <Clock className="size-4 text-slate-400" />
          <span className="text-xs text-slate-400">Avg days left:</span>
          <span className="text-sm font-semibold text-slate-200">
            {metrics.avgDaysRemaining != null ? metrics.avgDaysRemaining : "—"}
          </span>
        </div>
      </div>

      <div className="mt-2">
        <SuperAdminTrialUsers trialUsers={trialUsers} />
      </div>
    </div>
  );
}
