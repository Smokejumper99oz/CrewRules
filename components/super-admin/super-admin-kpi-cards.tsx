import type { SuperAdminKpiData } from "@/lib/super-admin/actions";
import { CreditCard, Building2, UserPlus } from "lucide-react";
import { SuperAdminComingSoonStrip } from "./super-admin-coming-soon-strip";

type SuperAdminKpiCardsProps = {
  kpis: SuperAdminKpiData;
};

const cardBase =
  "rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 transition-all duration-200";

export function SuperAdminKpiCards({ kpis }: SuperAdminKpiCardsProps) {
  const totalUsers = kpis.freeCount + kpis.proCount + kpis.enterpriseCount;

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-slate-200">Business</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className={cardBase}>
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <Building2 className="size-3.5" />
            Tenants
          </div>
          <div className="text-2xl font-semibold text-slate-200">{kpis.tenantCount}</div>
        </div>
        <div className={cardBase}>
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <UserPlus className="size-3.5" />
            Total Users
          </div>
          <div className="text-2xl font-semibold text-slate-200">{totalUsers}</div>
        </div>
        <div className={`${cardBase} border-[#75C043]/30`}>
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <UserPlus className="size-3.5" />
            New signups 30d
          </div>
          <div className="text-2xl font-semibold text-slate-200">{kpis.newSignups30d}</div>
        </div>
        <div className={`${cardBase} border-amber-600/30`}>
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <CreditCard className="size-3.5" />
            Pro
          </div>
          <div className="text-2xl font-semibold text-amber-400">{kpis.proCount}</div>
        </div>
        <div className={`${cardBase} border-[#75C043]/30`}>
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
            <CreditCard className="size-3.5" />
            Enterprise
          </div>
          <div className="text-2xl font-semibold text-[#75C043]">{kpis.enterpriseCount}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-500">Secondary:</span>
          <span className="rounded-md bg-slate-800/50 px-2 py-0.5 text-xs text-slate-400">
            {kpis.newSignupsToday} today
          </span>
          <span className="rounded-md bg-slate-800/50 px-2 py-0.5 text-xs text-slate-400">
            {kpis.newSignups7d} in 7d
          </span>
          <span className="rounded-md bg-slate-800/50 px-2 py-0.5 text-xs text-slate-400">
            {kpis.freeCount} Free
          </span>
        </div>
        <div className="h-px flex-1 min-w-[80px] bg-slate-700/50" />
        <SuperAdminComingSoonStrip />
      </div>
    </div>
  );
}
