import { gateSuperAdmin } from "@/lib/super-admin/gate";

export default async function SuperAdminSystemHealthPage() {
  await gateSuperAdmin();

  return (
    <div className="-mt-6 space-y-4 sm:-mt-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-100">System Health</h1>
        <p className="mt-1 text-sm text-slate-400">
          Track Platform Health, Deployment Issues, and Operational Events.
        </p>
      </div>

      <div className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-8 text-sm text-slate-400">
        <p className="text-slate-300">No System Events Yet</p>
        <p className="mt-2">Vercel, API, and Platform Alerts Will Appear Here.</p>
      </div>
    </div>
  );
}
