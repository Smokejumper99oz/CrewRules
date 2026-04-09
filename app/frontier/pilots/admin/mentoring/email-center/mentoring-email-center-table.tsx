"use client";

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FrontierMentoringEmailCenterRow } from "@/lib/mentoring/frontier-mentoring-email-center-load";
import {
  sendFrontierPilotAdminMentorAssignmentEmailFormState,
  type SendFrontierPilotAdminMentorAssignmentEmailFormState,
} from "@/app/frontier/pilots/admin/mentoring/actions";

/** Admin table: show DOH as YYYY/MM/DD when stored as YYYY-MM-DD. Matches mentee-roster-table. */
function formatDohCell(value: string | null | undefined): string {
  if (value == null || !String(value).trim()) return "—";
  const s = String(value).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, "/");
  return s;
}

/** Normalize hire_date / DOH to YYYY-MM-DD for cohort key; null if unparseable or empty. Matches mentee-roster-table. */
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

/** Readable label for class filter (hire date cohort). Matches mentee-roster-table. */
function formatClassOptionLabel(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [ys, ms, ds] = ymd.split("-");
  const dt = new Date(Number(ys), Number(ms) - 1, Number(ds));
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const ROSTER_FILTER_SELECT_CLASS =
  "h-6 w-full min-w-0 max-w-full cursor-pointer rounded border border-white/[0.07] bg-white/[0.03] px-1 py-0 pr-5 text-[10px] leading-none text-slate-300 transition-colors [color-scheme:dark] hover:border-white/11 hover:bg-white/[0.055] focus:border-[#75C043]/35 focus:outline-none focus:ring-1 focus:ring-[#75C043]/18 lg:bg-[length:0.5rem] lg:bg-[position:right_0.28rem_center] lg:bg-no-repeat lg:[background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748b'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E\")] lg:appearance-none";

/** Same compact search input as mentee-roster-table. */
const ROSTER_FILTER_INPUT_CLASS =
  "h-6 w-full max-w-full min-w-0 rounded border border-white/[0.07] bg-white/[0.03] px-1.5 text-[10px] leading-none text-slate-300 placeholder:text-slate-600 transition-colors hover:border-white/11 hover:bg-white/[0.055] focus:border-[#75C043]/35 focus:outline-none focus:ring-1 focus:ring-[#75C043]/18";

type RosterStatus = "live" | "not_live" | "unassigned";

function statusFromRow(r: FrontierMentoringEmailCenterRow): RosterStatus {
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

function statusLabel(s: RosterStatus): string {
  switch (s) {
    case "live":
      return "Live";
    case "not_live":
      return "Not Live";
    case "unassigned":
      return "Unassigned";
    default:
      return s;
  }
}

function statusPillClass(s: RosterStatus): string {
  if (s === "live") return "border-emerald-500/40 bg-emerald-500/20 text-emerald-200";
  if (s === "unassigned") return "border-amber-500/40 bg-amber-500/20 text-amber-200";
  return "border-slate-500/40 bg-slate-500/20 text-slate-400";
}

const missingEmailPillClass = "border-amber-500/40 bg-amber-500/20 text-amber-200";

/** Mentor Email column: same width for “No Mentor yet” and “Ready” pills. */
const MENTOR_EMAIL_PRIMARY_PILL_W = "w-[7.5rem]";

const readyPillClass =
  `inline-flex ${MENTOR_EMAIL_PRIMARY_PILL_W} cursor-pointer items-center justify-center text-center rounded-md border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#75C043]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950`;

/** Same width as Ready pill; taller hit target; tighter type so “Send Mentor Email” stays on one line. */
const mentorSendPillClass =
  `inline-flex ${MENTOR_EMAIL_PRIMARY_PILL_W} cursor-pointer items-center justify-center text-center rounded-md border border-emerald-500/40 bg-emerald-500/20 px-1.5 py-2 text-[9px] font-semibold leading-none tracking-tight text-emerald-200 transition-colors hover:bg-emerald-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#75C043]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 whitespace-nowrap`;

/** Secondary control after success window; same footprint as primary send. */
const mentorSendResendPillClass =
  `inline-flex ${MENTOR_EMAIL_PRIMARY_PILL_W} cursor-pointer items-center justify-center text-center rounded-md border border-slate-500/45 bg-slate-500/10 px-1.5 py-2 text-[9px] font-semibold leading-none tracking-tight text-slate-400 transition-colors hover:border-slate-500/55 hover:bg-slate-500/16 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 whitespace-nowrap`;

const neutralPillClass =
  `inline-flex ${MENTOR_EMAIL_PRIMARY_PILL_W} items-center justify-center text-center rounded-md border border-slate-500/40 bg-slate-500/15 px-2 py-0.5 text-xs font-semibold text-slate-400`;

const mentorSendInitial: SendFrontierPilotAdminMentorAssignmentEmailFormState = { error: null };

function MentorAssignmentEmailSendCell({ row }: { row: FrontierMentoringEmailCenterRow }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    sendFrontierPilotAdminMentorAssignmentEmailFormState,
    mentorSendInitial
  );
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [showResend, setShowResend] = useState(false);
  const wasPendingRef = useRef(false);

  /** Start sent window when a submission finishes successfully (including resend), not on arbitrary re-renders. */
  useEffect(() => {
    if (!isPending && wasPendingRef.current && state.success) {
      setSentAt(Date.now());
      setShowResend(false);
    }
    wasPendingRef.current = isPending;
  }, [isPending, state.success]);

  useEffect(() => {
    if (sentAt == null) return;
    const id = window.setTimeout(() => {
      setSentAt(null);
      setShowResend(true);
      router.refresh();
    }, 10_000);
    return () => window.clearTimeout(id);
  }, [sentAt, router]);

  const inSentWindow = sentAt != null;
  const st = statusFromRow(row);
  const hasResolved = Boolean(row.resolved_mentor_email?.trim());
  const assignmentId = row.assignment_id;

  if (!assignmentId) {
    return <span className="text-[10px] leading-snug text-slate-600">No assignment</span>;
  }
  if (st === "unassigned") {
    return <span className="text-[10px] leading-snug text-slate-600">No mentor assigned</span>;
  }
  if (!hasResolved) {
    return <span className="text-[10px] leading-snug text-slate-600">No mentor email</span>;
  }

  return (
    <form action={formAction} className="mt-1 flex min-w-0 flex-col gap-0.5">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      {inSentWindow ? (
        <button
          type="submit"
          disabled
          className={`${mentorSendPillClass} touch-manipulation disabled:pointer-events-none disabled:opacity-50 disabled:hover:bg-emerald-500/20`}
        >
          Send Mentor Email
        </button>
      ) : showResend ? (
        <button
          type="submit"
          disabled={isPending}
          className={`${mentorSendResendPillClass} touch-manipulation disabled:opacity-50`}
        >
          {isPending ? "Sending…" : "Resend if needed"}
        </button>
      ) : (
        <button
          type="submit"
          disabled={isPending}
          className={`${mentorSendPillClass} touch-manipulation disabled:opacity-50 disabled:hover:bg-emerald-500/20`}
        >
          {isPending ? "Sending…" : "Send Mentor Email"}
        </button>
      )}
      {state.error ? <p className="text-[10px] text-red-400">{state.error}</p> : null}
      {inSentWindow ? <p className="text-[10px] text-emerald-400">Sent</p> : null}
    </form>
  );
}

function mentorEmailSourceLabel(
  source: FrontierMentoringEmailCenterRow["resolved_mentor_email_source"]
): string | null {
  if (source == null) return null;
  switch (source) {
    case "mentor_contact_email":
      return "Mentor contact";
    case "personal_email":
      return "Personal";
    case "email":
      return "Work";
    case "preload_personal_email":
      return "Personal";
    case "preload_work_email":
      return "Work";
    default:
      return null;
  }
}

type Props = {
  roster: FrontierMentoringEmailCenterRow[];
};

export function MentoringEmailCenterTable({ roster }: Props) {
  const searchFieldId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  /** Same interaction idea as `openContactId` in mentee-roster-table: `${rowKey}:mentee-email` | `:mentor-email`. */
  const [openEmailDetailKey, setOpenEmailDetailKey] = useState<string | null>(null);

  function toggleEmailDetail(key: string) {
    setOpenEmailDetailKey((prev) => (prev === key ? null : key));
  }

  /** Native `input` listener: keeps filter state in sync when typed value and React state diverge (mentee-roster-table pattern). */
  useEffect(() => {
    const el = searchInputRef.current;
    if (!el) return;
    const onNativeInput = () => setSearch(el.value);
    el.addEventListener("input", onNativeInput);
    return () => el.removeEventListener("input", onNativeInput);
  }, []);

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
        const resolvedMentorEmail = (r.resolved_mentor_email ?? "").toLowerCase();
        const menteeEmail = (r.mentee_email ?? "").toLowerCase();
        return (
          name.includes(q) ||
          emp.includes(q) ||
          mentor.includes(q) ||
          resolvedMentorEmail.includes(q) ||
          menteeEmail.includes(q)
        );
      });
    }
    if (classFilter !== "all") {
      list = list.filter((r) => hireDateToYyyyMmDd(r.hire_date) === classFilter);
    }
    return list;
  }, [roster, search, classFilter]);

  return (
    <div className="space-y-4">
      <div className="mb-3 rounded-lg border border-white/5 bg-slate-950/35 px-2.5 py-1.5 lg:mb-2 lg:px-3 lg:py-1">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between lg:gap-3">
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-1.5 gap-y-1.5 sm:grid-cols-2 sm:items-end">
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
                placeholder="Search name, emp #, mentor..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className={ROSTER_FILTER_INPUT_CLASS}
              />
            </div>
            <label className="min-w-0 max-w-[14rem]">
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

      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full text-sm min-w-[960px]">
          <thead>
            <tr className="border-b border-white/5 bg-white/5">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-300">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-300">Employee #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-300">Class</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-300">Mentor Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-300">Mentee Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-300">Mentor Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-300">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                  No rows match your search or filters.
                </td>
              </tr>
            ) : null}
            {filteredRows.map((r) => {
              const st = statusFromRow(r);
              const menteeHasEmail = Boolean(r.mentee_email?.trim());
              const mentorHasEmail = Boolean(r.resolved_mentor_email?.trim());
              const mentorUnassigned = st === "unassigned";
              const menteeDetailKey = `${r.key}:mentee-email`;
              const mentorDetailKey = `${r.key}:mentor-email`;
              const sourceLine = mentorEmailSourceLabel(r.resolved_mentor_email_source);

              return (
                <tr key={r.key} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-slate-200 max-w-[200px] truncate" title={r.name !== "—" ? r.name : undefined}>
                    {r.name?.trim() || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-300 font-mono text-xs">{r.employee_number?.trim() || "—"}</td>
                  <td className="px-4 py-3 text-slate-300 tabular-nums">{formatDohCell(r.hire_date)}</td>
                  <td
                    className="px-4 py-3 text-slate-200 max-w-[180px] truncate"
                    title={r.mentor_name?.trim() || undefined}
                  >
                    {r.mentor_name?.trim() || "—"}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      {menteeHasEmail ? (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleEmailDetail(menteeDetailKey)}
                            className={readyPillClass}
                          >
                            Ready
                          </button>
                          {openEmailDetailKey === menteeDetailKey && r.mentee_email ? (
                            <a
                              href={`mailto:${r.mentee_email}`}
                              className="break-all text-xs text-slate-500 underline hover:no-underline"
                            >
                              {r.mentee_email}
                            </a>
                          ) : null}
                        </>
                      ) : (
                        <span
                          className={`inline-flex w-fit rounded-md border px-2 py-0.5 text-xs font-semibold ${missingEmailPillClass}`}
                        >
                          No email
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      {mentorUnassigned ? (
                        <span className={neutralPillClass}>No Mentor yet</span>
                      ) : mentorHasEmail ? (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleEmailDetail(mentorDetailKey)}
                            className={readyPillClass}
                          >
                            Ready
                          </button>
                          {openEmailDetailKey === mentorDetailKey && r.resolved_mentor_email ? (
                            <>
                              <a
                                href={`mailto:${r.resolved_mentor_email}`}
                                className="break-all text-xs text-slate-500 underline hover:no-underline"
                              >
                                {r.resolved_mentor_email}
                              </a>
                              {sourceLine ? (
                                <div className="text-[10px] leading-snug text-slate-500">Source: {sourceLine}</div>
                              ) : null}
                            </>
                          ) : null}
                        </>
                      ) : (
                        <span
                          className={`inline-flex w-fit items-center justify-center text-center rounded-md border px-2 py-0.5 text-xs font-semibold ${missingEmailPillClass}`}
                        >
                          No email
                        </span>
                      )}
                      <MentorAssignmentEmailSendCell row={r} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex min-w-[6rem] items-center justify-center rounded-md border px-2 py-0.5 text-center text-xs font-semibold ${statusPillClass(st)}`}
                    >
                      {statusLabel(st)}
                    </span>
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
