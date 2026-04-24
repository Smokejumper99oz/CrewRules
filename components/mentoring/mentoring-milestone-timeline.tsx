"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, isValid, parse, parseISO } from "date-fns";
import {
  completeMentorshipMilestone,
  createFailedMilestoneAttempt,
  createMentorshipCheckIn,
  deleteLatestMenteeMilestoneUpdate,
  deleteMentorshipCheckIn,
  submitMenteeMilestoneUpdate,
  undoCompletedMentorshipMilestone,
  updateCompletedMentorshipMilestone,
  updateMentorshipCheckIn,
  type MentorshipMilestoneAttemptRow,
} from "@/app/frontier/pilots/portal/mentoring/actions";
import { milestoneProgramRank } from "@/lib/mentoring/milestone-program-order";

export type MentoringCheckInItem = {
  id: string;
  occurred_on: string;
  note: string;
  created_at: string;
  follow_up_category?: "none" | "needs_admin_follow_up";
  follow_up_date?: string | null;
};

export type MentoringMenteeMilestoneUpdateItem = {
  id: string;
  milestone_type: "type_rating" | "oe_complete";
  message: string;
  created_at: string;
};

export type MentoringMilestoneTimelineItem = {
  milestone_id?: string;
  milestone_type: string;
  due_date: string;
  completed_date: string | null;
  completed_at: string | null;
  completion_note: string | null;
  title: string;
  /** Optional mentee-facing line under the title (mentors omit). */
  subtitle?: string;
  dueDisplay: string;
  /** Pre-formatted date-only fallback when `completed_at` is missing */
  completedDisplay: string | null;
};

/** Evaluative milestone types: Passed/Failed outcome and failed-attempt flow apply only to these. */
const MILESTONE_TYPES_WITH_OUTCOME = [
  "type_rating",
  "oe_complete",
  "probation_checkride",
] as const;

function milestoneTypeSupportsOutcome(milestoneType: string): boolean {
  return (MILESTONE_TYPES_WITH_OUTCOME as readonly string[]).includes(milestoneType);
}

type Props = {
  assignmentId: string;
  items: MentoringMilestoneTimelineItem[];
  checkIns: MentoringCheckInItem[];
  menteeMilestoneUpdates?: ReadonlyArray<MentoringMenteeMilestoneUpdateItem>;
  milestoneFailedAttempts?: ReadonlyArray<MentorshipMilestoneAttemptRow>;
  /** When true, mentor can edit completion note/date on completed rows and add check-ins. */
  canEditMilestones?: boolean;
  showMenteeCheckIn?: boolean;
};

type MilestoneModal = { milestoneType: string; mode: "complete" | "edit"; milestoneId?: string };

type TimelineSegment =
  | { kind: "standalone"; ci: MentoringCheckInItem }
  | { kind: "milestone"; m: MentoringMilestoneTimelineItem; attached: MentoringCheckInItem[] };

const cardClass =
  "flex min-w-0 flex-col gap-2 rounded-lg border border-slate-700 bg-slate-950/40 px-4 py-3 transition-[border-color,background-color] duration-200 ease-out hover:border-slate-500 hover:bg-slate-950/60";

/** Standalone mentor check-in: warm amber gradient (original look); crisp borders, no outer glow. */
const standaloneCheckInCardClass =
  "relative flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-xl border border-amber-500/35 border-l-[3px] border-l-amber-400/85 bg-gradient-to-br from-amber-400/[0.09] via-amber-950/35 to-slate-950/75 px-4 py-3 shadow-[inset_0_1px_0_0_rgba(254,243,199,0.06)] transition-[border-color,box-shadow] duration-200 ease-out hover:border-amber-400/50 hover:border-l-amber-300/90 hover:shadow-[inset_0_1px_0_0_rgba(254,243,199,0.09)]";

const timelineActionSizeClass =
  "inline-flex h-7 min-h-7 shrink-0 items-center justify-center rounded-md border px-2.5 text-xs font-semibold leading-none whitespace-nowrap";

const completedPillClass = `${timelineActionSizeClass} border-emerald-500/40 bg-emerald-500/15 text-emerald-200`;

const completedPillWithDateClass =
  "inline-flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold leading-none text-emerald-200";

const secondaryActionPillClass = `${timelineActionSizeClass} border-slate-500/40 bg-slate-500/20 text-slate-400 transition hover:border-slate-400/50 max-[380px]:px-2`;

/** Same footprint as `secondaryActionPillClass` so “Remove” and “Edit” read as a matched pair. */
const menteeRemoveLastPillClass = `${timelineActionSizeClass} border-red-500/35 bg-red-950/25 text-red-200/90 antialiased transition-colors duration-200 hover:border-red-400/45 hover:bg-red-950/40 active:bg-red-950/45 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-red-500/35 disabled:hover:bg-red-950/25 max-[380px]:px-2`;

/** Pending milestone: due date + status in one chip (matches site rhythm; no plain date beside a lone pill). */
const pendingDueStatusChipClass =
  "inline-flex min-h-7 shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border border-slate-500/35 bg-slate-900/50 px-2.5 py-1 text-xs leading-none tabular-nums";

const MENTEE_MILESTONE_UPDATE_MAX_LEN = 500;

const checkInNoteActionPillClass =
  "inline-flex h-6 min-h-6 shrink-0 items-center justify-center rounded-md border border-amber-500/45 bg-amber-950/35 px-2 text-xs font-semibold leading-none text-amber-100/95 antialiased transition-colors duration-200 hover:border-amber-400/55 hover:bg-amber-950/50 active:bg-amber-950/60 disabled:opacity-50";

const checkInDeletePillClass =
  "inline-flex h-6 min-h-6 shrink-0 items-center justify-center rounded-md border border-red-500/35 bg-red-950/25 px-2 text-xs font-semibold leading-none text-red-200/90 antialiased transition-colors duration-200 hover:border-red-400/45 hover:bg-red-950/40 active:bg-red-950/50 disabled:opacity-50";

