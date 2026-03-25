import Link from "next/link";
import { getMentorAssignments, type MentorAssignmentRow } from "./actions";
import { format, isToday, isTomorrow, isYesterday, differenceInDays, startOfDay } from "date-fns";
import { MentorContactCard } from "@/components/mentoring/mentor-contact-card";

const CARD_CLASS =
  "rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20";

function formatHireDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr + "T12:00:00.000Z");
    if (Number.isNaN(d.getTime())) return "—";
    return format(d, "MMM d, yyyy");
  } catch {
    return "—";
  }
}

function formatLastInteraction(iso: string | null): string {
  if (!iso) return "Never";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Never";
    const dDate = startOfDay(d);
    const today = startOfDay(new Date());
    if (isToday(dDate)) return "Today";
    if (isYesterday(dDate)) return "Yesterday";
    const days = differenceInDays(today, dDate);
    if (days <= 30) return `${days} days ago`;
    return format(d, "MMM d, yyyy");
  } catch {
    return "Never";
  }
}

function formatMilestoneDueDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr + "T12:00:00.000Z");
    if (Number.isNaN(d.getTime())) return "";
    const dDate = startOfDay(d);
    const today = startOfDay(new Date());
    if (isToday(dDate)) return "Today";
    if (isTomorrow(dDate)) return "Tomorrow";
    const days = differenceInDays(dDate, today);
    if (days >= 2 && days <= 7) return `in ${days} days`;
    return format(d, "MMM d, yyyy");
  } catch {
    return "";
  }
}

const MILESTONE_TYPE_LABELS: Record<string, string> = {
  initial_assignment: "Initial Assignment",
  type_rating: "Type Rating",
  oe_complete: "OE Complete",
  three_months: "3 Months",
  six_months: "6 Months",
  nine_months: "9 Months",
  probation_checkride: "Probation Checkride",
};

function formatMilestoneType(milestoneType: string | null): string {
  if (!milestoneType?.trim()) return "";
  return MILESTONE_TYPE_LABELS[milestoneType.trim()] ?? milestoneType;
}

function getBadgeState(menteeUserId: string | null, active: boolean) {
  if (!menteeUserId) return { label: "Pending", style: "bg-amber-500/20 text-amber-200 border border-amber-500/40" };
  if (active) return { label: "Active", style: "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40" };
  return { label: "Inactive", style: "bg-slate-500/20 text-slate-400 border border-slate-500/40" };
}

function MenteeCard({ a }: { a: MentorAssignmentRow }) {
  const fullName = (a.isMentorView ? a.mentee_full_name : a.mentor_full_name)?.trim() || "Unknown";
  const badge = getBadgeState(a.mentee_user_id, a.mentee_status === "active");
  const milestoneLabel = a.next_milestone_label?.trim() || null;
  const milestoneDue = a.next_milestone_due_date;
  const formattedLabel = formatMilestoneType(milestoneLabel);
  const milestoneText =
    formattedLabel && milestoneDue
      ? `${formattedLabel} — ${formatMilestoneDueDate(milestoneDue)}`
      : formattedLabel
        ? formattedLabel
        : milestoneDue
          ? `Due ${formatMilestoneDueDate(milestoneDue)}`
          : "—";

  if (!a.isMentorView) {
    return (
      <div className={`${CARD_CLASS} p-4 sm:p-5 flex flex-col gap-4`}>
        <MentorContactCard
          variant="embedded"
          fullName={fullName}
          contactEmail={a.mentor_contact_email}
          phone={a.mentor_phone_display}
        />
        <div className="min-w-0 space-y-2 border-t border-white/5 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex shrink-0 rounded px-2 py-0.5 text-xs font-medium ${badge.style}`}
            >
              {badge.label}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
            <span>Hire date: {formatHireDate(a.mentee_date_of_hire)}</span>
            <span>Last interaction: {formatLastInteraction(a.last_interaction_at)}</span>
          </div>
          <p className="text-sm text-slate-300">Next milestone: {milestoneText}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={`/frontier/pilots/portal/mentoring/${a.id}`}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-[#75C043] px-4 py-2 text-sm font-semibold text-slate-950 hover:opacity-95 transition sm:flex-none"
          >
            View
          </Link>
          <button
            type="button"
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 transition sm:flex-none"
          >
            Notes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${CARD_CLASS} p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-white truncate">{fullName}</h3>
          <span
            className={`inline-flex shrink-0 rounded px-2 py-0.5 text-xs font-medium ${badge.style}`}
          >
            {badge.label}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
          <span>Hire date: {formatHireDate(a.mentee_date_of_hire)}</span>
          <span>Last interaction: {formatLastInteraction(a.last_interaction_at)}</span>
        </div>
        <p className="text-sm text-slate-300">
          Next milestone: {milestoneText}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link
          href={`/frontier/pilots/portal/mentoring/${a.id}`}
          className="rounded-lg bg-[#75C043] px-4 py-2 text-sm font-semibold text-slate-950 hover:opacity-95 transition"
        >
          View
        </Link>
        <button
          type="button"
          className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 transition"
        >
          Notes
        </button>
      </div>
    </div>
  );
}

export default async function MentoringPage() {
  const { assignments, error } = await getMentorAssignments();
  const isMentorView = assignments.length > 0 && assignments.some((a) => a.isMentorView);
  const sectionTitle = isMentorView ? "My Mentees" : "My Mentor";
  const emptyTitle =
    assignments.length === 0
      ? "No mentoring assignments yet"
      : isMentorView
        ? "No mentees assigned yet"
        : "No mentor assigned yet";

  return (
    <div className="space-y-4">
      <div className={`${CARD_CLASS} p-6`}>
        <h2 className="text-lg font-semibold text-white border-b border-white/5 pb-3">
          {assignments.length > 0 ? sectionTitle : "My Mentees"}
        </h2>

        {error ? (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        ) : assignments.length === 0 ? (
          <div className="mt-6 py-8 text-center">
            <h3 className="text-base font-medium text-slate-300">
              {emptyTitle}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Mentor assignments are managed by Union/Admin.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {assignments.map((a) => (
              <MenteeCard key={a.id} a={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
