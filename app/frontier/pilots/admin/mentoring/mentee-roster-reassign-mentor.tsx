"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MenteeRosterMentorOption } from "@/app/frontier/pilots/admin/mentoring/mentee-roster/mentee-roster-mentor-options";
import {
  reassignFrontierPilotAdminMentorAssignmentFormState,
  type ReassignFrontierPilotAdminMentorAssignmentFormState,
} from "@/app/frontier/pilots/admin/mentoring/actions";
import {
  SearchableFormSelect,
  type SearchableFormSelectOption,
} from "@/components/searchable-form-select";

const UNASSIGN_VALUE = "__UNASSIGN__";

const initial: ReassignFrontierPilotAdminMentorAssignmentFormState = { error: null };

type Props = {
  assignmentId: string;
  currentMentorName?: string | null;
  currentMentorEmployeeNumber?: string | null;
  mentorOptions: MenteeRosterMentorOption[];
};

export function MenteeRosterReassignMentor({
  assignmentId,
  currentMentorName,
  currentMentorEmployeeNumber,
  mentorOptions,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mentorSelection, setMentorSelection] = useState(UNASSIGN_VALUE);
  const [state, formAction, isPending] = useActionState(
    reassignFrontierPilotAdminMentorAssignmentFormState,
    initial
  );

  const searchableMentorOptions: SearchableFormSelectOption[] = useMemo(() => {
    const fromMentors: SearchableFormSelectOption[] = mentorOptions.map((o) => {
      const emp = (o.mentorEmployeeNumber ?? "").trim();
      const keywords = [emp, o.rowKind].filter(Boolean).join(" ");
      return {
        value: o.optionKey,
        label: o.label,
        keywords: keywords || undefined,
      };
    });
    return [
      {
        value: UNASSIGN_VALUE,
        label: "Unassign mentor",
        keywords: "unassign",
      },
      ...fromMentors,
    ];
  }, [mentorOptions]);

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      setMentorSelection(UNASSIGN_VALUE);
      router.refresh();
    }
  }, [state.success, router]);

  useEffect(() => {
    if (open) setMentorSelection(UNASSIGN_VALUE);
  }, [open]);

  const currentHint = [
    (currentMentorName ?? "").trim(),
    (currentMentorEmployeeNumber ?? "").trim(),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        title={currentHint ? `Current: ${currentHint}` : undefined}
        className="touch-manipulation whitespace-nowrap text-[11px] font-semibold leading-none text-[#75C043] hover:underline disabled:opacity-50 disabled:hover:no-underline"
      >
        {open ? "Close" : "Reassign"}
      </button>

      {open ? (
        <form action={formAction} className="mt-1.5 flex w-full min-w-0 flex-col gap-1.5">
          <input type="hidden" name="assignmentId" value={assignmentId} />
          <label className="block min-w-0">
            <span className="sr-only">Mentor</span>
            <SearchableFormSelect
              name="mentorSelection"
              value={mentorSelection}
              onValueChange={setMentorSelection}
              options={searchableMentorOptions}
              placeholder="Select mentor"
              searchPlaceholder="Name, emp #, profile…"
              emptyLabel="No matches"
              disabled={isPending}
              className="min-w-0 w-full"
            />
          </label>
          <div className="flex flex-wrap gap-1">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex shrink-0 items-center rounded-md border border-slate-500/40 bg-slate-800/80 px-2 py-1 text-[10px] font-semibold text-slate-200 hover:border-slate-400/50 hover:bg-slate-800 disabled:opacity-50"
            >
              {isPending ? "…" : "Save"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setOpen(false)}
              className="inline-flex shrink-0 items-center rounded-md border border-white/10 bg-transparent px-2 py-1 text-[10px] font-semibold text-slate-400 hover:bg-white/[0.04] disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          {state.error ? <p className="text-[10px] text-red-400">{state.error}</p> : null}
          {state.success ? <p className="text-[10px] text-emerald-400">Saved. Updating roster…</p> : null}
        </form>
      ) : null}
    </div>
  );
}
