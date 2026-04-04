"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteFeedbackSubmissionForSuperAdmin,
  updateFeedbackSubmissionStatusForSuperAdmin,
  type SuperAdminFeedbackSubmissionRow,
} from "@/lib/super-admin/actions";
import { Trash2 } from "lucide-react";

type TypeFilter = "all" | "bug" | "feature" | "feedback";

type StatusFilter = "all" | "new" | "in_progress" | "closed";

const TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "feedback", label: "Feedback" },
];

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "closed", label: "Closed" },
];

const STATUS_SELECT_OPTIONS: { value: Exclude<StatusFilter, "all">; label: string }[] = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "closed", label: "Closed" },
];

function fmtSubmitted(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function formatFeedbackType(raw: string): string {
  const t = raw?.trim().toLowerCase();
  if (t === "bug") return "Bug";
  if (t === "feature") return "Feature";
  if (t === "feedback") return "Feedback";
  return raw?.trim() || "—";
}

function normalizeRowStatus(status: string | undefined): StatusFilter {
  const s = status?.trim();
  if (s === "new" || s === "in_progress" || s === "closed") return s;
  return "new";
}

function formatStatusLabel(s: StatusFilter): string {
  if (s === "in_progress") return "In progress";
  if (s === "closed") return "Closed";
  if (s === "new") return "New";
  return s;
}

function displayName(row: { submitter_full_name: string | null; submitter_email: string | null }): string {
  const n = row.submitter_full_name?.trim();
  if (n) return n;
  return row.submitter_email?.trim() || "—";
}

function rowMatchesSearch(r: SuperAdminFeedbackSubmissionRow, q: string): boolean {
  if (!q) return true;
  const fields = [
    r.submitter_full_name,
    r.submitter_email,
    r.route_path,
    r.message,
    r.tenant,
    r.portal,
  ];
  return fields.some((f) => (f ?? "").toLowerCase().includes(q));
}

type Props = {
  rows: SuperAdminFeedbackSubmissionRow[];
};

export function SuperAdminFeedbackTable({ rows }: Props) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.feedback_type.trim().toLowerCase() !== typeFilter) {
        return false;
      }
      if (statusFilter !== "all" && normalizeRowStatus(r.status) !== statusFilter) {
        return false;
      }
      return rowMatchesSearch(r, q);
    });
  }, [rows, typeFilter, statusFilter, search]);

  const hasActiveFilters =
    typeFilter !== "all" || statusFilter !== "all" || search.trim() !== "";

  const rowActionsLocked = (submissionId: string) =>
    statusBusyId === submissionId || deleteBusyId === submissionId;

  async function handleStatusSelect(submissionId: string, value: string) {
    setActionError(null);
    const next = normalizeRowStatus(value);
    const current = normalizeRowStatus(rows.find((x) => x.id === submissionId)?.status);
    if (next === current) return;
    setStatusBusyId(submissionId);
    const res = await updateFeedbackSubmissionStatusForSuperAdmin(submissionId, next);
    setStatusBusyId(null);
    if (!res.ok) {
      setActionError(res.error);
      return;
    }
    router.refresh();
  }

  async function handleDelete(submissionId: string) {
    if (!window.confirm("Delete this feedback permanently?")) return;
    setActionError(null);
    setDeleteBusyId(submissionId);
    const res = await deleteFeedbackSubmissionForSuperAdmin(submissionId);
    setDeleteBusyId(null);
    if (!res.ok) {
      setActionError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-400">
          In-app feedback from portal users ({rows.length} submission{rows.length === 1 ? "" : "s"}).
        </p>
        {hasActiveFilters && rows.length > 0 ? (
          <p className="mt-1 text-sm text-slate-500">
            Showing {filteredRows.length} of {rows.length}
          </p>
        ) : null}
      </div>

      {actionError ? (
        <p className="text-sm text-rose-400" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-400">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
          >
            {TYPE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-400">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/40"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-w-[200px] flex-1 items-center gap-3 sm:max-w-md">
          <label className="shrink-0 text-sm text-slate-400">Search</label>
          <input
            type="search"
            placeholder="Name, email, route, message, tenant, portal…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/40"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full min-w-[960px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-white/5">
              <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-300">Submitted</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-300">Type</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-300">Name</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-300">Email</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-300">Tenant</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-300">Portal</th>
              <th className="min-w-[140px] max-w-[220px] px-4 py-3 font-medium text-slate-300">Route</th>
              <th className="min-w-[200px] max-w-[400px] px-4 py-3 font-medium text-slate-300">Message</th>
              <th className="whitespace-nowrap px-4 py-3 font-medium text-slate-300">Status</th>
              <th className="whitespace-nowrap px-4 py-3 text-center font-medium text-slate-300">Shots</th>
              <th className="w-14 whitespace-nowrap px-2 py-3 text-center font-medium text-slate-300">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                  No feedback submissions yet.
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                  No submissions match your filters.
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-b border-white/5 align-top hover:bg-white/[0.02]">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">{fmtSubmitted(r.created_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-200">{formatFeedbackType(r.feedback_type)}</td>
                    <td className="max-w-[160px] px-4 py-3 text-slate-200 break-words">{displayName(r)}</td>
                    <td className="max-w-[200px] px-4 py-3 break-all text-slate-300">
                      {r.submitter_email?.trim() || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">{r.tenant}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">{r.portal}</td>
                    <td className="max-w-[220px] px-4 py-3 break-all text-slate-300">
                      {r.route_path?.trim() || "—"}
                    </td>
                    <td className="max-w-[400px] px-4 py-3 text-slate-300 whitespace-pre-wrap break-words">
                      {r.message}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-slate-300">
                      <label className="sr-only" htmlFor={`feedback-status-${r.id}`}>
                        Status for submission {r.id}
                      </label>
                      <select
                        id={`feedback-status-${r.id}`}
                        value={normalizeRowStatus(r.status)}
                        disabled={rowActionsLocked(r.id)}
                        onChange={(e) => handleStatusSelect(r.id, e.target.value)}
                        className="max-w-[11rem] rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-white outline-none focus:border-emerald-400/40 disabled:opacity-50"
                        title={
                          r.status_updated_at
                            ? `Updated ${fmtSubmitted(r.status_updated_at)}`
                            : formatStatusLabel(normalizeRowStatus(r.status))
                        }
                      >
                        {STATUS_SELECT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center tabular-nums text-slate-300">
                      {r.attachment_count ?? 0}
                    </td>
                    <td className="whitespace-nowrap px-2 py-3 text-center align-top">
                      <button
                        type="button"
                        disabled={rowActionsLocked(r.id)}
                        onClick={() => void handleDelete(r.id)}
                        className="inline-flex rounded-md p-1.5 text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300 disabled:pointer-events-none disabled:opacity-40"
                        title="Delete"
                        aria-label="Delete feedback submission"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </td>
                  </tr>
                  {r.attachments.length > 0 ? (
                    <tr className="border-b border-white/5 bg-slate-950/30 last:border-0">
                      <td colSpan={11} className="px-4 py-3">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Screenshots
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3">
                          {r.attachments.map((a, idx) => (
                            <a
                              key={`${r.id}-${idx}`}
                              href={a.preview_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block max-w-[min(100%,280px)] shrink-0 rounded-lg border border-white/10 bg-slate-900/50 p-1 ring-1 ring-white/5 transition hover:border-emerald-500/30 hover:ring-emerald-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                            >
                              <img
                                src={a.preview_url}
                                alt={`Screenshot ${idx + 1}`}
                                className="max-h-40 w-auto max-w-full rounded-md object-contain"
                                loading="lazy"
                              />
                            </a>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
