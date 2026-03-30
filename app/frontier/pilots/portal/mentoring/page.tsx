import Link from "next/link";
import { getProfile, isWithinFirstYearSinceDateOfHire } from "@/lib/profile";
import { getMentorAssignments, submitMentorshipProgramRequest, type MentorAssignmentRow } from "./actions";
import { format, isToday, isTomorrow, differenceInDays, startOfDay } from "date-fns";
import { LastInteractionSignal } from "@/components/mentoring/last-interaction-signal";
import { SharedMentoringCardPreview } from "@/components/shared-mentoring-card-preview";
import {
  MentorMenteeCardWorkspaceSummary,
  MentorMenteeWorkspaceNotesButton,
  MentorWorkspaceStatusPill,
} from "@/components/mentoring/mentor-mentee-card-workspace";

const SECTION_CLASS =
  "rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]";

const CARD_CLASS =
  `${SECTION_CLASS} transition-shadow transition-colors duration-200 hover:shadow-xl hover:shadow-black/50 hover:border-emerald-400/30 hover:from-slate-900/70 hover:to-slate-950/85`;

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
    if (days >= 2 && days < 7) return `${days} Days`;
    return format(d, "MMMM d, yyyy");
  } catch {
    return "";
  }
}

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

/** Matches mentee detail: due within the next 7 calendar days (0–6), inclusive of today. */
function isNextMilestoneDueWithinWeek(dueDate: string | null): boolean {
  if (!dueDate) return false;
  try {
    const d = new Date(dueDate + "T12:00:00.000Z");
    if (Number.isNaN(d.getTime())) return false;
    const days = differenceInDays(startOfDay(d), startOfDay(new Date()));
    return days >= 0 && days < 7;
  } catch {
    return false;
  }
}

