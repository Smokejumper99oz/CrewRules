import type { SuperAdminKpiData } from "@/lib/super-admin/actions";

type SuperAdminAtAGlanceProps = {
  kpis: SuperAdminKpiData;
};

export function SuperAdminAtAGlance({ kpis }: SuperAdminAtAGlanceProps) {
  const totalUsers = kpis.freeCount + kpis.proCount + kpis.enterpriseCount;

  const parts: string[] = [
    `${kpis.tenantCount} tenant${kpis.tenantCount !== 1 ? "s" : ""}`,
    `${totalUsers} user${totalUsers !== 1 ? "s" : ""}`,
  ];

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-2.5 text-sm text-slate-300">
      <span className="font-medium text-slate-200">At a glance:</span>{" "}
      {parts.join(" · ")}
      {kpis.proCount > 0 || kpis.enterpriseCount > 0 ? (
        <span className="text-slate-400">
          {" "}
          · {kpis.proCount} Pro{kpis.enterpriseCount > 0 ? ` · ${kpis.enterpriseCount} Enterprise` : ""}
        </span>
      ) : null}
    </div>
  );
}
