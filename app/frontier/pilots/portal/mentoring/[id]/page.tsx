import Link from "next/link";
import { getMenteeDetail, type MenteeDetailRow } from "../actions";
import { format, isToday, isTomorrow, isYesterday, differenceInDays, startOfDay } from "date-fns";
import { MentorContactCard } from "@/components/mentoring/mentor-contact-card";
import { LastInteractionSignal } from "@/components/mentoring/last-interaction-signal";
import { MentoringMilestoneTimeline } from "@/components/mentoring/mentoring-milestone-timeline";
import { MentorWorkspaceStatusPill } from "@/components/mentoring/mentor-mentee-card-workspace";
import { formatUsPhoneStored } from "@/lib/format-us-phone";

const CARD_CLASS =
  "rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-shadow transition-colors duration-200 hover:shadow-xl hover:shadow-black/50 hover:border-emerald-400/30 hover:from-slate-900/70 hover:to-slate-950/85";

const MILESTONE_TYPE_LABELS: Record<string, string> = {
  initial_assignment: "Date Of Hire - Initial Check-in with Mentee",
  type_rating: "Type Rating",
  oe_complete: "IOE Complete",
  three_months: "3 Month On Line",
  six_months: "6 Month On Line",
  nine_months: "9 Month On Line",
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
    return format(d, "MMMM d, yyyy");
  } catch {
    return "—";
  }
}

function formatWorkspaceNextCheckIn(ymd: string | null | undefined): string {
  const t = ymd?.trim();
  if (!t) return "";
  try {
    const d = new Date(t + "T12:00:00.000Z");
    if (Number.isNaN(d.getTime())) return t;
    return format(d, "MMM d, yyyy");
  } catch {
    return t;
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
    if (days >= 2 && days < 7) return `${days} Days`;
    return format(d, "MMMM d, yyyy");
  } catch {
    return "";
  }
}

function formatTimelineDueDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T12:00:00.000Z");
    if (Number.isNaN(d.getTime())) return dateStr;
    return format(d, "MMMM d, yyyy");
  } catch {
    return dateStr;
  }
}

/** Same order/labels as `menteeAssignmentBadge` on mentoring list (`mentoring/page.tsx`). */
function NextMilestoneHero({
  milestoneType,
  dueDate,
}: {
  milestoneType: string | null;
  dueDate: string | null;
}) {
  const name = milestoneType?.trim() ? formatMilestoneType(milestoneType) : "";
  const duePhrase = dueDate ? formatNextMilestoneDue(dueDate) : "";
  const hasAny = Boolean(name || duePhrase);

  const value =
    !hasAny ? "—" : name && duePhrase ? `${name} • ⏳ ${duePhrase}` : name ? name : `⏳ ${duePhrase}`;

  return (
    <p className="mt-6 text-sm font-medium leading-snug text-white">
      Next Milestone:
      <span className="ml-3 tabular-nums">{value}</span>
    </p>
  );
}

/** Same rules as `menteeAssignmentBadge` on `mentoring/page.tsx`. */
function menteeDetailAssignmentBadge(detail: MenteeDetailRow) {
  const hasMenteeId = Boolean(detail.mentee_user_id?.trim());
  const assignmentActive = detail.active === true;
  if (!hasMenteeId) {
    return {
      label: "Pending" as const,
      className: "bg-amber-500/20 text-amber-200 border border-amber-500/40",
    };
  }
  if (!assignmentActive) {
    return {
      label: "Inactive" as const,
      className: "bg-slate-500/20 text-slate-400 border border-slate-500/40",
    };
  }
  const authLoaded = "mentee_last_sign_in_at" in detail;
  if (authLoaded) {
    if (detail.mentee_last_sign_in_at == null) {
      return {
        label: "Not Joined" as const,
        className: "bg-amber-500/15 text-amber-200 border border-amber-400/30",
      };
    }
    return {
      label: "Active" as const,
      className: "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40",
    };
  }
  return {
    label: "Active" as const,
    className: "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40",
  };
}

type PageProps = { params: Promise<{ id: string }> };

