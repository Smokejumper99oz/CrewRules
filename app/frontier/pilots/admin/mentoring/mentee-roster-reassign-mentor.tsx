"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MenteeRosterMentorOption } from "@/app/frontier/pilots/admin/mentoring/mentee-roster/mentee-roster-mentor-options";
import {
  assignFrontierPilotAdminSyntheticMenteeFormState,
  reassignFrontierPilotAdminMentorAssignmentFormState,
  type AssignFrontierPilotAdminSyntheticMenteeFormState,
  type ReassignFrontierPilotAdminMentorAssignmentFormState,
} from "@/app/frontier/pilots/admin/mentoring/actions";
import {
  SearchableFormSelect,
  type SearchableFormSelectOption,
} from "@/components/searchable-form-select";

const UNASSIGN_VALUE = "__UNASSIGN__";

const initialReassign: ReassignFrontierPilotAdminMentorAssignmentFormState = { error: null };
const initialAssign: AssignFrontierPilotAdminSyntheticMenteeFormState = { error: null };

type Props =
  | {
      variant?: "reassign";
      assignmentId: string;
      currentMentorName?: string | null;
      currentMentorEmployeeNumber?: string | null;
      mentorOptions: MenteeRosterMentorOption[];
    }
  | {
      variant: "assign";
      menteeUserId: string;
      mentorOptions: MenteeRosterMentorOption[];
    };

export function MenteeRosterReassignMentor(props: Props) {
  const router = useRouter();
  const variant = props.variant ?? "reassign";
  const [open, setOpen] = useState(false);
  const [mentorSelection, setMentorSelection] = useState(() =>
    variant === "assign" ? "" : UNASSIGN_VALUE
  );
  const [state, formAction, isPending] = useActionState(
    variant === "assign"
      ? assignFrontierPilotAdminSyntheticMenteeFormState
      : reassignFrontierPilotAdminMentorAssignmentFormState,
    variant === "assign" ? initialAssign : initialReassign
  );

  const searchableMentorOptions: SearchableFormSelectOption[] = useMemo(() => {
    const fromMentors: SearchableFormSelectOption[] = props.mentorOptions.map((o) => {
      const emp = (o.mentorEmployeeNumber ?? "").trim();
      const keywords = [emp, o.rowKind].filter(Boolean).join(" ");
      return {
        value: o.optionKey,
        label: o.label,
        keywords: keywords || undefined,
      };
    });
    if (variant === "assign") {
      return fromMentors;
    }
    return [
      {
        value: UNASSIGN_VALUE,
        label: "Unassign mentor",
        keywords: "unassign",
      },
      ...fromMentors,
    ];
  }, [props.mentorOptions, variant]);

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      setMentorSelection(variant === "assign" ? "" : UNASSIGN_VALUE);
      router.refresh();
    }
  }, [state.success, router, variant]);

  useEffect(() => {
    if (open) {
      setMentorSelection(variant === "assign" ? "" : UNASSIGN_VALUE);
    }
  }, [open, variant]);

  const currentHint =
    "assignmentId" in props
      ? [
          (props.currentMentorName ?? "").trim(),
          (props.currentMentorEmployeeNumber ?? "").trim(),
        ]
          .filter(Boolean)
          .join(" · ")
      : "";

  const actionLabel = variant === "assign" ? "Assign" : "Reassign";

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        title={currentHint ? `Current: ${currentHint}` : undefined}
        className="touch-manipulation whitespace-nowrap text-[11px] font-semibold leading-none text-emerald-800 hover:text-emerald-900 hover:underline disabled:opacity-50 disabled:hover:no-underline"
      >
        {open ? "Close" : actionLabel}
      </button>

      {open ? (
        <form action={formAction} className="mt-1.5 flex w-full min-w-0 flex-col gap-1.5">
          {"menteeUserId" in props ? (
            <input type="hidden" name="menteeUserId" value={props.menteeUserId} />
          ) : (
            <input type="hidden" name="assignmentId" value={props.assignmentId} />
          )}
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
              className="inline-flex shrink-0 items-center rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-200 disabled:opacity-50"
            >
              {isPending ? "…" : "Save"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setOpen(false)}
              className="inline-flex shrink-0 items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
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