function NextMilestoneCardBlock({
  milestoneLabel,
  milestoneDue,
  urgent,
  /** My Mentees (mentor) cards: keep milestone value same neutral tone as “IOE” rows; no due-soon highlight. */
  neutralMilestoneValueColor = false,
}: {
  milestoneLabel: string | null;
  milestoneDue: string | null;
  urgent: boolean;
  neutralMilestoneValueColor?: boolean;
}) {
  const formattedLabel = formatMilestoneType(milestoneLabel);
  const duePhrase = formatMilestoneDueDate(milestoneDue);
  const hasAny = Boolean(formattedLabel || duePhrase);

  const value =
    !hasAny
      ? "—"
      : formattedLabel && duePhrase
        ? `${formattedLabel} • ⏳ ${duePhrase}`
        : formattedLabel
          ? formattedLabel
          : `⏳ ${duePhrase}`;

  const valueClass =
    !hasAny
      ? "text-slate-500"
      : urgent && !neutralMilestoneValueColor
        ? "text-amber-100"
        : "text-slate-200";

  return (
    <p className="text-sm font-medium leading-snug">
      <span className="text-slate-500">Next Milestone:</span>
      <span className={`ml-3 tabular-nums ${valueClass}`}>{value}</span>
    </p>
  );
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

/**
 * Mentor-side assignment pill: when Auth sign-in is available, null `last_sign_in_at` → Not Joined; any signed-in
 * mentee is Active (welcome modal is not used for this pill).
 */
function menteeAssignmentBadge(a: MentorAssignmentRow) {
  const hasMenteeId = Boolean(a.mentee_user_id?.trim());
  const assignmentActive = a.mentee_status === "active";
  if (!hasMenteeId) {
    return {
      variant: "pending" as const,
      label: "Pending",
      className: "bg-amber-500/20 text-amber-200 border border-amber-500/40",
    };
  }
  if (!assignmentActive) {
    return {
      variant: "inactive" as const,
      label: "Inactive",
      className: "bg-slate-500/20 text-slate-400 border border-slate-500/40",
    };
  }
  const authLoaded = "mentee_last_sign_in_at" in a;
  if (authLoaded) {
    if (a.mentee_last_sign_in_at == null) {
      return {
        variant: "not_joined" as const,
        label: "Not Joined",
        className: "bg-amber-500/15 text-amber-200 border border-amber-400/30",
      };
    }
    return {
      variant: "active" as const,
      label: "Active",
      className: "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40",
    };
  }
  return {
    variant: "active" as const,
    label: "Active",
    className: "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40",
  };
}

function AssignmentStatusPill({ a }: { a: MentorAssignmentRow }) {
  const badge = menteeAssignmentBadge(a);
  return (
    <span
      className={`inline-flex shrink-0 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

/** First-year mentee with no assignment: matches mentee card chrome without inventing mentor contact. */
function UnassignedMentorPlaceholderCard() {
  return (
    <div
      className={`${CARD_CLASS} border-l-[3px] border-l-slate-500/45 p-4 sm:p-5 flex flex-col gap-4`}
    >
      <div>
        <h2 className="text-base font-semibold text-white border-b border-white/5 pb-3">Mentor</h2>
        <p className="mt-4 text-sm text-slate-400 leading-relaxed">
          No mentor is assigned yet. When your mentoring team pairs you with someone, their name and contact options will
          appear here.
        </p>
      </div>
    </div>
  );
}

function MenteeCard({ a }: { a: MentorAssignmentRow }) {
  const fullName = (a.isMentorView ? a.mentee_full_name : a.mentor_full_name)?.trim() || "Unknown";
  const milestoneLabel = a.next_milestone_label?.trim() || null;
  const milestoneDue = a.next_milestone_due_date;
  const nextMilestoneUrgent = isNextMilestoneDueWithinWeek(milestoneDue);

  const militaryLeavePausedMilestone =
    a.isMentorView && a.mentor_workspace_mentoring_status?.trim() === "Military Leave";

  /** Subtle left accent: amber when workspace = Military Leave; else CrewRules / active green. */
  const cardStateAccentClass = militaryLeavePausedMilestone
    ? "border-l-[3px] border-l-amber-400/50"
    : "border-l-[3px] border-l-emerald-500/45";

  if (!a.isMentorView) {
    return (
      <div className={`${CARD_CLASS} ${cardStateAccentClass} p-4 sm:p-5 flex flex-col gap-4`}>
        {a.mentor_shared_card_profile ? (
          <SharedMentoringCardPreview profile={a.mentor_shared_card_profile} variant="portal-mentee" />
        ) : a.mentee_status === "active" ? (
          <p className="text-sm text-slate-400">No mentor assigned yet.</p>
        ) : null}
        {/* TODO: restore visibility + `flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between` for mentee status strip */}
        <div className="hidden" aria-hidden>
          <div className="min-w-0 flex-1 space-y-2 border-t border-white/5 pt-4 sm:border-t-0 sm:pt-0">
            <div className="flex flex-wrap items-center gap-2">
              <AssignmentStatusPill a={a} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
              <span>
                <span>DOH:</span> {formatHireDate(a.mentee_date_of_hire)}
              </span>
            </div>
            <NextMilestoneCardBlock
              milestoneLabel={milestoneLabel}
              milestoneDue={milestoneDue}
              urgent={nextMilestoneUrgent}
            />
          </div>
          <div className="flex w-full min-w-0 shrink-0 flex-nowrap items-center justify-center gap-1.5 overflow-x-auto sm:w-auto sm:justify-end">
            <LastInteractionSignal at={a.last_interaction_at} compact className="shrink-0" />
            <Link
              href={`/frontier/pilots/portal/mentoring/${a.id}`}
              className="inline-flex shrink-0 items-center justify-center rounded-md bg-[#75C043] px-2.5 py-1 text-xs font-semibold leading-none text-slate-950 transition hover:opacity-95"
            >
              View
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${CARD_CLASS} ${cardStateAccentClass} p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-white truncate">{fullName}</h3>
          <AssignmentStatusPill a={a} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
          <span>
            <span>DOH:</span> {formatHireDate(a.mentee_date_of_hire)}
          </span>
        </div>
        {militaryLeavePausedMilestone ? (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-medium leading-snug">
              <span className="text-slate-500">Next Milestone:</span>
              <span className="ml-3 flex flex-wrap items-center gap-2 text-slate-200">
                <span>Paused</span>
                <MentorWorkspaceStatusPill status="Military Leave" />
              </span>
            </div>
            {a.mentor_workspace_next_check_in_date?.trim() ? (
              <p className="text-xs text-slate-400">
                Next Check-In:{" "}
                <span className="text-slate-300">
                  {formatWorkspaceNextCheckIn(a.mentor_workspace_next_check_in_date)}
                </span>
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <NextMilestoneCardBlock
              milestoneLabel={milestoneLabel}
              milestoneDue={milestoneDue}
              urgent={nextMilestoneUrgent}
              neutralMilestoneValueColor
            />
            <MentorMenteeCardWorkspaceSummary a={a} />
          </>
        )}
      </div>
      <div className="flex w-full min-w-0 shrink-0 flex-nowrap items-center justify-center gap-1.5 overflow-x-auto sm:w-auto sm:justify-end">
        <LastInteractionSignal at={a.last_interaction_at} compact className="shrink-0" />
        <Link
          href={`/frontier/pilots/portal/mentoring/${a.id}`}
          className="inline-flex shrink-0 items-center justify-center rounded-md bg-[#75C043] px-2.5 py-1 text-xs font-semibold leading-none text-slate-950 transition hover:opacity-95"
        >
          View
        </Link>
        <MentorMenteeWorkspaceNotesButton a={a} compact />
      </div>
    </div>
  );
}

export default async function MentoringPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>;
}) {
  const sp = await searchParams;
  const profile = await getProfile();
  const { assignments, error } = await getMentorAssignments();
  const isMentorView = assignments.length > 0 && assignments.some((a) => a.isMentorView);
  const sectionTitle = isMentorView ? "My Mentees" : "My Mentor";

  const isMentor = Boolean(profile?.is_mentor);
  const isFirstYear = isWithinFirstYearSinceDateOfHire(profile?.date_of_hire);

  let emptyHeading: string;
  let emptyBody: string;
  if (isMentor) {
    emptyHeading = "You're Ready to Mentor";
    emptyBody =
      "You are active in the mentoring program, but no mentees have been assigned yet.";
  } else if (isFirstYear) {
    emptyHeading = "Need a Mentor?";
    emptyBody =
      "You appear to be within your first year on property, but no mentor has been assigned yet.";
  } else {
    emptyHeading = "Interested in Mentoring?";
    emptyBody = "Help support new hires by sharing your experience and guidance.";
  }

  const requestType = isMentor
    ? "mentor_no_mentees"
    : isFirstYear
      ? "new_hire_help"
      : "mentor_interest";

  return (
    <div className="space-y-4">
      <div className={`${SECTION_CLASS} p-6`}>
        <h2 className="text-lg font-semibold text-white border-b border-white/5 pb-3">
          {assignments.length > 0
            ? sectionTitle
            : isMentor
              ? "My Mentees"
              : isFirstYear
                ? "My Mentor"
                : "My Mentees"}
        </h2>

        {sp.request === "submitted" ? (
          <p className="mt-4 text-sm text-emerald-400" role="status">
            Your request was submitted. The mentoring team will follow up as needed.
          </p>
        ) : null}
        {sp.request === "error" ? (
          <p className="mt-4 text-sm text-red-400" role="alert">
            We couldn&apos;t submit your request. Please try again later.
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 text-sm text-red-400">{error}</p>
        ) : assignments.length === 0 ? (
          <>
            <div className="mt-6 py-8 text-center">
              <h3 className="text-base font-medium text-slate-300">{emptyHeading}</h3>
              <p className="mt-2 text-sm text-slate-500">{emptyBody}</p>
              <form action={submitMentorshipProgramRequest.bind(null, requestType)} className="mt-4 inline-block">
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#75C043] px-4 py-2.5 text-sm font-semibold text-slate-950 hover:opacity-95 transition"
                >
                  Contact Mentorship Program
                </button>
              </form>
            </div>
            {isFirstYear && !isMentor ? (
              <div className="mt-4">
                <UnassignedMentorPlaceholderCard />
              </div>
            ) : null}
          </>
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
