import Link from "next/link";
import { format } from "date-fns";
import { gateSuperAdmin } from "@/lib/super-admin/gate";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMentoringOverviewStats } from "@/lib/mentoring/admin-overview-stats";
import { getMentoringAssignmentTableForSuperAdmin } from "@/lib/super-admin/mentoring-page-data";

export const dynamic = "force-dynamic";

const statCard =
  "rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 transition-all duration-200";

/** Empty table region: same chrome as KPI cards, slightly more padding for copy. */
const emptyStateCard = "rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 sm:p-6";

function formatHireDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr + "T12:00:00.000Z");
    if (Number.isNaN(d.getTime())) return "—";
    return format(d, "MMM d, yyyy");
  } catch {
    return "—";
  }
}

function statusLabel(row: {
  is_matched: boolean;
  assignment_active: boolean;
}): { text: string; warn: boolean } {
  if (!row.is_matched) return { text: "Unmatched", warn: true };
  if (row.assignment_active) return { text: "Active", warn: false };
  return { text: "Inactive", warn: false };
}

export default async function SuperAdminMentoringPage() {
  await gateSuperAdmin();

  const admin = createAdminClient();
  const [stats, rows] = await Promise.all([
    getMentoringOverviewStats(admin, { kind: "platform" }),
    getMentoringAssignmentTableForSuperAdmin(admin),
  ]);

  return (
    <div className="-mt-6 space-y-8 sm:-mt-8">
      <div className="space-y-4">
        <p className="text-sm text-slate-400">
          Platform-wide mentoring assignments. Read-only in this release — manage users and profile contact fields from
          Users.
        </p>

        <div
          className={`${statCard} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:py-3.5`}
        >
          <div className="min-w-0 flex-1 space-y-1 sm:max-w-xl">
            <h2 className="text-sm font-semibold text-slate-200 leading-snug">Upload mentees</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Bulk assignment import for mentors and mentees
            </p>
          </div>
          <Link
            href="/super-admin/mentoring/upload"
            className="inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-lg bg-[#75C043] px-4 py-2 text-sm font-semibold text-slate-950 hover:brightness-110 transition"
          >
            Upload Mentees
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className={statCard}>
          <div className="text-xs text-slate-400 mb-1">Mentors</div>
          <div className="text-2xl font-semibold text-slate-200 tabular-nums">{stats.mentors}</div>
        </div>
        <div className={statCard}>
          <div className="text-xs text-slate-400 mb-1">Active mentees</div>
          <div className="text-2xl font-semibold text-slate-200 tabular-nums">{stats.activeMentees}</div>
        </div>
        <div className={`${statCard} ${stats.unmatchedMentees > 0 ? "border-amber-600/30" : ""}`}>
          <div className="text-xs text-slate-400 mb-1">Unmatched mentees</div>
          <div
            className={`text-2xl font-semibold tabular-nums ${stats.unmatchedMentees > 0 ? "text-amber-300" : "text-slate-200"}`}
          >
            {stats.unmatchedMentees}
          </div>
        </div>
        <div className={`${statCard} ${stats.missingMentorContact > 0 ? "border-amber-600/30" : ""}`}>
          <div className="text-xs text-slate-400 mb-1">Missing mentor contact</div>
          <div
            className={`text-2xl font-semibold tabular-nums ${stats.missingMentorContact > 0 ? "text-amber-300" : "text-slate-200"}`}
          >
            {stats.missingMentorContact}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={emptyStateCard}>
          <h2 className="text-sm font-semibold text-slate-200">No mentoring assignments yet</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Assignment records will appear here once mentors and mentees are linked.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Use Users to verify mentor profiles and contact information before upload/import tools are added.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="px-4 py-3 text-left font-medium text-slate-300">Mentor</th>
                <th className="px-4 py-3 text-left font-medium text-slate-300">Mentee</th>
                <th className="px-4 py-3 text-left font-medium text-slate-300">Employee #</th>
                <th className="px-4 py-3 text-left font-medium text-slate-300">Hire date</th>
                <th className="px-4 py-3 text-left font-medium text-slate-300">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-300">Contact health</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = statusLabel(r);
                return (
                  <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-slate-200 max-w-[180px] truncate" title={r.mentor_name ?? undefined}>
                      {r.mentor_name?.trim() || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300 max-w-[180px] truncate" title={r.mentee_name ?? undefined}>
                      {r.is_matched ? r.mentee_name?.trim() || "—" : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">{r.employee_number ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-300">{formatHireDate(r.hire_date)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${
                          st.warn
                            ? "border-amber-500/40 bg-amber-500/20 text-amber-200"
                            : st.text === "Active"
                              ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
                              : "border-slate-500/40 bg-slate-500/20 text-slate-400"
                        }`}
                      >
                        {st.text}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${
                          r.mentor_contact_ok
                            ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
                            : "border-amber-500/40 bg-amber-500/20 text-amber-200"
                        }`}
                      >
                        {r.mentor_contact_ok ? "OK" : "Missing"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