const checkInFollowUpBadgeClass =
  "inline-flex shrink-0 items-center rounded-md border border-sky-500/35 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-200/90";

/** Edit beside Completed: height matches Completed via parent `items-stretch`. */
const editBesideCompletedClass =
  "inline-flex min-w-max shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-slate-500/40 bg-slate-500/20 px-3 text-xs font-semibold leading-none text-slate-400 antialiased transition-colors duration-200 hover:border-slate-400/50 hover:bg-slate-500/30 active:bg-slate-500/35 max-[380px]:px-2.5 disabled:opacity-50";

const undoBesideCompletedClass =
  "inline-flex min-w-max shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-amber-600/40 bg-amber-950/25 px-3 text-xs font-semibold leading-none text-amber-200/90 antialiased transition-colors duration-200 hover:border-amber-500/50 hover:bg-amber-950/40 active:bg-amber-950/45 max-[380px]:px-2.5 disabled:opacity-50";

function defaultCompletedDateYmd(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Same display style as DOH / hire date on the mentoring header (`MMMM d, yyyy`). */
function ymdToDohDisplay(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return format(d, "MMMM d, yyyy");
}

function occurredYmd(c: MentoringCheckInItem): string {
  return String(c.occurred_on).trim().slice(0, 10);
}

/** Calendar date the milestone was completed (prefers `completed_at`, else parent-provided `completedDisplay`). */
function formatActualCompletedDate(m: MentoringMilestoneTimelineItem): string | null {
  const iso = m.completed_at?.trim();
  if (iso) {
    const ymd = iso.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymdToDohDisplay(ymd);
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return format(d, "MMMM d, yyyy");
  }
  const fallback = m.completedDisplay?.trim();
  return fallback || null;
}

function milestoneCompletedYmd(m: MentoringMilestoneTimelineItem): string {
  const cd = m.completed_date?.trim() ?? "";
  const slice = cd.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(slice)) return slice;
  const iso = m.completed_at?.trim() ?? "";
  const head = iso.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
  return defaultCompletedDateYmd();
}

function dueYmd(m: MentoringMilestoneTimelineItem): string {
  return String(m.due_date ?? "").trim().slice(0, 10);
}

/**
 * Date used to order a milestone in the combined timeline. Completed: `completed_at` (YMD) if
 * present, else `completed_date`; pending: `due_date`.
 */
function milestoneEventSortKeyYmd(m: MentoringMilestoneTimelineItem): string {
  const hasCompletion = Boolean(m.completed_date?.trim()) || Boolean(m.completed_at?.trim());
  if (hasCompletion) {
    const at = m.completed_at?.trim() ?? "";
    const ymdAt = at.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymdAt)) return ymdAt;
    const cd = m.completed_date?.trim() ?? "";
    const ymdCd = cd.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymdCd)) return ymdCd;
  }
  return dueYmd(m);
}

function formatMenteeMilestoneUpdateTimestamp(iso: string): string {
  const t = iso?.trim() ?? "";
  if (!t) return "";
  const d = parseISO(t);
  if (!isValid(d)) return "";
  return format(d, "MMM d, yyyy");
}

