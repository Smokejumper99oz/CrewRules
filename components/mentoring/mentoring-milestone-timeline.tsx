"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, isValid, parse } from "date-fns";
import {
  completeMentorshipMilestone,
  createMentorshipCheckIn,
  deleteMentorshipCheckIn,
  updateCompletedMentorshipMilestone,
  updateMentorshipCheckIn,
} from "@/app/frontier/pilots/portal/mentoring/actions";

export type MentoringCheckInItem = {
  id: string;
  occurred_on: string;
  note: string;
  created_at: string;
};

export type MentoringMilestoneTimelineItem = {
  milestone_type: string;
  due_date: string;
  completed_date: string | null;
  completed_at: string | null;
  completion_note: string | null;
  title: string;
  dueDisplay: string;
  /** Pre-formatted date-only fallback when `completed_at` is missing */
  completedDisplay: string | null;
};

type Props = {
  assignmentId: string;
  items: MentoringMilestoneTimelineItem[];
  checkIns: MentoringCheckInItem[];
  /** When true, mentor can edit completion note/date on completed rows and add check-ins. */
  canEditMilestones?: boolean;
  showMenteeCheckIn?: boolean;
};

type MilestoneModal = { milestoneType: string; mode: "complete" | "edit" };

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

const checkInNoteActionPillClass =
  "inline-flex h-6 min-h-6 shrink-0 items-center justify-center rounded-md border border-amber-500/45 bg-amber-950/35 px-2 text-xs font-semibold leading-none text-amber-100/95 antialiased transition-colors duration-200 hover:border-amber-400/55 hover:bg-amber-950/50 active:bg-amber-950/60 disabled:opacity-50";

const checkInDeletePillClass =
  "inline-flex h-6 min-h-6 shrink-0 items-center justify-center rounded-md border border-red-500/35 bg-red-950/25 px-2 text-xs font-semibold leading-none text-red-200/90 antialiased transition-colors duration-200 hover:border-red-400/45 hover:bg-red-950/40 active:bg-red-950/50 disabled:opacity-50";

