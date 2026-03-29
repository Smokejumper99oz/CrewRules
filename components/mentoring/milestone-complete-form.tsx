"use client";

import { useActionState, useId, useMemo } from "react";
import {
  completeMentorshipMilestoneFormState,
  type MilestoneCompleteFormState,
} from "@/app/frontier/pilots/portal/mentoring/actions";

const initialState: MilestoneCompleteFormState = { error: null };

function localYyyyMmDd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type Props = {
  assignmentId: string;
  milestoneType: string;
  /** When set, shows a Cancel control that does not submit the form */
  onCancel?: () => void;
  /** Tighter spacing and smaller note area for inline panels */
  compact?: boolean;
};

export function MilestoneCompleteForm({
  assignmentId,
  milestoneType,
  onCancel,
  compact,
}: Props) {
  const defaultDate = useMemo(() => localYyyyMmDd(), []);
  const baseId = useId().replace(/:/g, "");
  const dateFieldId = `milestone-completed-date-${baseId}`;
  const noteFieldId = `milestone-completion-note-${baseId}`;

  const [state, formAction, isPending] = useActionState(
    completeMentorshipMilestoneFormState,
    initialState
  );

  const gap = compact ? "gap-2" : "gap-3";
  const fieldClass = compact
    ? "w-full min-h-[40px] rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50"
    : "w-full min-h-[44px] rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50";
  const textareaClass = compact
    ? "w-full min-h-[3.75rem] resize-y rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50"
    : "w-full min-h-[5rem] resize-y rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50";
  const labelClass = "text-xs font-medium text-slate-400";
  const noteRows = compact ? 2 : 3;

  return (
    <form action={formAction} className={`flex w-full min-w-0 flex-col items-stretch ${gap} text-left`}>
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="milestoneType" value={milestoneType} />

      <div className={`flex flex-col ${compact ? "gap-1" : "gap-1.5"}`}>
        <label htmlFor={dateFieldId} className={labelClass}>
          Completed date
        </label>
        <input
          id={dateFieldId}
          type="text"
          name="completedDate"
          autoComplete="off"
          spellCheck={false}
          placeholder="YYYY-MM-DD"
          defaultValue={defaultDate}
          required
          disabled={isPending}
          className={fieldClass}
        />
      </div>

      <div className={`flex flex-col ${compact ? "gap-1" : "gap-1.5"}`}>
        <label htmlFor={noteFieldId} className={labelClass}>
          Note (optional)
        </label>
        <textarea
          id={noteFieldId}
          name="completionNote"
          rows={noteRows}
          placeholder="Add context for this milestone…"
          disabled={isPending}
          className={textareaClass}
        />
      </div>

      <div
        className={`flex flex-col ${compact ? "gap-2" : "gap-2"} sm:flex-row sm:items-stretch ${onCancel ? "sm:gap-2" : ""}`}
      >
        <button
          type="submit"
          disabled={isPending}
          className={`min-h-[44px] rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition hover:border-emerald-400/50 hover:bg-emerald-500/25 active:bg-emerald-500/20 disabled:opacity-50 ${onCancel ? "sm:flex-1" : "w-full sm:w-auto sm:self-start"}`}
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="min-h-[44px] rounded-lg border border-slate-500/40 bg-slate-900/40 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-400/50 hover:bg-slate-900/60 disabled:opacity-50 sm:flex-1"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {state.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
    </form>
  );
}