/** Message from the most recent row for this milestone type (`created_at` order), regardless of prop ordering. */
function latestMenteeMilestoneUpdateMessage(
  updates: ReadonlyArray<MentoringMenteeMilestoneUpdateItem>,
  milestoneType: MentoringMenteeMilestoneUpdateItem["milestone_type"]
): string {
  const rows = updates.filter((u) => u.milestone_type === milestoneType);
  if (rows.length === 0) return "";
  const sorted = [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  return sorted[sorted.length - 1]?.message ?? "";
}

function standaloneCheckInsForTimeline(
  checkIns: MentoringCheckInItem[],
  items: MentoringMilestoneTimelineItem[]
): MentoringCheckInItem[] {
  const dueSet = new Set(items.map((m) => dueYmd(m)));
  return checkIns.filter((c) => !dueSet.has(occurredYmd(c)));
}

function buildTimelineSegments(
  items: MentoringMilestoneTimelineItem[],
  checkIns: MentoringCheckInItem[]
): TimelineSegment[] {
  const standalone = standaloneCheckInsForTimeline(checkIns, items);
  const out: TimelineSegment[] = [];
  for (const m of items) {
    const attached = checkIns.filter((c) => occurredYmd(c) === dueYmd(m));
    out.push({ kind: "milestone", m, attached });
  }
  for (const ci of standalone) {
    out.push({ kind: "standalone", ci });
  }
  out.sort((a, b) => {
    const ka = a.kind === "milestone" ? milestoneEventSortKeyYmd(a.m) : occurredYmd(a.ci);
    const kb = b.kind === "milestone" ? milestoneEventSortKeyYmd(b.m) : occurredYmd(b.ci);
    if (ka !== kb) return ka < kb ? -1 : 1;
    if (a.kind === "milestone" && b.kind === "standalone") return -1;
    if (a.kind === "standalone" && b.kind === "milestone") return 1;
    if (a.kind === "milestone" && b.kind === "milestone") {
      return milestoneProgramRank(a.m.milestone_type) - milestoneProgramRank(b.m.milestone_type);
    }
    if (a.kind === "standalone" && b.kind === "standalone") {
      const ac = a.ci;
      const bc = b.ci;
      const ta = new Date(ac.created_at).getTime();
      const tb = new Date(bc.created_at).getTime();
      if (ta !== tb) return ta - tb;
      return ac.id < bc.id ? -1 : ac.id > bc.id ? 1 : 0;
    }
    return 0;
  });
  return out;
}

/**
 * Accepts `YYYY-MM-DD`, compact `MMDDYY` (e.g. `021726` → February 17, 2026), or spelled-out / numeric month strings.
 * Returns canonical `YYYY-MM-DD` or null.
 */
function parseFlexibleDateInput(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const d = new Date(`${t}T12:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return null;
    return t;
  }
  if (/^\d{6}$/.test(t)) {
    const mm = Number(t.slice(0, 2));
    const dd = Number(t.slice(2, 4));
    const yy = Number(t.slice(4, 6));
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const fullYear = 2000 + yy;
    const ymd = `${fullYear}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    const d = new Date(`${ymd}T12:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return null;
    return ymd;
  }
  const formats = [
    "MMMM d, yyyy",
    "MMMM d yyyy",
    "MMM d, yyyy",
    "MMM d yyyy",
    "M/d/yyyy",
    "MM/dd/yyyy",
    "M/d/yy",
    "MM/dd/yy",
  ];
  for (const fmt of formats) {
    const d = parse(t, fmt, new Date());
    if (isValid(d)) {
      return format(d, "yyyy-MM-dd");
    }
  }
  return null;
}

export function MentoringMilestoneTimeline({
  assignmentId,
  items,
  checkIns,
  menteeMilestoneUpdates = [],
  milestoneFailedAttempts = [],
  canEditMilestones = false,
  showMenteeCheckIn = false,
}: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<MilestoneModal | null>(null);
  const [milestoneModalOutcome, setMilestoneModalOutcome] = useState<"passed" | "failed">("passed");
  const [note, setNote] = useState("");
  const [completedDateInput, setCompletedDateInput] = useState("");
  const [milestoneModalDateFirstFocusClearDone, setMilestoneModalDateFirstFocusClearDone] =
    useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInEditId, setCheckInEditId] = useState<string | null>(null);
  const [checkInNote, setCheckInNote] = useState("");
  const [checkInDateInput, setCheckInDateInput] = useState("");
  const [checkInModalDateFirstFocusClearDone, setCheckInModalDateFirstFocusClearDone] =
    useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInNeedsFollowUp, setCheckInNeedsFollowUp] = useState(false);
  const [checkInFollowUpDateYmd, setCheckInFollowUpDateYmd] = useState("");
  const [deleteCheckInConfirm, setDeleteCheckInConfirm] = useState<MentoringCheckInItem | null>(null);
  const [deleteCheckInError, setDeleteCheckInError] = useState<string | null>(null);
  const [menteeUpdateOpenFor, setMenteeUpdateOpenFor] = useState<string | null>(null);
  const [menteeUpdateMessage, setMenteeUpdateMessage] = useState("");
  const [menteeUpdateError, setMenteeUpdateError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isMenteeUpdatePending, startMenteeUpdateTransition] = useTransition();
  const [isMenteeRemoveLastPending, startMenteeRemoveLastTransition] = useTransition();
  const [isUndoPending, startUndoTransition] = useTransition();
  const [menteeRemoveLastError, setMenteeRemoveLastError] = useState<{
    milestoneType: string;
    message: string;
  } | null>(null);
  const [undoMilestoneError, setUndoMilestoneError] = useState<{
    milestoneType: string;
    message: string;
  } | null>(null);

  const segments = useMemo(() => buildTimelineSegments(items, checkIns), [items, checkIns]);

  useEffect(() => {
    if (!modal && !checkInOpen && !deleteCheckInConfirm && !menteeUpdateOpenFor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null);
        setCheckInOpen(false);
        setCheckInEditId(null);
        setDeleteCheckInConfirm(null);
        setDeleteCheckInError(null);
        setMenteeUpdateOpenFor(null);
        setMenteeUpdateMessage("");
        setMenteeUpdateError(null);
        setCheckInNeedsFollowUp(false);
        setCheckInFollowUpDateYmd("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, checkInOpen, deleteCheckInConfirm, menteeUpdateOpenFor]);

  const modalItem = modal ? items.find((x) => x.milestone_type === modal.milestoneType) : null;

  const closeModal = () => {
    setModal(null);
    setFormError(null);
    setMilestoneModalOutcome("passed");
  };

  const closeCheckInModal = () => {
    setCheckInOpen(false);
    setCheckInEditId(null);
    setCheckInError(null);
    setCheckInNeedsFollowUp(false);
    setCheckInFollowUpDateYmd("");
  };

  const openComplete = (milestoneType: string, milestoneId?: string) => {
    setModal({ milestoneType, mode: "complete", milestoneId });
    setMilestoneModalOutcome("passed");
    setNote("");
    setCompletedDateInput(ymdToDohDisplay(defaultCompletedDateYmd()));
    setMilestoneModalDateFirstFocusClearDone(false);
    setFormError(null);
  };

  const openEdit = (m: MentoringMilestoneTimelineItem) => {
    setUndoMilestoneError(null);
    setModal({ milestoneType: m.milestone_type, mode: "edit" });
    setMilestoneModalOutcome("passed");
    setNote(m.completion_note ?? "");
    setCompletedDateInput(ymdToDohDisplay(milestoneCompletedYmd(m)));
    setMilestoneModalDateFirstFocusClearDone(false);
    setFormError(null);
  };

  const runUndoCompletion = (m: MentoringMilestoneTimelineItem) => {
    setUndoMilestoneError(null);
    startUndoTransition(async () => {
      const result = await undoCompletedMentorshipMilestone(assignmentId, m.milestone_type);
      if (result.error) {
        setUndoMilestoneError({ milestoneType: m.milestone_type, message: result.error });
        return;
      }
      router.refresh();
    });
  };

  const openCheckIn = () => {
    setCheckInEditId(null);
    setCheckInOpen(true);
    setCheckInNote("");
    setCheckInDateInput(ymdToDohDisplay(defaultCompletedDateYmd()));
    setCheckInModalDateFirstFocusClearDone(false);
    setCheckInError(null);
    setCheckInNeedsFollowUp(false);
    setCheckInFollowUpDateYmd("");
  };

  const openEditCheckIn = (ci: MentoringCheckInItem) => {
    setCheckInEditId(ci.id);
    setCheckInOpen(true);
    setCheckInNote(ci.note);
    setCheckInDateInput(ymdToDohDisplay(occurredYmd(ci)));
    setCheckInModalDateFirstFocusClearDone(false);
    setCheckInError(null);
    const needs = ci.follow_up_category === "needs_admin_follow_up";
    setCheckInNeedsFollowUp(needs);
    const fu = ci.follow_up_date?.trim().slice(0, 10) ?? "";
    setCheckInFollowUpDateYmd(/^\d{4}-\d{2}-\d{2}$/.test(fu) ? fu : "");
  };

  const normalizeDateFieldOnBlur = () => {
    const ymd = parseFlexibleDateInput(completedDateInput);
    if (ymd) setCompletedDateInput(ymdToDohDisplay(ymd));
  };

  const onMilestoneDialogDateFocus = () => {
    if (milestoneModalDateFirstFocusClearDone) return;
    setCompletedDateInput("");
    setMilestoneModalDateFirstFocusClearDone(true);
  };

  const normalizeCheckInDateOnBlur = () => {
    const ymd = parseFlexibleDateInput(checkInDateInput);
    if (ymd) setCheckInDateInput(ymdToDohDisplay(ymd));
  };

  const onCheckInDialogDateFocus = () => {
    if (checkInModalDateFirstFocusClearDone) return;
    setCheckInDateInput("");
    setCheckInModalDateFirstFocusClearDone(true);
  };

  const saveModal = () => {
    if (!modal) return;
    const ymd = parseFlexibleDateInput(completedDateInput);
    if (!ymd) {
      setFormError("Enter a valid date (e.g. February 17, 2026 or 021726).");
      return;
    }
    setFormError(null);
    const { milestoneType, mode } = modal;
    const itemForModal = items.find((x) => x.milestone_type === milestoneType);
    const milestoneIdForAction = modal.milestoneId ?? itemForModal?.milestone_id;

    if (
      mode === "complete" &&
      milestoneModalOutcome === "failed" &&
      milestoneTypeSupportsOutcome(milestoneType)
    ) {
      if (!milestoneIdForAction?.trim()) {
        setFormError("Milestone could not be saved. Refresh and try again.");
        return;
      }
      startTransition(async () => {
        const result = await createFailedMilestoneAttempt({
          assignmentId,
          milestoneId: milestoneIdForAction.trim(),
          milestoneType,
          occurredOn: ymd,
          note,
        });
        if (result.error) {
          setFormError(result.error);
          return;
        }
        closeModal();
        router.refresh();
      });
      return;
    }

    startTransition(async () => {
      const result =
        mode === "edit"
          ? await updateCompletedMentorshipMilestone(assignmentId, milestoneType, ymd, note)
          : await completeMentorshipMilestone(assignmentId, milestoneType, ymd, note, null);
      if (result.error) {
        setFormError(result.error);
        return;
      }
      closeModal();
      router.refresh();
    });
  };

  const saveCheckIn = () => {
    const ymd = parseFlexibleDateInput(checkInDateInput);
    if (!ymd) {
      setCheckInError("Enter a valid date (e.g. February 17, 2026 or 021726).");
      return;
    }
    setCheckInError(null);
    const followUpYmdForServer =
      checkInNeedsFollowUp && checkInFollowUpDateYmd.trim() ? checkInFollowUpDateYmd.trim() : null;
    startTransition(async () => {
      const result = checkInEditId
        ? await updateMentorshipCheckIn(
            assignmentId,
            checkInEditId,
            ymd,
            checkInNote,
            checkInNeedsFollowUp,
            followUpYmdForServer
          )
        : await createMentorshipCheckIn(
            assignmentId,
            ymd,
            checkInNote,
            checkInNeedsFollowUp,
            followUpYmdForServer
          );
      if (result.error) {
        setCheckInError(result.error);
        return;
      }
      if (!checkInEditId) {
        setCheckInNote("");
        setCheckInDateInput(ymdToDohDisplay(defaultCompletedDateYmd()));
      }
      closeCheckInModal();
      router.refresh();
    });
  };

  const closeDeleteCheckInDialog = () => {
    setDeleteCheckInConfirm(null);
    setDeleteCheckInError(null);
  };

  const openDeleteCheckInConfirm = (ci: MentoringCheckInItem) => {
    if (!canEditMilestones) return;
    setDeleteCheckInError(null);
    setDeleteCheckInConfirm(ci);
  };

  const confirmDeleteCheckIn = () => {
    const ci = deleteCheckInConfirm;
    if (!ci || !canEditMilestones) return;
    setDeleteCheckInError(null);
    startTransition(async () => {
      const result = await deleteMentorshipCheckIn(assignmentId, ci.id);
      if (result.error) {
        setDeleteCheckInError(result.error);
        return;
      }
      closeDeleteCheckInDialog();
      router.refresh();
    });
  };

  const renderCheckInFollowUpRow = (ci: MentoringCheckInItem) =>
    ci.follow_up_category === "needs_admin_follow_up" ? (
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className={checkInFollowUpBadgeClass}>Follow-up</span>
        {ci.follow_up_date && /^\d{4}-\d{2}-\d{2}$/.test(ci.follow_up_date.slice(0, 10)) ? (
          <span className="text-[11px] tabular-nums text-slate-500">
            {ymdToDohDisplay(ci.follow_up_date.slice(0, 10))}
          </span>
        ) : null}
      </div>
    ) : null;

  const renderAttachedCheckIns = (attached: MentoringCheckInItem[]) =>
    attached.map((ci) => (
      <div key={ci.id} className="mt-2 flex min-w-0 flex-row flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {renderCheckInFollowUpRow(ci)}
          <p className="text-xs leading-relaxed text-amber-200/90">
            <span className="font-semibold text-amber-400/90">Check-in:</span> {ci.note}
          </p>
        </div>
        {canEditMilestones ? (
          <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
            <button type="button" onClick={() => openDeleteCheckInConfirm(ci)} className={checkInDeletePillClass}>
              Delete Note
            </button>
            <button type="button" onClick={() => openEditCheckIn(ci)} className={checkInNoteActionPillClass}>
              Edit Note
            </button>
          </div>
        ) : null}
      </div>
    ));

  const menteeMilestoneUpdateLabel = canEditMilestones ? "Mentee update" : "Your update";

  const closeMenteeUpdateComposer = () => {
    setMenteeUpdateOpenFor(null);
    setMenteeUpdateMessage("");
    setMenteeUpdateError(null);
  };

  const openMenteeUpdateComposer = (milestoneType: MentoringMenteeMilestoneUpdateItem["milestone_type"]) => {
    setMenteeUpdateOpenFor(milestoneType);
    setMenteeUpdateMessage(latestMenteeMilestoneUpdateMessage(menteeMilestoneUpdates, milestoneType));
    setMenteeUpdateError(null);
    setMenteeRemoveLastError(null);
  };

  const removeLatestMenteeMilestoneUpdateForRow = (
    milestoneType: MentoringMenteeMilestoneUpdateItem["milestone_type"]
  ) => {
    setMenteeRemoveLastError(null);
    startMenteeRemoveLastTransition(async () => {
      const result = await deleteLatestMenteeMilestoneUpdate({ assignmentId, milestoneType });
      if (result.error) {
        setMenteeRemoveLastError({ milestoneType, message: result.error });
        return;
      }
      if (menteeUpdateOpenFor === milestoneType) {
        closeMenteeUpdateComposer();
      }
      router.refresh();
    });
  };

  const saveMenteeMilestoneUpdate = (milestoneType: "type_rating" | "oe_complete") => {
    const msg = menteeUpdateMessage.trim();
    if (!msg) {
      setMenteeUpdateError("Message is required.");
      return;
    }
    if (msg.length > MENTEE_MILESTONE_UPDATE_MAX_LEN) {
      setMenteeUpdateError(`Message is too long (max ${MENTEE_MILESTONE_UPDATE_MAX_LEN} characters).`);
      return;
    }
    setMenteeUpdateError(null);
    startMenteeUpdateTransition(async () => {
      const result = await submitMenteeMilestoneUpdate({
        assignmentId,
        milestoneType,
        message: msg,
      });
      if (result.error) {
        setMenteeUpdateError(result.error);
        return;
      }
      closeMenteeUpdateComposer();
      router.refresh();
    });
  };

  const renderMenteeMilestoneUpdateEntries = (m: MentoringMilestoneTimelineItem) => {
    if (m.milestone_type !== "type_rating" && m.milestone_type !== "oe_complete") return null;
    const rows = menteeMilestoneUpdates.filter((u) => u.milestone_type === m.milestone_type);
    if (rows.length === 0) return null;
    return (
      <div className="space-y-1.5">
        {rows.map((u) => {
          const ts = formatMenteeMilestoneUpdateTimestamp(u.created_at);
          return (
            <div
              key={u.id}
              className="rounded-md border border-sky-400/35 border-l-[3px] border-l-sky-400/55 bg-sky-400/[0.08] px-2.5 py-1.5"
            >
              <p className="text-[10px] font-medium uppercase tracking-wide text-sky-50/90">
                {menteeMilestoneUpdateLabel}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-300">
                {u.message}
              </p>
              {ts ? <p className="mt-1 text-[10px] tabular-nums text-slate-500">{ts}</p> : null}
            </div>
          );
        })}
      </div>
    );
  };

  const renderMenteeRemoveLastBlock = (m: MentoringMilestoneTimelineItem) => {
    if (canEditMilestones) return null;
    if (m.milestone_type !== "type_rating" && m.milestone_type !== "oe_complete") return null;
    const rows = menteeMilestoneUpdates.filter((u) => u.milestone_type === m.milestone_type);
    if (rows.length === 0) return null;
    return (
      <div className="min-w-0 shrink-0">
        <button
          type="button"
          onClick={() =>
            removeLatestMenteeMilestoneUpdateForRow(
              m.milestone_type as MentoringMenteeMilestoneUpdateItem["milestone_type"]
            )
          }
          disabled={isMenteeRemoveLastPending || isMenteeUpdatePending}
          className={menteeRemoveLastPillClass}
        >
          {isMenteeRemoveLastPending ? "Removing…" : "Remove last update"}
        </button>
        {menteeRemoveLastError?.milestoneType === m.milestone_type ? (
          <p className="mt-1 text-xs leading-snug text-slate-400">{menteeRemoveLastError.message}</p>
        ) : null}
      </div>
    );
  };

  const renderMenteeMilestoneUpdatesForRow = (
    m: MentoringMilestoneTimelineItem,
    options?: { omitRemove?: boolean }
  ) => {
    const entries = renderMenteeMilestoneUpdateEntries(m);
    const remove = options?.omitRemove ? null : renderMenteeRemoveLastBlock(m);
    if (!entries && !remove) return null;
    return (
      <div className="mt-2 space-y-2">
        {entries}
        {remove}
      </div>
    );
  };

  /** Pending row only: mentee share-updates for type_rating / oe_complete (mentor workflow unchanged). */
  const renderMenteeMilestoneUpdateComposer = (m: MentoringMilestoneTimelineItem) => {
    if (canEditMilestones) return null;
    if (m.milestone_type !== "type_rating" && m.milestone_type !== "oe_complete") return null;
    const mt = m.milestone_type;
    const isOpen = menteeUpdateOpenFor === mt;
    const textId = `mentee-milestone-update-${mt}`;
    const hasExistingMenteeUpdatesForRow = menteeMilestoneUpdates.some((u) => u.milestone_type === mt);

    if (!isOpen) {
      return (
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => openMenteeUpdateComposer(mt)}
            className={secondaryActionPillClass}
          >
            {hasExistingMenteeUpdatesForRow ? "Edit update" : "Share update with mentor"}
          </button>
        </div>
      );
    }

    return (
      <div className="mt-2 w-full min-w-0 basis-full space-y-2 rounded-md border border-slate-600/40 bg-slate-950/40 px-3 py-2.5 sm:order-last">
        <label htmlFor={textId} className="text-xs font-medium text-slate-400">
          Update for your mentor
        </label>
        <textarea
          id={textId}
          value={menteeUpdateMessage}
          onChange={(e) => setMenteeUpdateMessage(e.target.value)}
          rows={3}
          maxLength={MENTEE_MILESTONE_UPDATE_MAX_LEN}
          disabled={isMenteeUpdatePending}
          placeholder="Short note (progress, timing, questions)…"
          className="min-h-[4.5rem] w-full resize-y rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50"
        />
        <p className="text-[10px] text-slate-500">
          {menteeUpdateMessage.length}/{MENTEE_MILESTONE_UPDATE_MAX_LEN}
        </p>
        {menteeUpdateError ? <p className="text-xs text-red-400">{menteeUpdateError}</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={closeMenteeUpdateComposer}
            disabled={isMenteeUpdatePending}
            className="inline-flex min-h-8 items-center justify-center rounded-lg border border-slate-500/40 bg-slate-900/50 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-400/50 hover:bg-slate-800/80 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => saveMenteeMilestoneUpdate(mt)}
            disabled={isMenteeUpdatePending}
            className="inline-flex min-h-8 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition-colors hover:border-emerald-400/55 hover:bg-emerald-500/25 disabled:opacity-50"
          >
            {isMenteeUpdatePending ? "Sending…" : "Submit"}
          </button>
        </div>
      </div>
    );
  };

  const renderMilestoneCard = (m: MentoringMilestoneTimelineItem, attached: MentoringCheckInItem[]) => {
    const rowKey = m.milestone_type + m.due_date;
    const completionNote = m.completion_note?.trim() ?? "";

    if (m.completed_date) {
      const completedOn = formatActualCompletedDate(m);
      return (
        <div key={rowKey} className={cardClass}>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-nowrap sm:items-center sm:justify-between">
            <div className="min-w-0 w-full text-left sm:flex-1">
              <div className="text-base font-semibold leading-snug text-slate-200">{m.title}</div>
              {m.subtitle?.trim() ? (
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{m.subtitle.trim()}</p>
              ) : null}
              {renderMenteeMilestoneUpdatesForRow(m)}
              {canEditMilestones && completionNote ? (
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  <span className="font-semibold text-slate-500">NOTE:</span> {completionNote}
                </p>
              ) : null}
              {renderAttachedCheckIns(attached)}
            </div>
            <div className="flex min-w-0 w-full flex-wrap items-center justify-start gap-x-2 gap-y-1 sm:w-auto sm:shrink-0 sm:justify-end">
              <span className="whitespace-nowrap text-xs text-slate-600 line-through decoration-slate-600/50 tabular-nums">
                {m.dueDisplay}
              </span>
              {canEditMilestones ? (
                <div className="flex flex-col items-stretch gap-1">
                  <div className="flex items-stretch gap-2">
                    <span className={completedOn ? completedPillWithDateClass : completedPillClass}>
                      <span>Completed</span>
                      {completedOn ? (
                        <span className="text-[11px] font-medium tabular-nums leading-none text-emerald-200/85">
                          {completedOn}
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEdit(m)}
                      disabled={isUndoPending}
                      className={editBesideCompletedClass}
                    >
                      Edit Milestone
                    </button>
                    <button
                      type="button"
                      onClick={() => runUndoCompletion(m)}
                      disabled={isUndoPending || isPending}
                      className={undoBesideCompletedClass}
                    >
                      {isUndoPending ? "Undoing…" : "Undo"}
                    </button>
                  </div>
                  {undoMilestoneError?.milestoneType === m.milestone_type ? (
                    <p className="max-w-full text-xs leading-snug text-red-400">
                      {undoMilestoneError.message}
                    </p>
                  ) : null}
                </div>
              ) : (
                <span className={completedOn ? completedPillWithDateClass : completedPillClass}>
                  <span>Completed</span>
                  {completedOn ? (
                    <span className="text-[11px] font-medium tabular-nums leading-none text-emerald-200/85">
                      {completedOn}
                    </span>
                  ) : null}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    }

    const modalOpenHere = modal?.milestoneType === m.milestone_type && modal?.mode === "complete";

    return (
      <div key={rowKey} className={cardClass}>
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1 text-left">
              <div className="text-base font-semibold leading-snug text-slate-200">{m.title}</div>
              {m.subtitle?.trim() ? (
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{m.subtitle.trim()}</p>
              ) : null}
            </div>
            <div className="flex min-w-0 shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <div className={pendingDueStatusChipClass} title={`Due ${m.dueDisplay} · Pending`}>
                <span className="text-slate-500">Due</span>
                <span className="font-medium text-slate-200">{m.dueDisplay}</span>
                <span className="hidden h-3 w-px shrink-0 self-center bg-white/10 sm:block" aria-hidden />
                <span className="font-semibold text-slate-400">Pending</span>
              </div>
              {canEditMilestones && !modalOpenHere ? (
                <button
                  type="button"
                  onClick={() => openComplete(m.milestone_type, m.milestone_id)}
                  className={`${timelineActionSizeClass} border-emerald-500/40 bg-emerald-500/15 text-emerald-200 antialiased transition-colors duration-200 hover:border-emerald-400/50 hover:bg-emerald-500/25 active:bg-emerald-500/20`}
                >
                  Mark complete
                </button>
              ) : null}
            </div>
          </div>
          {renderMenteeMilestoneUpdatesForRow(m, { omitRemove: true })}
          {!canEditMilestones && (m.milestone_type === "type_rating" || m.milestone_type === "oe_complete") ? (
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              {renderMenteeRemoveLastBlock(m)}
              {renderMenteeMilestoneUpdateComposer(m)}
            </div>
          ) : null}
          {renderAttachedCheckIns(attached)}
          {(() => {
            const failedForMilestone = milestoneFailedAttempts.filter((a) =>
              m.milestone_id ? a.milestone_id === m.milestone_id : a.milestone_type === m.milestone_type
            );
            if (failedForMilestone.length === 0) return null;
            return (
              <ul className="mt-2 space-y-2 border-t border-white/5 pt-2">
                {failedForMilestone.map((att) => (
                  <li
                    key={att.id}
                    className="rounded-md border border-red-500/25 bg-red-950/20 px-2.5 py-2 text-left"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-red-300/95">
                        Failed attempt
                      </span>
                      <span className="text-xs tabular-nums text-red-200/85">
                        {ymdToDohDisplay(String(att.occurred_on).trim().slice(0, 10))}
                      </span>
                    </div>
                    {att.note?.trim() ? (
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">{att.note.trim()}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            );
          })()}
        </div>
      </div>
    );
  };

  const renderStandaloneCard = (ci: MentoringCheckInItem) => (
    <div key={ci.id} className={standaloneCheckInCardClass}>
      <p className="text-[10px] font-semibold uppercase leading-none tracking-[0.14em] text-amber-400/80">
        Check-in note
      </p>
      {renderCheckInFollowUpRow(ci)}
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-start sm:gap-3">
        <span className="min-w-0 w-full break-words text-sm leading-snug text-amber-50/95 sm:flex-1">
          {ci.note}
        </span>
        <span className="shrink-0 whitespace-nowrap pt-0.5 text-xs leading-snug text-amber-200/90 tabular-nums">
          {ymdToDohDisplay(occurredYmd(ci))}
        </span>
        {canEditMilestones ? (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 pt-0 sm:flex-nowrap sm:pt-0.5">
            <button type="button" onClick={() => openDeleteCheckInConfirm(ci)} className={checkInDeletePillClass}>
              Delete Note
            </button>
            <button type="button" onClick={() => openEditCheckIn(ci)} className={checkInNoteActionPillClass}>
              Edit Note
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
        <h2 className="text-lg font-semibold text-white">Milestone Timeline</h2>
        {showMenteeCheckIn ? (
          <button
            type="button"
            onClick={openCheckIn}
            className="inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-amber-500/35 bg-amber-950/20 px-2.5 py-1 text-xs font-medium text-amber-100/95 antialiased transition-colors duration-200 hover:border-amber-400/50 hover:bg-amber-950/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
          >
            Mentee Check-In
          </button>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {items.length === 0 && checkIns.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-500">No milestones yet.</p>
          </div>
        ) : (
          segments.map((seg) =>
            seg.kind === "standalone" ? renderStandaloneCard(seg.ci) : renderMilestoneCard(seg.m, seg.attached)
          )
        )}
      </div>

      {modal && modalItem ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="presentation"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/95 px-4 py-4 shadow-2xl shadow-black/50 backdrop-blur-sm sm:max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="milestone-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="milestone-dialog-title"
              className="text-base font-semibold leading-snug text-white"
            >
              {modal.mode === "edit" ? `Edit completion · ${modalItem.title}` : modalItem.title}
            </h3>

            {modal.mode === "complete" && milestoneTypeSupportsOutcome(modal.milestoneType) ? (
              <div className="mt-3" role="group" aria-label="Milestone outcome">
                <span className="text-xs font-medium text-slate-400">Outcome</span>
                <div className="mt-1.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMilestoneModalOutcome("passed")}
                    disabled={isPending}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      milestoneModalOutcome === "passed"
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                        : "border-white/10 bg-slate-950/50 text-slate-400 hover:border-white/15"
                    }`}
                  >
                    Passed
                  </button>
                  <button
                    type="button"
                    onClick={() => setMilestoneModalOutcome("failed")}
                    disabled={isPending}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      milestoneModalOutcome === "failed"
                        ? "border-red-500/45 bg-red-950/35 text-red-200"
                        : "border-white/10 bg-slate-950/50 text-slate-400 hover:border-white/15"
                    }`}
                  >
                    Failed
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-3 flex flex-col gap-1.5 text-left">
              <label htmlFor="milestone-dialog-note" className="text-xs font-medium text-slate-400">
                {modal.mode === "complete" &&
                milestoneModalOutcome === "failed" &&
                milestoneTypeSupportsOutcome(modal.milestoneType)
                  ? "Failure note (optional)"
                  : "Note (optional)"}
              </label>
              <textarea
                id="milestone-dialog-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                disabled={isPending}
                placeholder="Add context for this milestone…"
                className="min-h-[4.5rem] w-full resize-y rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50"
              />
            </div>

            <div className="mt-3 flex flex-col gap-1.5 text-left">
              <label htmlFor="milestone-dialog-date" className="text-xs font-medium text-slate-400">
                {modal.mode === "complete" &&
                milestoneModalOutcome === "failed" &&
                milestoneTypeSupportsOutcome(modal.milestoneType)
                  ? "Occurred on"
                  : "Completed date"}
              </label>
              <input
                id="milestone-dialog-date"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. February 17, 2026 or 021726"
                value={completedDateInput}
                onChange={(e) => setCompletedDateInput(e.target.value)}
                onFocus={onMilestoneDialogDateFocus}
                onBlur={normalizeDateFieldOnBlur}
                disabled={isPending}
                className="min-h-[44px] w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50"
              />
              <p className="text-[11px] leading-snug text-slate-500">
                Tip: <span className="font-mono">MMDDYY</span> — Example <span className="font-mono">021726</span> →
                February 17, 2026.
              </p>
            </div>

            {formError ? <p className="mt-2 text-sm text-red-400">{formError}</p> : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                disabled={isPending}
                className="min-h-[44px] rounded-lg border border-slate-500/40 bg-slate-900/50 px-4 py-2.5 text-sm font-semibold text-slate-200 antialiased transition-colors duration-200 hover:border-slate-400/50 hover:bg-slate-800/80 active:bg-slate-800 disabled:opacity-50 sm:order-1 sm:min-w-[6rem]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveModal}
                disabled={isPending}
                className={`min-h-[44px] rounded-lg border px-4 py-2.5 text-sm font-semibold antialiased transition-colors duration-200 disabled:opacity-50 sm:order-2 sm:min-w-[6rem] ${
                  modal.mode === "complete" && milestoneModalOutcome === "failed"
                    ? "border-red-500/40 bg-red-950/30 text-red-200 hover:border-red-400/50 hover:bg-red-950/45 active:bg-red-950/50"
                    : "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:border-emerald-400/55 hover:bg-emerald-500/25 active:bg-emerald-500/30"
                }`}
              >
                {isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {checkInOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="presentation"
          onClick={closeCheckInModal}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/95 px-4 py-4 shadow-2xl shadow-black/50 backdrop-blur-sm sm:max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="check-in-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="check-in-dialog-title" className="text-base font-semibold leading-snug text-white">
              {checkInEditId ? "Edit check-in" : "Mentee Check-In"}
            </h3>
            {checkInEditId ? null : (
              <p className="mt-1 text-xs leading-snug text-slate-500">
                If this date matches a milestone due date, the note appears on that card; otherwise it appears as its
                own check-in between milestones.
              </p>
            )}

            <div className="mt-3 flex flex-col gap-1.5 text-left">
              <label htmlFor="check-in-dialog-note" className="text-xs font-medium text-slate-400">
                Note
              </label>
              <textarea
                id="check-in-dialog-note"
                value={checkInNote}
                onChange={(e) => setCheckInNote(e.target.value)}
                rows={3}
                disabled={isPending}
                placeholder="What did you cover or notice?"
                className="min-h-[4.5rem] w-full resize-y rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50"
              />
            </div>

            <div className="mt-3 flex flex-col gap-2 text-left">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={checkInNeedsFollowUp}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setCheckInNeedsFollowUp(on);
                    if (!on) setCheckInFollowUpDateYmd("");
                  }}
                  disabled={isPending}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-slate-950/60 text-emerald-500 focus:ring-emerald-500/30 disabled:opacity-50"
                />
                <span className="text-xs font-medium leading-snug text-slate-300">Needs follow-up</span>
              </label>
              {checkInNeedsFollowUp ? (
                <div className="flex flex-col gap-1.5 pl-0 sm:pl-6">
                  <label htmlFor="check-in-follow-up-date" className="text-xs font-medium text-slate-400">
                    Follow-up date (optional)
                  </label>
                  <input
                    id="check-in-follow-up-date"
                    type="date"
                    value={checkInFollowUpDateYmd}
                    onChange={(e) => setCheckInFollowUpDateYmd(e.target.value)}
                    disabled={isPending}
                    className="min-h-[44px] w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50"
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-3 flex flex-col gap-1.5 text-left">
              <label htmlFor="check-in-dialog-date" className="text-xs font-medium text-slate-400">
                Check-in date
              </label>
              <input
                id="check-in-dialog-date"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. February 17, 2026 or 021726"
                value={checkInDateInput}
                onChange={(e) => setCheckInDateInput(e.target.value)}
                onFocus={onCheckInDialogDateFocus}
                onBlur={normalizeCheckInDateOnBlur}
                disabled={isPending}
                className="min-h-[44px] w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50"
              />
              <p className="text-[11px] leading-snug text-slate-500">
                Tip: <span className="font-mono">MMDDYY</span> — Example <span className="font-mono">021726</span> →
                February 17, 2026.
              </p>
            </div>

            {checkInError ? <p className="mt-2 text-sm text-red-400">{checkInError}</p> : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeCheckInModal}
                disabled={isPending}
                className="min-h-[44px] rounded-lg border border-slate-500/40 bg-slate-900/50 px-4 py-2.5 text-sm font-semibold text-slate-200 antialiased transition-colors duration-200 hover:border-slate-400/50 hover:bg-slate-800/80 active:bg-slate-800 disabled:opacity-50 sm:order-1 sm:min-w-[6rem]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCheckIn}
                disabled={isPending}
                className="min-h-[44px] rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-200 antialiased transition-colors duration-200 hover:border-emerald-400/55 hover:bg-emerald-500/25 active:bg-emerald-500/30 disabled:opacity-50 sm:order-2 sm:min-w-[6rem]"
              >
                {isPending ? "Saving…" : checkInEditId ? "Save changes" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteCheckInConfirm ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="presentation"
          onClick={closeDeleteCheckInDialog}
        >
          <div
            className="w-full max-w-xs rounded-xl border border-white/10 bg-slate-900/95 px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-check-in-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-check-in-title" className="text-sm font-semibold text-white">
              Delete this note?
            </h3>
            <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
              Check-in · {ymdToDohDisplay(occurredYmd(deleteCheckInConfirm))}
            </p>
            <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-slate-400">
              {deleteCheckInConfirm.note}
            </p>
            {deleteCheckInError ? <p className="mt-2 text-xs text-red-400">{deleteCheckInError}</p> : null}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteCheckInDialog}
                disabled={isPending}
                className="min-h-9 rounded-lg border border-slate-500/40 bg-slate-900/50 px-3 py-1.5 text-xs font-semibold text-slate-200 antialiased transition-colors duration-200 hover:border-slate-400/50 hover:bg-slate-800/80 active:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCheckIn}
                disabled={isPending}
                className="min-h-9 rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-200 antialiased transition-colors duration-200 hover:border-red-400/45 hover:bg-red-500/25 active:bg-red-500/30 disabled:opacity-50"
              >
                {isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
