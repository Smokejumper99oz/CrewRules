import { gateSuperAdmin } from "@/lib/super-admin/gate";
import {
  getPendingDeletionsForSuperAdmin,
  getRecentAccountDeletionLogsForSuperAdmin,
} from "@/lib/super-admin/actions";

export const dynamic = "force-dynamic";

const card = "rounded-xl border border-slate-700/50 bg-slate-800/50 p-4";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default async function SuperAdminPendingDeletionsPage() {
  await gateSuperAdmin();

  const [pending, recentLogs] = await Promise.all([
    getPendingDeletionsForSuperAdmin(),
    getRecentAccountDeletionLogsForSuperAdmin(75),
  ]);

  return (
    <div className="-mt-6 space-y-8 sm:-mt-8">
      <div>
        <h2 className="text-base font-semibold text-slate-100">Pending deletions</h2>
        <p className="mt-1 text-sm text-slate-400">
          Accounts in the grace window ({pending.length} with a scheduled purge date).
        </p>
      </div>

      <section className={card}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm text-slate-200">
            <thead>
              <tr className="border-b border-slate-600/60 text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2 pr-3 font-semibold">User</th>
                <th className="pb-2 pr-3 font-semibold">Email</th>
                <th className="pb-2 pr-3 font-semibold">Tenant</th>
                <th className="pb-2 pr-3 font-semibold">Portal</th>
                <th className="pb-2 pr-3 font-semibold">Scheduled for</th>
                <th className="pb-2 pr-3 font-semibold">Requested</th>
                <th className="pb-2 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody>
              {pending.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No pending scheduled deletions.
                  </td>
                </tr>
              ) : (
                pending.map((row) => (
                  <tr key={row.id} className="border-b border-slate-700/40 align-top">
                    <td className="py-3 pr-3">
                      <div className="font-medium text-slate-100">
                        {row.full_name?.trim() || "—"}
                      </div>
                      <code className="mt-0.5 block text-[11px] text-slate-500">{row.id}</code>
                    </td>
                    <td className="max-w-[180px] py-3 pr-3 break-all text-slate-300">
                      {row.email ?? "—"}
                    </td>
                    <td className="py-3 pr-3 text-slate-300">{row.tenant}</td>
                    <td className="py-3 pr-3 text-slate-300">{row.portal}</td>
                    <td className="whitespace-nowrap py-3 pr-3 text-slate-300">
                      {fmt(row.deletion_scheduled_for)}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 text-slate-300">
                      {fmt(row.deleted_at)}
                    </td>
                    <td className="max-w-[240px] py-3 text-slate-300 whitespace-pre-wrap break-words">
                      {row.deletion_reason?.trim() || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div>
        <h2 className="text-base font-semibold text-slate-100">Recent finalization log</h2>
        <p className="mt-1 text-sm text-slate-400">
          Last 75 finalize attempts (success and failure). Row survives after profile/auth removal.
        </p>
      </div>

      <section className={card}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm text-slate-200">
            <thead>
              <tr className="border-b border-slate-600/60 text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2 pr-3 font-semibold">Started</th>
                <th className="pb-2 pr-3 font-semibold">Status</th>
                <th className="pb-2 pr-3 font-semibold">User id</th>
                <th className="pb-2 pr-3 font-semibold">Email (snapshot)</th>
                <th className="pb-2 pr-3 font-semibold">Auth deleted</th>
                <th className="pb-2 pr-3 font-semibold">Completed</th>
                <th className="pb-2 pr-3 font-semibold">Error</th>
                <th className="pb-2 font-semibold">Reason (snapshot)</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No log rows yet.
                  </td>
                </tr>
              ) : (
                recentLogs.map((row) => (
                  <tr key={row.id} className="border-b border-slate-700/40 align-top">
                    <td className="whitespace-nowrap py-3 pr-3 text-slate-300">
                      {fmt(row.started_at)}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={
                          row.status === "success"
                            ? "text-emerald-400"
                            : row.status === "failed"
                              ? "text-red-400"
                              : "text-amber-200/90"
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <code className="text-[11px] text-slate-500">{row.user_id ?? "—"}</code>
                    </td>
                    <td className="max-w-[140px] py-3 pr-3 break-all text-slate-300">
                      {row.email ?? "—"}
                    </td>
                    <td className="py-3 pr-3 text-slate-300">
                      {row.deleted_auth_user ? "Yes" : "No"}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 text-slate-300">
                      {fmt(row.completed_at)}
                    </td>
                    <td className="max-w-[200px] py-3 pr-3 break-words text-red-300/90">
                      {row.error ?? "—"}
                    </td>
                    <td className="max-w-[220px] py-3 text-slate-300 whitespace-pre-wrap break-words">
                      {row.deletion_reason?.trim() || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
