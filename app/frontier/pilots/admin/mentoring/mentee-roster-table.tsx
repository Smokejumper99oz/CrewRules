"use client";

import { useMemo, useState } from "react";
import { formatUsPhoneStored } from "@/lib/format-us-phone";

/** Admin table: show DOH as YYYY/MM/DD when stored as YYYY-MM-DD. */
function formatDohCell(value: string | null | undefined): string {
  if (value == null || !String(value).trim()) return "—";
  const s = String(value).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, "/");
  return s;
}

/** Compact toolbar selects — same visual family as Mentor Roster. */
const ROSTER_FILTER_SELECT_CLASS =
  "h-6 w-full min-w-0 cursor-pointer rounded border border-white/[0.07] bg-white/[0.03] px-1 py-0 pr-5 text-[10px] leading-none text-slate-300 transition-colors [color-scheme:dark] hover:border-white/11 hover:bg-white/[0.055] focus:border-[#75C043]/35 focus:outline-none focus:ring-1 focus:ring-[#75C043]/18 lg:bg-[length:0.5rem] lg:bg-[position:right_0.28rem_center] lg:bg-no-repeat lg:[background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748b'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E\")] lg:appearance-none";

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

type MenteeStatusFilter = "all" | "assigned" | "pending" | "unassigned";

export function MenteeRosterTable({ roster, counts }: Props) {
  const [openContactId, setOpenContactId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MenteeStatusFilter>("all");

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = roster;
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (q) {
      list = list.filter((r) => {
        const name = (r.name ?? "").toLowerCase();
        const emp = (r.employee_number ?? "").toLowerCase();
        const mentor = (r.mentor_name ?? "").toLowerCase();
        return name.includes(q) || emp.includes(q) || mentor.includes(q);
      });
    }
    return list;
  }, [roster, search, statusFilter]);

  const toggleContactId = (id: string) => {
    setOpenContactId((prev) => (prev === id ? null : id));
  };

  return (
    <div>
      <div className="mb-3 rounded-lg border border-white/5 bg-slate-950/35 px-2.5 py-1.5 lg:mb-2 lg:px-3 lg:py-1">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between lg:gap-3">
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-1.5 gap-y-1 sm:grid-cols-2 sm:items-end">
            <label className="min-w-0 sm:max-w-[15rem]">
              <span className="mb-px block text-[8px] font-semibold uppercase leading-none tracking-wide text-slate-500">
                Search
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, emp #, mentor..."
                className="h-6 w-full max-w-full rounded border border-white/[0.07] bg-white/[0.03] px-1.5 text-[10px] leading-none text-slate-300 placeholder:text-slate-600 transition-colors hover:border-white/11 hover:bg-white/[0.055] focus:border-[#75C043]/35 focus:outline-none focus:ring-1 focus:ring-[#75C043]/18"
              />
            </label>
            <label className="min-w-0">
              <span className="mb-px block text-[8px] font-semibold uppercase leading-none tracking-wide text-slate-500">
                Status
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as MenteeStatusFilter)}
                className={ROSTER_FILTER_SELECT_CLASS}
              >
                <option value="all">All</option>
                <option value="assigned">Assigned</option>
                <option value="pending">Pending</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </label>
          </div>
          <div className="flex min-h-6 shrink-0 items-center border-t border-white/5 pt-2 text-[10px] tabular-nums leading-none text-slate-500 sm:justify-end lg:min-h-0 lg:min-w-[10.5rem] lg:self-stretch lg:border-t-0 lg:border-l lg:border-white/[0.07] lg:pt-0 lg:pl-3 lg:pr-0.5 lg:items-end lg:justify-end">
            <span className="whitespace-nowrap lg:inline-block lg:rounded lg:border lg:border-white/[0.05] lg:bg-white/[0.02] lg:px-1.5 lg:py-px">
              <span className="font-medium text-slate-400">{filteredRows.length}</span>
              <span className="text-slate-600"> shown</span>
              <span className="text-slate-600"> · </span>
              <span className="font-medium text-slate-400">{roster.length}</span>
              <span className="text-slate-600"> in roster</span>
            </span>
          </div>
        </div>
      </div>
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
              <th className="py-2 px-2 text-center font-medium">Emp.#</th>
              <th className="py-2 px-2 text-center font-medium">DOH</th>
              <th className="py-2 px-2 text-center font-medium">Mentorship</th>
              <th className="py-2 px-2 text-center font-medium">Next Milestone</th>
              <th className="py-2 px-2 text-center font-medium">Status</th>
              <th className="text-center py-2 w-[60px]">CRA</th>
              <th className="text-left py-2 pl-2 pr-3 font-medium">Mentor</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => {
              const menteePhoneFmt = formatUsPhoneStored(r.mentee_phone);
              const mentorPhoneFmt = formatUsPhoneStored(r.mentor_phone);
              return (
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
                          <a
                            href={`mailto:${r.mentee_email}`}
                            className="block break-all text-xs text-slate-500 underline hover:no-underline"
                          >
                            {r.mentee_email}
                          </a>
                        ) : (
                          <div className="text-xs text-slate-500">No personal email on file</div>
                        )}
                        {menteePhoneFmt ? (
                          <div className="text-xs text-slate-500">{menteePhoneFmt}</div>
                        ) : null}
                      </>
                    )}
                  </div>
                </td>
                <td className="py-2 px-2 text-center font-mono tabular-nums text-slate-300">{r.employee_number}</td>
                <td className="py-2 px-2 text-center tabular-nums text-slate-300">{formatDohCell(r.hire_date)}</td>
                <td className="py-2 px-2 text-center">
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
                <td className="py-2 px-2 text-center text-slate-200">
                  {r.next_milestone === "Paused" ? (
                    <span className="text-amber-400">Paused</span>
                  ) : (
                    (r.next_milestone ?? "—")
                  )}
                </td>
                <td className="py-2 px-2 text-center">
                  {r.status === "assigned" ? (
                    <span className="text-emerald-400">Assigned</span>
                  ) : r.status === "pending" ? (
                    <span className="text-amber-400">Pending</span>
                  ) : (
                    <span className="text-slate-400">Unassigned</span>
                  )}
                </td>
                <td className="text-center py-2">
                  {r.mentor_account === "active" && (
                    <span className="text-emerald-400 font-semibold">✓</span>
                  )}
                  {r.mentor_account === "not_joined" && (
                    <span className="text-amber-400 font-semibold">✕</span>
                  )}
                  {r.mentor_account !== "active" && r.mentor_account !== "not_joined" && "—"}
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
                            <a
                              href={`mailto:${r.mentor_email}`}
                              className="block break-all text-xs text-slate-500 underline hover:no-underline"
                            >
                              {r.mentor_email}
                            </a>
                          ) : (
                            <div className="text-xs text-slate-500">No personal email on file</div>
                          )}
                          {mentorPhoneFmt ? (
                            <div className="text-xs text-slate-500">{mentorPhoneFmt}</div>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : (
                    <span>—</span>
                  )}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
