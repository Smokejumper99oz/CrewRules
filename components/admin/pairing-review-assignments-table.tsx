"use client";

import { useMemo, useState } from "react";
import { PairingReviewMenteeStatusDialog } from "@/components/admin/pairing-review-mentee-status-dialog";
import { PairingReviewMentorContactHealthDialog } from "@/components/admin/pairing-review-mentor-contact-health-dialog";
import { SuperAdminMentorAssignmentHireDateEdit } from "@/components/super-admin/super-admin-mentor-assignment-hire-date-edit";
import type { SuperAdminMentoringTableRow } from "@/lib/super-admin/mentoring-page-data";
import { statusLabel } from "@/lib/super-admin/mentoring-page-data";
import { updateFrontierPilotAdminMentorAssignmentHireDateFormState } from "@/app/frontier/pilots/admin/mentoring/actions";

function menteeVisibleName(r: SuperAdminMentoringTableRow): string {
  return (r.is_matched ? r.mentee_name : r.staged_mentee_name)?.trim() ?? "";
}

function rowMatchesQuery(query: string, r: SuperAdminMentoringTableRow): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const mentor = (r.mentor_name ?? "").toLowerCase();
  const mentee = menteeVisibleName(r).toLowerCase();
  const emp = (r.employee_number ?? "").toLowerCase();
  const statusText = statusLabel(r).text.toLowerCase();
  return (
    mentor.includes(q) || mentee.includes(q) || emp.includes(q) || statusText.includes(q)
  );
}

export type PairingReviewAssignmentsTableProps = {
  rows: SuperAdminMentoringTableRow[];
};

export function PairingReviewAssignmentsTable({ rows }: PairingReviewAssignmentsTableProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => rows.filter((r) => rowMatchesQuery(search, r)),
    [rows, search]
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <label htmlFor="pairing-review-search" className="sr-only">
          Search pairings
        </label>
        <input
          id="pairing-review-search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search mentor name, mentee name, number, or mentee status"
          autoComplete="off"
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500">No pairings match your search.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-600">Mentor Name</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Mentee Name</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Mentee Employee #</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">DOH</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Mentee Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Mentor Contact</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const st = statusLabel(r);
                return (
                  <tr key={r.id} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900 max-w-[180px] truncate" title={r.mentor_name ?? undefined}>
                      {r.mentor_name?.trim() || "—"}
                    </td>
                    <td
                      className="px-4 py-3 text-slate-700 max-w-[180px] truncate"
                      title={(r.is_matched ? r.mentee_name : r.staged_mentee_name) ?? undefined}
                    >
                      {r.is_matched
                        ? r.mentee_name?.trim() || "—"
                        : r.staged_mentee_name?.trim() || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-mono text-xs">
                      {r.employee_number?.trim() || "Pending"}
                    </td>
                    <td className="px-4 py-3 align-middle text-slate-700">
                      <SuperAdminMentorAssignmentHireDateEdit
                        assignmentId={r.id}
                        hireDateIso={r.hire_date}
                        formAction={updateFrontierPilotAdminMentorAssignmentHireDateFormState}
                        tone="light"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <PairingReviewMenteeStatusDialog
                        statusText={st.text}
                        warn={st.warn}
                        isMatched={r.is_matched}
                        menteeName={r.mentee_name}
                        stagedMenteeName={r.staged_mentee_name}
                        employeeNumber={r.employee_number}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <PairingReviewMentorContactHealthDialog
                        mentorContactOk={r.mentor_contact_ok}
                        mentorName={r.mentor_name}
                        mentorContactEmail={r.mentor_contact_email}
                        mentorPhone={r.mentor_phone}
                        mentorProfilePhone={r.mentor_profile_phone}
                      />
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
