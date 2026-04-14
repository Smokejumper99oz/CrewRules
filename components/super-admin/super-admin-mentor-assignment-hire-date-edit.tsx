"use client";

import { useActionState } from "react";
import {
  updateSuperAdminMentorAssignmentHireDateFormState,
  type UpdateMentorAssignmentHireDateFormState,
} from "@/lib/super-admin/actions";

const initial: UpdateMentorAssignmentHireDateFormState = { error: null };

export type MentorAssignmentHireDateFormAction = (
  prev: UpdateMentorAssignmentHireDateFormState,
  formData: FormData
) => Promise<UpdateMentorAssignmentHireDateFormState>;

type Props = {
  assignmentId: string;
  hireDateIso: string | null;
  /** Defaults to Super Admin action; tenant admin page passes Frontier pilots admin action. */
  formAction?: MentorAssignmentHireDateFormAction;
  /** Pale inputs for Frontier tenant admin; default matches Super Admin dark surfaces. */
  tone?: "dark" | "light";
};

export function SuperAdminMentorAssignmentHireDateEdit({
  assignmentId,
  hireDateIso,
  formAction: formActionProp,
  tone = "dark",
}: Props) {
  const [state, formAction, isPending] = useActionState(
    formActionProp ?? updateSuperAdminMentorAssignmentHireDateFormState,
    initial
  );

  const head = (hireDateIso ?? "").trim().slice(0, 10);
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : "";

  const inputClass =
    tone === "light"
      ? "rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:border-[#75C043]/50 focus:outline-none disabled:opacity-50"
      : "rounded-md border border-white/10 bg-slate-950/50 px-2 py-1 text-xs text-slate-200 focus:border-emerald-500/40 focus:outline-none disabled:opacity-50";

  const saveBtnClass =
    tone === "light"
      ? "inline-flex shrink-0 items-center rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-200 disabled:opacity-50"
      : "inline-flex shrink-0 items-center rounded-md border border-slate-500/40 bg-slate-800/80 px-2 py-1 text-xs font-semibold text-slate-200 hover:border-slate-400/50 hover:bg-slate-800 disabled:opacity-50";

  return (
    <form action={formAction} className="inline-flex min-w-0 flex-col gap-1">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="date"
          name="hireDate"
          defaultValue={ymd}
          required
          disabled={isPending}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={isPending}
          className={saveBtnClass}
        >
          {isPending ? "…" : "Save"}
        </button>
      </div>
      {state.error ? <p className="text-xs text-red-400">{state.error}</p> : null}
    </form>
  );
}
