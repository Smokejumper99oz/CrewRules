import { createAdminClient } from "@/lib/supabase/admin";
import { getMentoringAssignmentTableForTenant } from "@/lib/super-admin/mentoring-page-data";
import { SuperAdminMentorAssignmentHireDateEdit } from "@/components/super-admin/super-admin-mentor-assignment-hire-date-edit";
import { updateFrontierPilotAdminMentorAssignmentHireDateFormState } from "../actions";

export const dynamic = "force-dynamic";

const TENANT = "frontier";
const PORTAL = "pilots";

const emptyStateCard = "rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm";

function statusLabel(row: {
  is_matched: boolean;
  assignment_active: boolean;
}): { text: string; warn: boolean } {
  if (!row.is_matched) return { text: "Unmatched", warn: true };
  if (row.assignment_active) return { text: "Active", warn: false };
  return { text: "Inactive", warn: false };
}

export default async function FrontierPilotAdminMentoringAssignmentsPage() {
  const admin = createAdminClient();
  const rows = await getMentoringAssignmentTableForTenant(admin, { tenant: TENANT, portal: PORTAL });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight border-b border-slate-200 pb-3 text-[#1a2b4b]">Assignments</h1>
        <p className="mt-2 text-sm text-slate-600">
          Mentoring assignments for this tenant. Correct hire dates per assignment; saving updates milestone due dates from
          the standard schedule.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className={emptyStateCard}>
          <h2 className="text-sm font-semibold text-slate-800">No mentoring assignments in this tenant</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Assignments appear when mentors in this tenant have mentoring records.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-600">Mentor</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Mentee</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Employee #</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">DOH</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Contact health</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const st = statusLabel(r);
                return (
                  <tr key={r.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900 max-w-[180px] truncate" title={r.mentor_name ?? undefined}>
                      {r.mentor_name?.trim() || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate" title={r.mentee_name ?? undefined}>
                      {r.is_matched ? r.mentee_name?.trim() || "—" : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-mono text-xs">{r.employee_number ?? "—"}</td>
                    <td className="px-4 py-3 align-middle text-slate-700">
                      <SuperAdminMentorAssignmentHireDateEdit
                        assignmentId={r.id}
                        hireDateIso={r.hire_date}
                        formAction={updateFrontierPilotAdminMentorAssignmentHireDateFormState}
                        tone="light"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${
                          st.warn
                            ? "border-amber-300 bg-amber-50 text-amber-900"
                            : st.text === "Active"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                              : "border-slate-200 bg-slate-100 text-slate-700"
                        }`}
                      >
                        {st.text}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${
                          r.mentor_contact_ok
                            ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                            : "border-amber-300 bg-amber-50 text-amber-900"
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
