"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatUsPhoneStored } from "@/lib/format-us-phone";
import type { MenteeRosterMentorOption } from "@/app/frontier/pilots/admin/mentoring/mentee-roster/mentee-roster-mentor-options";
import { MenteeRosterReassignMentor } from "@/app/frontier/pilots/admin/mentoring/mentee-roster-reassign-mentor";

/** Admin table: show DOH as YYYY/MM/DD when stored as YYYY-MM-DD. */
function formatDohCell(value: string | null | undefined): string {
  if (value == null || !String(value).trim()) return "—";
  const s = String(value).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, "/");
  return s;
}

/** Normalize hire_date / DOH to YYYY-MM-DD for cohort key; null if unparseable or empty. */
function hireDateToYyyyMmDd(value: string | null | undefined): string | null {
  if (value == null || !String(value).trim()) return null;
  const raw = String(value).trim();
  const head = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
  const mdY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (mdY) {
    const m = Number(mdY[1]);
    const d = Number(mdY[2]);
    const y = Number(mdY[3]);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

/** Readable label for class filter (hire date cohort). */
function formatClassOptionLabel(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [ys, ms, ds] = ymd.split("-");
  const dt = new Date(Number(ys), Number(ms) - 1, Number(ds));
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Compact toolbar selects — same visual family as Mentor Roster. */
const ROSTER_FILTER_SELECT_CLASS =
  "h-6 w-full min-w-0 cursor-pointer rounded border border-white/[0.07] bg-white/[0.03] px-1 py-0 pr-5 text-[10px] leading-none text-slate-300 transition-colors [color-scheme:dark] hover:border-white/11 hover:bg-white/[0.055] focus:border-[#75C043]/35 focus:outline-none focus:ring-1 focus:ring-[#75C043]/18 lg:bg-[length:0.5rem] lg:bg-[position:right_0.28rem_center] lg:bg-no-repeat lg:[background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748b'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E\")] lg:appearance-none";

type MenteeRosterStatus = "live" | "not_live" | "unassigned";

/** Single source for filter, counts, and Status cell (handles missing/invalid `status` after RSC serialize). */
function statusFromRow(r: MenteeRosterRow): MenteeRosterStatus {
  if (r.status === "live" || r.status === "not_live" || r.status === "unassigned") {
    return r.status;
  }
  const hasMentor =
    (r.mentor_name != null && r.mentor_name.trim() !== "") ||
    r.mentor_account === "active" ||
    r.mentor_account === "not_joined";
  if (!hasMentor) return "unassigned";
  if (r.mentee_account === "active" && r.mentor_account === "active") return "live";
  return "not_live";
}

export type MenteeRosterRow = {
  key: string;
  /** `mentor_assignments.id` when this row is assignment-backed; null for synthetic first-year rows without an assignment. */
  assignment_id: string | null;
  name: string;
  employee_number: string;
  hire_date: string | null;
  mentor_name: string | null;
  mentorship_status: string | null;
  next_milestone: string | null;
  mentor_account: "active" | "not_joined" | null;
  mentee_account: "active" | "not_joined" | null;
  status: MenteeRosterStatus;
  mentee_email: string | null;
  mentee_phone: string | null;
  mentor_email: string | null;
  mentor_phone: string | null;
};

type Props = {
  roster: MenteeRosterRow[];
  counts: { live: number; not_live: number; unassigned: number };
  /** Mentor picker data (reassignment UI); reserved until controls are wired. */
  mentorOptions: MenteeRosterMentorOption[];
};

type MenteeStatusFilter = "all" | MenteeRosterStatus;

const ROSTER_FILTER_INPUT_CLASS =
  "h-6 w-full max-w-full min-w-0 rounded border border-white/[0.07] bg-white/[0.03] px-1.5 text-[10px] leading-none text-slate-300 placeholder:text-slate-600 transition-colors hover:border-white/11 hover:bg-white/[0.055] focus:border-[#75C043]/35 focus:outline-none focus:ring-1 focus:ring-[#75C043]/18";

export function MenteeRosterTable({ roster, counts: _countsFromServer, mentorOptions }: Props) {
  void _countsFromServer;
  const searchFieldId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [openContactId, setOpenContactId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<MenteeStatusFilter>("all");

  /** Native `input` listener: keeps filter state in sync when typed value and React state diverge (e.g. change not applied). */
  useEffect(() => {
    const el = searchInputRef.current;
    if (!el) return;
    const onNativeInput = () => {
      setSearch(el.value);
    };
    el.addEventListener("input", onNativeInput);
    return () => el.removeEventListener("input", onNativeInput);
  }, []);

  const displayCounts = useMemo(() => {
    let live = 0;
    let not_live = 0;
    let unassigned = 0;
    for (const r of roster) {
      const s = statusFromRow(r);
      if (s === "live") live++;
      else if (s === "not_live") not_live++;
      else unassigned++;
    }
    return { live, not_live, unassigned };
  }, [roster]);

  const classOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of roster) {
      const k = hireDateToYyyyMmDd(r.hire_date);
      if (k) set.add(k);
    }
    return [...set].sort();
  }, [roster]);

  useEffect(() => {
    if (classFilter === "all") return;
    if (classOptions.includes(classFilter)) return;
    setClassFilter("all");
  }, [classOptions, classFilter]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = roster;
    if (q) {
      list = list.filter((r) => {
        const name = (r.name ?? "").toLowerCase();
        const emp = (r.employee_number ?? "").toLowerCase();
        const mentor = (r.mentor_name ?? "").toLowerCase();
        return name.includes(q) || emp.includes(q) || mentor.includes(q);
      });
    }
    if (classFilter !== "all") {
      list = list.filter((r) => hireDateToYyyyMmDd(r.hire_date) === classFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((r) => statusFromRow(r) === statusFilter);
    }
    return list;
  }, [roster, search, classFilter, statusFilter]);

  const toggleContactId = (id: string) => {
    setOpenContactId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-w-0">
      <div className="mb-3 rounded-lg border border-white/5 bg-slate-950/35 px-2.5 py-1.5 lg:mb-2 lg:px-3 lg:py-1">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between lg:gap-3">
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-1.5 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3 sm:items-end">
            <div className="min-w-0 sm:max-w-[16rem] lg:max-w-[14rem]">
              <label htmlFor={searchFieldId} className="block">
                <span className="mb-px block text-[8px] font-semibold uppercase leading-none tracking-wide text-slate-500">
                  Search
                </span>
              </label>
              <input
                ref={searchInputRef}
                id={searchFieldId}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, emp #, mentor..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className={ROSTER_FILTER_INPUT_CLASS}
              />
            </div>
            <label className="min-w-0">
              <span className="mb-px block text-[8px] font-semibold uppercase leading-none tracking-wide text-slate-500">
                Class
              </span>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className={ROSTER_FILTER_SELECT_CLASS}
                title="Hire date cohort (DOH)"
              >
                <option value="all">All classes</option>
                {classOptions.map((ymd) => (
                  <option key={ymd} value={ymd}>
                    {formatClassOptionLabel(ymd)}
                  </option>
                ))}
              </select>
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
                <option value="live">Live</option>
                <option value="not_live">Not Live</option>
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
        <span className="text-emerald-400">Live: {displayCounts.live}</span>
        <span className="text-amber-400">Not Live: {displayCounts.not_live}</span>
        <span className="text-slate-400">Unassigned: {displayCounts.unassigned}</span>
      </div>
      <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-white/5">
        <table className="table-fixed w-full max-w-full text-sm">
          <colgroup>
            <col className="w-[5%]" />
            <col className="w-[14%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[11%]" />
            <col className="w-[14%]" />
            <col className="w-[10%]" />
            <col className="w-[5%]" />
            <col className="w-[13%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className="border-b border-white/5 bg-white/[0.03] text-slate-400">
            <tr>
              <th className="py-2 text-center">CRA</th>
              <th className="min-w-0 overflow-hidden whitespace-nowrap text-left truncate py-2 pl-3 pr-2 font-medium">
                Mentee Name
              </th>
              <th className="py-2 px-2 text-center font-medium">Emp.#</th>
              <th className="py-2 px-2 text-center font-medium">DOH</th>
              <th className="min-w-0 overflow-hidden whitespace-nowrap truncate py-2 px-2 text-center font-medium">
                Mentorship
              </th>
              <th className="min-w-0 overflow-hidden whitespace-nowrap truncate py-2 px-2 text-center font-medium">
                Next Milestone
              </th>
              <th className="py-2 px-2 text-center font-medium">Status</th>
              <th className="py-2 text-center">CRA</th>
              <th className="min-w-0 overflow-hidden whitespace-nowrap truncate py-2 pl-2 pr-2 text-left font-medium">
                Mentor
              </th>
              <th className="min-w-0 py-2 pl-1 pr-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => {
              const rowStatus = statusFromRow(r);
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
                <td className="min-w-0 overflow-hidden py-2 pl-3 pr-2 text-slate-200">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => toggleContactId(`${r.key}:mentee`)}
                      className="block w-full min-w-0 truncate text-left text-slate-200 hover:underline"
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
                <td className="min-w-0 overflow-hidden whitespace-nowrap px-2 py-2 text-center">
                  {r.mentorship_status === "Military Leave" && (
                    <span className="block truncate text-amber-400">Military Leave</span>
                  )}
                  {r.mentorship_status === "Active" && (
                    <span className="block truncate text-emerald-400">Active</span>
                  )}
                  {!r.mentorship_status && <span className="block truncate">—</span>}
                  {r.mentorship_status &&
                    r.mentorship_status !== "Military Leave" &&
                    r.mentorship_status !== "Active" && (
                      <span className="block truncate text-slate-300">{r.mentorship_status}</span>
                    )}
                </td>
                <td className="min-w-0 overflow-hidden whitespace-nowrap px-2 py-2 text-center text-slate-200">
                  {r.next_milestone === "Paused" ? (
                    <span className="block truncate text-amber-400">Paused</span>
                  ) : (
                    <span className="block truncate">{r.next_milestone ?? "—"}</span>
                  )}
                </td>
                <td className="py-2 px-2 text-center">
                  {rowStatus === "live" ? (
                    <span className="text-emerald-400">Live</span>
                  ) : rowStatus === "not_live" ? (
                    <span className="text-amber-400">Not Live</span>
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
                <td className="min-w-0 overflow-hidden py-2 pl-2 pr-3 text-slate-200">
                  {r.mentor_name && r.mentor_name !== "—" ? (
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => toggleContactId(`${r.key}:mentor`)}
                        className="block w-full min-w-0 truncate text-left text-slate-200 hover:underline"
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
                <td className="min-w-0 overflow-visible align-top py-2 pl-1 pr-3 text-slate-200">
                  {r.assignment_id ? (
                    <MenteeRosterReassignMentor
                      key={`reassign-${r.assignment_id}-${r.mentor_name ?? ""}`}
                      assignmentId={r.assignment_id}
                      currentMentorName={r.mentor_name}
                      mentorOptions={mentorOptions}
                    />
                  ) : (
                    <span className="text-[10px] text-slate-500">No assignment</span>
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
