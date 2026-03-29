"use client";

import { useState } from "react";

export type MenteeRosterRow = {
  key: string;
  name: string;
  employee_number: string;
  hire_date: string | null;
  mentor_name: string | null;
  mentorship_status: string | null;
  next_milestone: string | null;
  mentor_account: "active" | "not_joined" | null;
  mentee_account: "active" | "not_joined" | null;
  status: "assigned" | "pending" | "unassigned";
  mentee_email: string | null;
  mentee_phone: string | null;
  mentor_email: string | null;
  mentor_phone: string | null;
};

type Props = {
  roster: MenteeRosterRow[];
  counts: { assigned: number; pending: number; unassigned: number };
};

export function MenteeRosterTable({ roster, counts }: Props) {
  const [openContactId, setOpenContactId] = useState<string | null>(null);

  const toggleContactId = (id: string) => {
    setOpenContactId((prev) => (prev === id ? null : id));
  };

  return (
    <div>
      <div className="flex gap-4 text-sm pb-2">
        <span className="text-emerald-400">Assigned: {counts.assigned}</span>
        <span className="text-amber-400">Pending: {counts.pending}</span>
        <span className="text-slate-400">Unassigned: {counts.unassigned}</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-white/5">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="border-b border-white/5 bg-white/[0.03] text-slate-400">
            <tr>
              <th className="text-center py-2 w-[60px]">CRA</th>
              <th className="py-2 pl-3 pr-2 text-left font-medium">Mentee Name</th>
              <th className="py-2 px-2 text-left font-medium">Emp.#</th>
              <th className="py-2 px-2 text-left font-medium">DOH</th>
              <th className="text-left py-2 px-2 font-medium">Mentorship</th>
              <th className="text-left py-2 px-2 font-medium">Next Milestone</th>
              <th className="py-2 px-2 text-left font-medium">Status</th>
              <th className="text-center py-2 w-[60px]">CRA</th>
              <th className="text-left py-2 pl-2 pr-3 font-medium">Mentor</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((r) => (
              <tr key={r.key} className="border-t border-white/5">
                <td className="text-center py-2">
                  {r.mentee_account === "active" && (
                    <span className="text-emerald-400 font-semibold">✓</span>
                  )}
                  {r.mentee_account === "not_joined" && (
                    <span className="text-amber-400 font-semibold">✕</span>
                  )}
                </td>
                <td className="py-2 pl-3 pr-2 text-slate-200">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => toggleContactId(`${r.key}:mentee`)}
                      className="text-left text-slate-200 hover:underline"
                    >
                      {r.name}
                    </button>
                    {openContactId === `${r.key}:mentee` && (
                      <>
                        {r.mentee_email ? (
                          <div className="text-xs text-slate-500">{r.mentee_email}</div>
                        ) : (
                          <div className="text-xs text-slate-500">No personal email on file</div>
                        )}
                        {r.mentee_phone ? (
                          <div className="text-xs text-slate-500">{r.mentee_phone}</div>
                        ) : null}
                      </>
                    )}
                  </div>
                </td>
                <td className="py-2 px-2 text-slate-300">{r.employee_number}</td>
                <td className="py-2 px-2 text-slate-300">{r.hire_date ?? "—"}</td>
                <td className="py-2 px-2">
                  {r.mentorship_status === "Military Leave" && (
                    <span className="text-amber-400">Military Leave</span>
                  )}
                  {r.mentorship_status === "Active" && (
                    <span className="text-emerald-400">Active</span>
                  )}
                  {!r.mentorship_status && "—"}
                  {r.mentorship_status &&
                    r.mentorship_status !== "Military Leave" &&
                    r.mentorship_status !== "Active" && (
                      <span className="text-slate-300">{r.mentorship_status}</span>
                    )}
                </td>
                <td className="py-2 px-2 text-slate-200">
                  {r.next_milestone === "Paused" ? (
                    <span className="text-amber-400">Paused</span>
                  ) : (
                    (r.next_milestone ?? "—")
                  )}
                </td>
                <td className="py-2 px-2">
                  {r.status === "assigned" ? (
                    <span className="text-emerald-400">Assigned</span>
                  ) : r.status === "pending" ? (
                    <span className="text-amber-400">Pending</span>
                  ) : (
                    <span className="text-slate-400">Unassigned</span>
                  )}
                </td>
                <td className="text-center py-2">
                  {r.mentor_name && <span className="text-emerald-400 font-semibold">✓</span>}
                  {!r.mentor_name && "—"}
                </td>
                <td className="py-2 pl-2 pr-3 text-slate-200">
                  {r.mentor_name && r.mentor_name !== "—" ? (
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => toggleContactId(`${r.key}:mentor`)}
                        className="text-left text-slate-200 hover:underline"
                      >
                        {r.mentor_name}
                      </button>
                      {openContactId === `${r.key}:mentor` && (
                        <>
                          {r.mentor_email ? (
                            <div className="text-xs text-slate-500">{r.mentor_email}</div>
                          ) : (
                            <div className="text-xs text-slate-500">No personal email on file</div>
                          )}
                          {r.mentor_phone ? (
                            <div className="text-xs text-slate-500">{r.mentor_phone}</div>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : (
                    <span>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