/** Edit beside Completed: height matches Completed via parent `items-stretch`. */
const editBesideCompletedClass =
  "inline-flex min-w-max shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-slate-500/40 bg-slate-500/20 px-3 text-xs font-semibold leading-none text-slate-400 antialiased transition-colors duration-200 hover:border-slate-400/50 hover:bg-slate-500/30 active:bg-slate-500/35 max-[380px]:px-2.5 disabled:opacity-50";

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
  if (items.length === 0) {
    return standalone.map((ci) => ({ kind: "standalone" as const, ci }));
  }
  const out: TimelineSegment[] = [];
  const firstDue = dueYmd(items[0]);
  const lastDue = dueYmd(items[items.length - 1]);
  for (const ci of standalone) {
    if (occurredYmd(ci) < firstDue) out.push({ kind: "standalone", ci });
  }
  for (let i = 0; i < items.length; i++) {
    const m = items[i];
    const attached = checkIns.filter((c) => occurredYmd(c) === dueYmd(m));
    out.push({ kind: "milestone", m, attached });
    if (i < items.length - 1) {
      const lo = dueYmd(m);
      const hi = dueYmd(items[i + 1]);
      for (const ci of standalone) {
        const o = occurredYmd(ci);
        if (o > lo && o < hi) out.push({ kind: "standalone", ci });
      }
    }
  }
  for (const ci of standalone) {
    if (occurredYmd(ci) > lastDue) out.push({ kind: "standalone", ci });
  }
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
  canEditMilestones = false,
  showMenteeCheckIn = false,
}: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<MilestoneModal | null>(null);
  const [note, setNote] = useState("");
  const [completedDateInput, setCompletedDateInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [checkInEditId, setCheckInEditId] = useState<string | null>(null);
  const [checkInNote, setCheckInNote] = useState("");
  const [checkInDateInput, setCheckInDateInput] = useState("");
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [deleteCheckInConfirm, setDeleteCheckInConfirm] = useState<MentoringCheckInItem | null>(null);
  const [deleteCheckInError, setDeleteCheckInError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const segments = useMemo(() => buildTimelineSegments(items, checkIns), [items, checkIns]);

  useEffect(() => {
    if (!modal && !checkInOpen && !deleteCheckInConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null);
        setCheckInOpen(false);
        setCheckInEditId(null);
        setDeleteCheckInConfirm(null);
        setDeleteCheckInError(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal, checkInOpen, deleteCheckInConfirm]);

  const modalItem = modal ? items.find((x) => x.milestone_type === modal.milestoneType) : null;

  const closeModal = () => {
    setModal(null);
    setFormError(null);
  };

  const closeCheckInModal = () => {
    setCheckInOpen(false);
    setCheckInEditId(null);
    setCheckInError(null);
  };

  const openComplete = (milestoneType: string) => {
    setModal({ milestoneType, mode: "complete" });
    setNote("");
    setCompletedDateInput(ymdToDohDisplay(defaultCompletedDateYmd()));
    setFormError(null);
  };

  const openEdit = (m: MentoringMilestoneTimelineItem) => {
    setModal({ milestoneType: m.milestone_type, mode: "edit" });
    setNote(m.completion_note ?? "");
    setCompletedDateInput(ymdToDohDisplay(milestoneCompletedYmd(m)));
    setFormError(null);
  };

  const openCheckIn = () => {
    setCheckInEditId(null);
    setCheckInOpen(true);
    setCheckInNote("");
    setCheckInDateInput(ymdToDohDisplay(defaultCompletedDateYmd()));
    setCheckInError(null);
  };

  const openEditCheckIn = (ci: MentoringCheckInItem) => {
    setCheckInEditId(ci.id);
    setCheckInOpen(true);
    setCheckInNote(ci.note);
    setCheckInDateInput(ymdToDohDisplay(occurredYmd(ci)));
    setCheckInError(null);
  };

  const normalizeDateFieldOnBlur = () => {
    const ymd = parseFlexibleDateInput(completedDateInput);
    if (ymd) setCompletedDateInput(ymdToDohDisplay(ymd));
  };

  const normalizeCheckInDateOnBlur = () => {
    const ymd = parseFlexibleDateInput(checkInDateInput);
    if (ymd) setCheckInDateInput(ymdToDohDisplay(ymd));
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
    startTransition(async () => {
      const result = checkInEditId
        ? await updateMentorshipCheckIn(assignmentId, checkInEditId, ymd, checkInNote)
        : await createMentorshipCheckIn(assignmentId, ymd, checkInNote);
      if (result.error) {
        setCheckInError(result.error);
        return;
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

  const renderAttachedCheckIns = (attached: MentoringCheckInItem[]) =>
    attached.map((ci) => (
      <div key={ci.id} className="mt-2 flex min-w-0 flex-row flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-amber-200/90">
          <span className="font-semibold text-amber-400/90">Check-in:</span> {ci.note}
        </p>
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

  const renderMilestoneCard = (m: MentoringMilestoneTimelineItem, attached: MentoringCheckInItem[]) => {
    const rowKey = m.milestone_type + m.due_date;
    const completionNote = m.completion_note?.trim() ?? "";

    if (m.completed_date) {
      const completedOn = formatActualCompletedDate(m);
      return (
        <div key={rowKey} className={cardClass}>
          <div className="flex min-w-0 flex-row flex-nowrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 text-left">
              <div className="text-base font-semibold leading-snug text-slate-200">{m.title}</div>
              {completionNote ? (
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  <span className="font-semibold text-slate-500">NOTE:</span> {completionNote}
                </p>
              ) : null}
              {renderAttachedCheckIns(attached)}
            </div>
            <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1">
              <span className="whitespace-nowrap text-xs text-slate-600 line-through decoration-slate-600/50 tabular-nums">
                {m.dueDisplay}
              </span>
              {canEditMilestones ? (
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
                    className={editBesideCompletedClass}
                  >
                    Edit Milestone
                  </button>
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
        <div className="flex min-w-0 flex-row flex-nowrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1 text-left">
            <div className="truncate text-base font-semibold leading-snug text-slate-200">{m.title}</div>
            {renderAttachedCheckIns(attached)}
          </div>
          <div className="flex min-w-0 shrink-0 flex-nowrap items-center justify-end gap-2">
            <span className="whitespace-nowrap text-sm text-slate-400 tabular-nums">{m.dueDisplay}</span>
            <span className={`${timelineActionSizeClass} border-slate-500/40 bg-slate-500/20 text-slate-400`}>
              Pending
            </span>
            {!modalOpenHere ? (
              <button
                type="button"
                onClick={() => openComplete(m.milestone_type)}
                className={`${timelineActionSizeClass} border-emerald-500/40 bg-emerald-500/15 text-emerald-200 antialiased transition-colors duration-200 hover:border-emerald-400/50 hover:bg-emerald-500/25 active:bg-emerald-500/20`}
              >
                Mark complete
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderStandaloneCard = (ci: MentoringCheckInItem) => (
    <div key={ci.id} className={standaloneCheckInCardClass}>
      <p className="text-[10px] font-semibold uppercase leading-none tracking-[0.14em] text-amber-400/80">
        Check-in note
      </p>
      <div className="flex min-w-0 flex-row flex-nowrap items-start gap-2 sm:gap-3">
        <span className="min-w-0 flex-1 break-words text-sm leading-snug text-amber-50/95">
          {ci.note}
        </span>
        <span className="shrink-0 whitespace-nowrap pt-0.5 text-xs leading-snug text-amber-200/90 tabular-nums">
          {ymdToDohDisplay(occurredYmd(ci))}
        </span>
        {canEditMilestones ? (
          <div className="flex shrink-0 flex-nowrap items-center gap-1.5 pt-0.5">
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

            <div className="mt-3 flex flex-col gap-1.5 text-left">
              <label htmlFor="milestone-dialog-note" className="text-xs font-medium text-slate-400">
                Note (optional)
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
                Completed date
              </label>
              <input
                id="milestone-dialog-date"
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="e.g. February 17, 2026 or 021726"
                value={completedDateInput}
                onChange={(e) => setCompletedDateInput(e.target.value)}
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
                className="min-h-[44px] rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-200 antialiased transition-colors duration-200 hover:border-emerald-400/55 hover:bg-emerald-500/25 active:bg-emerald-500/30 disabled:opacity-50 sm:order-2 sm:min-w-[6rem]"
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
