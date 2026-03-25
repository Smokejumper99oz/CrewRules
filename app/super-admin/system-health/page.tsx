import { SuperAdminImportWarnings } from "@/components/super-admin/super-admin-import-warnings";
import { gateSuperAdmin } from "@/lib/super-admin/gate";
import { getRecentImportWarningsForSuperAdmin } from "@/lib/super-admin/actions";

const sectionCard = "rounded-xl border border-slate-700/50 bg-slate-800/50 p-4";

export default async function SuperAdminSystemHealthPage() {
  await gateSuperAdmin();

  const importWarnings = await getRecentImportWarningsForSuperAdmin();

  return (
    <div className="-mt-6 space-y-4 sm:-mt-8">
      <section className={sectionCard}>
        <h2 className="text-sm font-semibold text-slate-200">System Status</h2>
        <p className="mt-2 text-sm text-slate-300">All systems operational</p>
      </section>

      <SuperAdminImportWarnings warnings={importWarnings} />

      <section className={sectionCard}>
        <h2 className="text-sm font-semibold text-slate-200">System Events</h2>
        <p className="mt-3 text-sm text-slate-300">No issues detected</p>
        <p className="mt-1.5 text-sm leading-snug text-slate-500">
          Vercel, API, and platform alerts will appear here
        </p>
      </section>
    </div>
  );
}
