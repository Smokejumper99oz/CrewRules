"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { MentorAssignmentRow } from "@/app/frontier/pilots/portal/mentoring/actions";
import { saveMentorWorkspaceFields } from "@/app/frontier/pilots/portal/mentoring/actions";
import {
  MENTOR_WORKSPACE_STATUS_OPTIONS,
  isMentorWorkspaceStatus,
} from "@/lib/mentoring/mentor-workspace-status";
import {
  MENTOR_NEXT_CHECK_IN_DATE_MAX,
  MENTOR_NEXT_CHECK_IN_DATE_MIN,
  isValidMentorNextCheckInYmd,
} from "@/lib/mentoring/mentor-next-check-in-date";

function formatCheckInDate(ymd: string | null): string {
  if (!ymd?.trim()) return "";
  try {
    const d = new Date(ymd.trim() + "T12:00:00.000Z");
    if (Number.isNaN(d.getTime())) return ymd;
    return format(d, "MMM d, yyyy");
  } catch {
    return ymd;
  }
}

/** Workspace mentoring status pill (My Mentees card); matches Military Leave vs default styling. */
export function MentorWorkspaceStatusPill({ status }: { status: string }) {
  const s = status.trim();
  return (
    <span
      className={
        s === "Military Leave"
          ? "inline-flex items-center rounded-md border border-[#556b3a]/40 bg-[#2f3a23]/30 px-2 py-0.5 text-xs font-medium text-[#cdd6a3]"
          : "inline-flex items-center rounded-md border border-white/10 bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-slate-300"
      }
    >
      {s}
    </span>
  );
}

export function MentorMenteeCardWorkspaceSummary({ a }: { a: MentorAssignmentRow }) {
  const status = a.mentor_workspace_mentoring_status?.trim();
  const next = a.mentor_workspace_next_check_in_date?.trim();
  if (!status && !next) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
      {status ? <MentorWorkspaceStatusPill status={status} /> : null}
      {next ? (
        <span className="text-slate-400">
          Next Check-In:{" "}
          <span className="text-slate-300">{formatCheckInDate(next)}</span>
        </span>
      ) : null}
    </div>
  );
}

export function MentorMenteeWorkspaceNotesButton({
  a,
  compact = false,
}: {
  a: MentorAssignmentRow;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("Active");
  const [note, setNote] = useState("");
  const [nextCheckIn, setNextCheckIn] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncFromProps = useCallback(() => {
    setStatus(
      isMentorWorkspaceStatus(a.mentor_workspace_mentoring_status ?? "")
        ? a.mentor_workspace_mentoring_status!
        : "Active"
    );
    setNote(a.mentor_workspace_private_note ?? "");
    setNextCheckIn(a.mentor_workspace_next_check_in_date?.slice(0, 10) ?? "");
  }, [a]);

  useEffect(() => {
    if (open) syncFromProps();
  }, [open, syncFromProps]);

  async function onSave() {
    setSaving(true);
    setError(null);
    const nextRaw = nextCheckIn.trim();
    if (nextRaw && !isValidMentorNextCheckInYmd(nextRaw)) {
      setSaving(false);
      setError("Check-in date must use a year between 1900 and 2100.");
      return;
    }
    const result = await saveMentorWorkspaceFields({
      assignmentId: a.id,
      mentoringStatus: status,
      privateNote: note,
      nextCheckInDate: nextCheckIn.trim() || null,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "inline-flex shrink-0 items-center justify-center rounded-md border border-amber-500/35 bg-amber-950/20 px-2.5 py-1 text-xs font-medium leading-none text-amber-100/95 antialiased transition-colors duration-200 hover:border-amber-400/50 hover:bg-amber-950/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
            : "inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 sm:w-auto"
        }
      >
        Notes
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60"
            aria-hidden
            onClick={() => !saving && setOpen(false)}
          />
          <div
            className="fixed left-4 right-4 top-1/2 z-50 max-h-[min(90vh,32rem)] w-[calc(100%-2rem)] max-w-md -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 shadow-xl sm:left-1/2 sm:w-full sm:-translate-x-1/2"
            role="dialog"
            aria-labelledby="mentor-workspace-title"
            aria-modal="true"
          >
            <div className="border-b border-white/10 px-4 py-3">
              <h2 id="mentor-workspace-title" className="text-base font-semibold text-white">
                Quick notes — {a.mentee_full_name?.trim() || "Mentee"}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Private to you; not shared with the mentee.</p>
            </div>
            <div className="space-y-3 p-4">
              <label className="block space-y-1">
                <span className="text-xs text-slate-400">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#75C043]/50 focus:outline-none focus:ring-1 focus:ring-[#75C043]/50"
                >
                  {MENTOR_WORKSPACE_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-slate-400">Private note</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={saving}
                  rows={4}
                  placeholder="Short note for your planning…"
                  className="w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#75C043]/50 focus:outline-none focus:ring-1 focus:ring-[#75C043]/50"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-slate-400">Next check-in</span>
                <input
                  type="date"
                  value={nextCheckIn}
                  min={MENTOR_NEXT_CHECK_IN_DATE_MIN}
                  max={MENTOR_NEXT_CHECK_IN_DATE_MAX}
                  onChange={(e) => setNextCheckIn(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-[#75C043]/50 focus:outline-none focus:ring-1 focus:ring-[#75C043]/50"
                />
              </label>
              {error ? (
                <p className="text-sm text-rose-400" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={onSave}
                  className="rounded-lg bg-[#75C043] px-3 py-2 text-sm font-semibold text-slate-950 hover:brightness-110 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
