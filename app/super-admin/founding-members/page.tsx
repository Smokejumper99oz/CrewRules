import { gateSuperAdmin } from "@/lib/super-admin/gate";
import { getFoundingMembersForSuperAdmin } from "@/lib/super-admin/actions";

function displayName(row: { full_name: string | null; email: string | null }): string {
  const n = row.full_name?.trim();
  if (n) return n;
  return row.email?.trim() || "—";
}

function formatJoined(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default async function SuperAdminFoundingMembersPage() {
  await gateSuperAdmin();
  const members = await getFoundingMembersForSuperAdmin();

  return (
    <div className="-mt-6 space-y-2 sm:-mt-8">
      <div>
        <p className="text-sm text-slate-400">
          Founding Pilots — profiles with Founding Pilot status ({members.length} total).
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-white/5">
              <th className="px-4 py-3 text-left font-medium text-slate-300">Pilot #</th>
              <th className="px-4 py-3 text-left font-medium text-slate-300">Name</th>
              <th className="px-4 py-3 text-left font-medium text-slate-300">Email</th>
              <th className="px-4 py-3 text-left font-medium text-slate-300">Tenant</th>
              <th className="px-4 py-3 text-left font-medium text-slate-300">Role</th>
              <th className="px-4 py-3 text-left font-medium text-slate-300">Joined date</th>
              <th className="px-4 py-3 text-left font-medium text-slate-300">Subscription tier</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-slate-200 tabular-nums">
                  {m.founding_pilot_number != null ? m.founding_pilot_number : "—"}
                </td>
                <td className="px-4 py-3 text-slate-200">{displayName(m)}</td>
                <td className="px-4 py-3 text-slate-300">{m.email ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300">{m.tenant}</td>
                <td className="px-4 py-3 text-slate-300">{m.role}</td>
                <td className="px-4 py-3 text-slate-300">{formatJoined(m.founding_pilot_started_at)}</td>
                <td className="px-4 py-3 text-slate-300 capitalize">
                  {m.subscription_tier ?? "free"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-slate-500">No founding members yet.</p>
      ) : null}
    </div>
  );
}
