"use client";

import { useState } from "react";
import { formatUsPhoneStored } from "@/lib/format-us-phone";

export type MentorRosterRow = {
  rowKind: "profile" | "preload";
  id: string;
  full_name: string | null;
  employee_number: string | null;
  /** Raw stored phone (profile: mentor_phone || phone; preload: phone). Formatted in UI. */
  phone: string | null;
  /** Raw stored email (profile: mentor_contact_email; preload: work_email). */
  email: string | null;
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

  const rowKey = (m: MentorRosterRow) => `${m.rowKind}-${m.id}`;

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
              const craOnCrewRules = m.rowKind === "profile";
              const count = m.mentee_count;
              const name = m.full_name?.trim() || "—";
              const emp = (m.employee_number ?? "").trim() || "—";
              const phoneFormatted = formatUsPhoneStored(m.phone);
              const contactEmail = (m.email ?? "").trim() || null;
              return (
                <tr key={rowKey(m)} className="border-t border-white/5">
                  <td className="text-center py-2">
                    {craOnCrewRules ? (
                      <span className="text-emerald-400 font-semibold" title="On CrewRules">
                        ✓
                      </span>
                    ) : (
                      <span className="text-amber-400 font-semibold" title="Preload — not on CrewRules yet">
                        ✕
                      </span>
                    )}
                  </td>
                  <td className="py-2 pl-3 pr-2 text-slate-200">
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => toggleContactId(rowKey(m))}
                        className="text-left text-slate-200 hover:underline"
                      >
                        {name}
                      </button>
                      {openContactId === rowKey(m) && (
                        <>
                          {contactEmail ? (
                            <div className="text-xs text-slate-500">{contactEmail}</div>
                          ) : (
                            <div className="text-xs text-slate-500">No mentor contact email on file</div>
                          )}
                          {phoneFormatted ? (
                            <div className="text-xs text-slate-500">{phoneFormatted}</div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-slate-300">{emp}</td>
                  <td className="py-2 px-2 text-slate-300">{phoneFormatted || "—"}</td>
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
