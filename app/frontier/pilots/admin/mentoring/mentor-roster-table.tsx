"use client";

import { useState } from "react";

export type MentorRosterRow = {
  id: string;
  full_name: string | null;
  employee_number: string | null;
  phone: string | null;
  mentor_phone: string | null;
  mentor_contact_email: string | null;
  welcome_modal_version_seen: number | null;
  mentee_count: number;
};

type Props = {
  rows: MentorRosterRow[];
};

export function MentorRosterTable({ rows }: Props) {
  const [openContactId, setOpenContactId] = useState<string | null>(null);

  const toggleContactId = (id: string) => {
    setOpenContactId((prev) => (prev === id ? null : id));
  };

  return (
    <>
      <div className="flex gap-4 text-sm pb-2">
        <span className="text-slate-400">Mentors: {rows.length}</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-white/5">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="border-b border-white/5 bg-white/[0.03] text-slate-400">
            <tr>
              <th className="text-center py-2 w-[60px]">CRA</th>
              <th className="py-2 pl-3 pr-2 text-left font-medium">Name</th>
              <th className="py-2 px-2 text-left font-medium">Emp.#</th>
              <th className="py-2 px-2 text-left font-medium">Phone</th>
              <th className="py-2 px-2 text-left font-medium">Mentor contact email</th>
              <th className="text-right py-2 pl-2 pr-3 font-medium">Mentees</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const craActive = m.welcome_modal_version_seen != null;
              const count = m.mentee_count;
              const name = m.full_name?.trim() || "—";
              const emp = (m.employee_number ?? "").trim() || "—";
              const phoneDisplay =
                (m.mentor_phone ?? "").trim() || (m.phone ?? "").trim() || null;
              const contactEmail = (m.mentor_contact_email ?? "").trim() || null;
              return (
                <tr key={m.id} className="border-t border-white/5">
                  <td className="text-center py-2">
                    {craActive ? (
                      <span className="text-emerald-400 font-semibold">✓</span>
                    ) : (
                      <span className="text-amber-400 font-semibold">✕</span>
                    )}
                  </td>
                  <td className="py-2 pl-3 pr-2 text-slate-200">
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => toggleContactId(m.id)}
                        className="text-left text-slate-200 hover:underline"
                      >
                        {name}
                      </button>
                      {openContactId === m.id && (
                        <>
                          {contactEmail ? (
                            <div className="text-xs text-slate-500">{contactEmail}</div>
                          ) : (
                            <div className="text-xs text-slate-500">No mentor contact email on file</div>
                          )}
                          {phoneDisplay ? (
                            <div className="text-xs text-slate-500">{phoneDisplay}</div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-slate-300">{emp}</td>
                  <td className="py-2 px-2 text-slate-300">{phoneDisplay || "—"}</td>
                  <td className="py-2 px-2 text-slate-300">{contactEmail || "—"}</td>
                  <td className="py-2 pl-2 pr-3 text-right tabular-nums text-slate-300">{count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