export default async function MenteeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { detail, milestones, checkIns, error } = await getMenteeDetail(id);

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

  const backLabel = detail.isMentorView ? "← Back to My Mentees" : "← Back to My Mentor";
  const assignmentBadge = menteeDetailAssignmentBadge(detail);

  const menteeJoinedCrewrules =
    Boolean(detail.mentee_user_id?.trim()) &&
    ("mentee_last_sign_in_at" in detail
      ? detail.mentee_last_sign_in_at != null
      : detail.mentee_welcome_modal_version_seen != null);
  const crewBaseLine = menteeJoinedCrewrules
    ? detail.mentee_base_airport?.trim() || "—"
    : "Pending";

  const militaryLeavePausedMilestone =
    detail.isMentorView && detail.mentor_workspace_mentoring_status?.trim() === "Military Leave";

  return (
    <div className="space-y-4">
      <Link
        href="/frontier/pilots/portal/mentoring"
        className="inline-block text-sm text-slate-400 hover:text-white transition"
      >
        {backLabel}
      </Link>

      <div className={`${CARD_CLASS} p-6`}>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
            <h1 className="text-xl font-semibold tracking-tight text-white">{fullName}</h1>
            <span
              className={`inline-flex shrink-0 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${assignmentBadge.className}`}
            >
              {assignmentBadge.label}
            </span>
          </div>
          <LastInteractionSignal
            at={detail.last_interaction_at}
            className="w-full shrink-0 sm:ml-auto sm:w-auto"
          />
        </div>
        {detail.isMentorView ? (
          <>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm leading-snug text-slate-500">
              <span className="tabular-nums">
                <span>DOH:</span> {formatHireDate(detail.hire_date)}
              </span>
              <span className="tabular-nums">
                <span>Employee #:</span> {detail.mentee_employee_number ?? "—"}
              </span>
              <span>
                <span>Crew Base:</span> {crewBaseLine}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5 text-sm leading-snug text-slate-500">
              <span className="break-all">
                <span>Private Email:</span> {detail.mentee_personal_email ?? "—"}
              </span>
              <span className="tabular-nums">
                <span>Phone:</span> {formatUsPhoneStored(detail.mentee_phone) ?? "—"}
              </span>
            </div>
            {militaryLeavePausedMilestone ? (
              <div className="mt-6 space-y-1">
                <p className="text-sm font-medium leading-snug text-white">
                  Next Milestone:
                  <span className="ml-3 inline-flex flex-wrap items-center gap-2">
                    <span>Paused</span>
                    <MentorWorkspaceStatusPill status="Military Leave" />
                  </span>
                </p>
                {detail.mentor_workspace_next_check_in_date?.trim() ? (
                  <p className="text-xs text-slate-400">
                    Next Check-In:{" "}
                    <span className="text-slate-300">
                      {formatWorkspaceNextCheckIn(detail.mentor_workspace_next_check_in_date)}
                    </span>
                  </p>
                ) : null}
              </div>
            ) : (
              <NextMilestoneHero
                milestoneType={detail.next_milestone_label}
                dueDate={detail.next_milestone_due_date}
              />
            )}
          </>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm leading-snug text-slate-500">
              <span className="tabular-nums">
                <span>DOH:</span> {formatHireDate(detail.hire_date)}
              </span>
            </div>
            <NextMilestoneHero
              milestoneType={detail.next_milestone_label}
              dueDate={detail.next_milestone_due_date}
            />
          </>
        )}
      </div>

      {!detail.isMentorView ? (
        <MentorContactCard
          fullName={mentorCardName}
          contactEmail={detail.mentor_contact_email}
          phone={detail.mentor_phone_display}
        />
      ) : null}

      <div className={`${CARD_CLASS} p-6`}>
        <MentoringMilestoneTimeline
          assignmentId={detail.id}
          canEditMilestones={detail.isMentorView}
          showMenteeCheckIn={detail.isMentorView}
          checkIns={checkIns}
          items={milestones.map((m) => ({
            milestone_type: m.milestone_type,
            due_date: m.due_date,
            completed_date: m.completed_date,
            completed_at: m.completed_at,
            completion_note: m.completion_note,
            title: formatMilestoneType(m.milestone_type),
            dueDisplay: formatTimelineDueDate(m.due_date),
            completedDisplay: m.completed_date
              ? formatTimelineDueDate(
                  String(m.completed_date).trim().slice(0, 10) || m.due_date
                )
              : null,
          }))}
        />
      </div>
    </div>
  );
}
