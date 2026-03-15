import type { TenantOverviewRow } from "@/lib/super-admin/actions";

type SuperAdminTenantOverviewProps = {
  tenants: TenantOverviewRow[];
};

function formatPlanMix(row: TenantOverviewRow): string {
  const parts: string[] = [];
  if (row.freeCount > 0) parts.push(`${row.freeCount} Free`);
  if (row.proCount > 0) parts.push(`${row.proCount} Pro`);
  if (row.enterpriseCount > 0) parts.push(`${row.enterpriseCount} Ent`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function SuperAdminTenantOverview({ tenants }: SuperAdminTenantOverviewProps) {
  const sorted = [...tenants].sort((a, b) => b.userCount - a.userCount);
  const totalUsers = sorted.reduce((sum, t) => sum + t.userCount, 0);

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-slate-200">Tenants</h2>

      <div className="rounded-lg border border-slate-600/40 bg-slate-800/40 px-4 py-2 text-sm text-slate-400">
        {sorted.length} tenant{sorted.length !== 1 ? "s" : ""} · {totalUsers} user
        {totalUsers !== 1 ? "s" : ""}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-800/50">
        <table className="w-full min-w-[400px] text-sm">
          <thead>
            <tr className="border-b border-slate-700/50 bg-slate-800/80">
              <th className="px-4 py-3 text-left font-medium text-slate-300">Tenant</th>
              <th className="px-4 py-3 text-right font-medium text-slate-300">Users</th>
              <th className="px-4 py-3 text-left font-medium text-slate-300">Plan mix</th>
              <th className="px-4 py-3 text-right font-medium text-slate-300">Family View</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => (
              <tr
                key={t.tenant}
                className={`border-b border-slate-700/30 last:border-0 ${
                  i % 2 === 1 ? "bg-slate-800/30" : ""
                } hover:bg-slate-800/50`}
              >
                <td className="px-4 py-3">
                  <span className="font-medium text-slate-200">{t.displayName}</span>
                  <span className="ml-1 text-xs text-slate-500">({t.tenant})</span>
                </td>
                <td className="px-4 py-3 text-right text-slate-200">{t.userCount}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{formatPlanMix(t)}</td>
                <td className="px-4 py-3 text-right text-slate-400">{t.familyViewEnabledCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
