import Link from "next/link";
import { getMenteeDetail } from "../actions";
import { format, isToday, isTomorrow, isYesterday, differenceInDays, startOfDay } from "date-fns";
import { MentorContactCard } from "@/components/mentoring/mentor-contact-card";

const CARD_CLASS =
  "rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20";

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

function formatNextMilestoneDue(dateStr: string | null): string {
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

function formatTimelineDueDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T12:00:00.000Z");
    if (Number.isNaN(d.getTime())) return dateStr;
    return format(d, "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}

type PageProps = { params: Promise<{ id: string }> };

export default async function MenteeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { detail, milestones, error } = await getMenteeDetail(id);

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <div className={`${CARD_CLASS} p-6`}>
          <p className="text-sm text-red-400">{error ?? "Not found"}</p>
          <Link
            href="/frontier/pilots/portal/mentoring"
            className="mt-4 inline-block text-sm text-slate-400 hover:text-white transition"
          >
            ← Back to Mentoring
          </Link>
        </div>
      </div>
    );
  }

  const fullName = (detail.isMentorView ? detail.mentee_full_name : detail.mentor_full_name)?.trim() || "Unknown";
  const mentorCardName = detail.mentor_full_name?.trim() || "Unknown";
  const nextMilestoneText =
    detail.next_milestone_label && detail.next_milestone_due_date
      ? `${formatMilestoneType(detail.next_milestone_label)} — ${formatNextMilestoneDue(detail.next_milestone_due_date)}`
      : detail.next_milestone_label
        ? formatMilestoneType(detail.next_milestone_label)
        : detail.next_milestone_due_date
          ? formatNextMilestoneDue(detail.next_milestone_due_date)
          : "—";

  const backLabel = detail.isMentorView ? "← Back to My Mentees" : "← Back to My Mentor";

  return (
    <div className="space-y-4">
      <Link
        href="/frontier/pilots/portal/mentoring"
        className="inline-block text-sm text-slate-400 hover:text-white transition"
      >
        {backLabel}
      </Link>

      <div className={`${CARD_CLASS} p-6`}>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-white">{fullName}</h1>
          <span
            className={`inline-flex shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
              !detail.mentee_user_id
                ? "bg-amber-500/20 text-amber-200 border border-amber-500/40"
                : detail.active
                  ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40"
                  : "bg-slate-500/20 text-slate-400 border border-slate-500/40"
            }`}
          >
            {!detail.mentee_user_id ? "Pending" : detail.active ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-400">
          <span>Hire date: {formatHireDate(detail.hire_date)}</span>
          <span>Last interaction: {formatLastInteraction(detail.last_interaction_at)}</span>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          Next milestone: {nextMilestoneText}
        </p>
      </div>

      {!detail.isMentorView ? (
        <MentorContactCard
          fullName={mentorCardName}
          contactEmail={detail.mentor_contact_email}
          phone={detail.mentor_phone_display}
        />
      ) : null}

      <div className={`${CARD_CLASS} p-6`}>
        <h2 className="text-lg font-semibold text-white border-b border-white/5 pb-3">
          Timeline
        </h2>
        {milestones.length === 0 ? (
          <div className="mt-6 py-8 text-center">
            <p className="text-sm text-slate-500">No milestones yet.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {milestones.map((m, i) => (
              <div
                key={`${m.assignment_id}-${m.milestone_type}-${m.due_date}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-950/40 px-4 py-3"
              >
                <span className="font-medium text-slate-200">
                  {formatMilestoneType(m.milestone_type)}
                </span>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-slate-400">{formatTimelineDueDate(m.due_date)}</span>
                  <span
                    className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${
                      m.completed_date
                        ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40"
                        : "bg-slate-500/20 text-slate-400 border border-slate-500/40"
                    }`}
                  >
                    {m.completed_date ? "Completed" : "Pending"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
