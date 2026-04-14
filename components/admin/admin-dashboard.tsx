import type { ReactNode } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Users,
  Clock,
  Wifi,
  UploadCloud,
  GraduationCap,
  MessageSquareMore,
  BarChart3,
  CalendarRange,
  Lock,
  ArrowRight,
} from "lucide-react";
import type { MentoringOverviewStats } from "@/lib/mentoring/admin-overview-stats";
import type { MentorEmailAcknowledgementStats } from "@/lib/mentoring/mentor-email-acknowledgement-stats";
import type { AdminClassOverviewRow } from "@/lib/mentoring/frontier-admin-class-overview";
import type { FrontierProgramProgressItem } from "@/lib/mentoring/frontier-admin-program-progress";
import { AdminClassOverviewSection } from "@/components/admin/admin-class-overview-section";
import { AdminProgramProgressSection } from "@/components/admin/admin-program-progress-section";
import { ActiveMentorsMetricHelpPopover } from "@/components/admin/active-mentors-metric-help-popover";
import { MentorCoverageMetricHelpPopover } from "@/components/admin/mentor-coverage-metric-help-popover";
import { UnmatchedMenteesMetricHelpPopover } from "@/components/admin/unmatched-mentees-metric-help-popover";
import { EngagementRateMetricHelpPopover } from "@/components/admin/engagement-rate-metric-help-popover";
import { AtRiskMenteesMetricHelpPopover } from "@/components/admin/at-risk-mentees-metric-help-popover";
import { MissingMentorContactMetricHelpPopover } from "@/components/admin/missing-mentor-contact-metric-help-popover";
import { ProgramHealthScoreMetricHelpPopover } from "@/components/admin/program-health-score-metric-help-popover";
import type { FrontierAdminFailedMilestoneAttemptRow } from "@/lib/mentoring/frontier-admin-failed-milestone-attempts";
import { FailedMilestoneReviewRowActions } from "@/components/admin/failed-milestone-review-row-actions";
import { AdoptionProgramHealthCollapsible } from "@/components/admin/adoption-program-health-collapsible";
import type { MentorActivityRow } from "@/lib/mentoring/mentor-activity";
import type { TenantFeature } from "@/lib/tenant-features";

type Props = {
  tenant: string;
  portal: string;
  overview: MentoringOverviewStats;
  mentorActivity: MentorActivityRow[];
  tenantFeatures: TenantFeature[];
  failedMilestoneAttempts?: FrontierAdminFailedMilestoneAttemptRow[];
  /** Hire-date cohorts (same as Mentee Roster “Class”); read-only display. */
  classOverview: AdminClassOverviewRow[];
  /** Milestone completion % across active assignment rows from the same roster load. */
  programProgress: FrontierProgramProgressItem[];
  /** Mentor assignment email send / open counts (`mentor_email_events`). */
  emailAcknowledgementStats: MentorEmailAcknowledgementStats;
};

const MILESTONE_TYPE_LABELS: Record<string, string> = {
  initial_assignment: "Date Of Hire - Initial Check-in with Mentee",
  type_rating: "Type Rating",
  oe_complete: "IOE Complete",
  three_months: "3 Month On Line",
  six_months: "6 Month On Line",
  nine_months: "9 Month On Line",
  probation_checkride: "Probation Checkride",
};

function formatMilestoneTypeLabel(milestoneType: string): string {
  const t = milestoneType?.trim();
  if (!t) return "—";
  return MILESTONE_TYPE_LABELS[t] ?? t;
}

function formatAttemptYmd(ymd: string): string {
  const t = ymd?.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return ymd?.trim() || "—";
  const d = new Date(`${t}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function featureEnabled(features: TenantFeature[], key: string) {
  return features.find((f) => f.feature_key === key)?.enabled === true;
}

function pctRounded(part: number, whole: number): string | null {
  if (whole <= 0) return null;
  return `${Math.round((100 * part) / whole)}%`;
}

const adoptionHealthCardRoot =
  "flex min-h-0 h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm";
const adoptionHealthCardHeader =
  "border-b border-slate-200/90 bg-slate-50 px-3 py-2 sm:px-3.5";
const adoptionHealthCardBody = "flex min-h-0 flex-1 flex-col px-3 py-2.5";

function AdoptionHealthCard({
  title,
  headerSubtitle,
  headerClassName,
  children,
  footer,
  dashedPlaceholder,
}: {
  title: string;
  /** Small line under the title in the header band (normal sentence case). */
  headerSubtitle?: string;
  /** Optional override for the full header strip `className` (border, background, padding). */
  headerClassName?: string;
  children: ReactNode;
  /** Optional action row pinned to the bottom of the card body. */
  footer?: ReactNode;
  dashedPlaceholder?: boolean;
}) {
  const header = headerClassName ?? adoptionHealthCardHeader;
  return (
    <div
      className={`${adoptionHealthCardRoot} ${dashedPlaceholder ? "border-dashed border-slate-300 bg-slate-50/80" : ""}`}
      aria-label={dashedPlaceholder ? `${title} (placeholder)` : undefined}
    >
      <div className={header}>
        <h3
          className={`text-xs font-semibold uppercase tracking-wide ${dashedPlaceholder ? "text-slate-500" : "text-slate-600"}`}
        >
          {title}
        </h3>
        {headerSubtitle != null && headerSubtitle !== "" && (
          <p className="mt-0.5 text-[10px] leading-snug normal-case text-slate-500">{headerSubtitle}</p>
        )}
      </div>
      <div
        className={`${adoptionHealthCardBody} ${dashedPlaceholder ? "text-slate-500" : ""} ${footer != null ? "justify-between" : ""}`}
      >
        {footer != null ? (
          <>
            <div className="min-h-0 flex-1">{children}</div>
            <div className="mt-2 shrink-0 border-t border-slate-200 pt-2">{footer}</div>
          </>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function AdoptionProgramHealthGrid({
  overview,
  inviteListHref,
  emailAcknowledgementHref,
  emailAcknowledgementStats,
}: {
  overview: MentoringOverviewStats;
  inviteListHref: string;
  /** Mentoring email center (pending / acknowledgement UI to be wired). */
  emailAcknowledgementHref: string;
  emailAcknowledgementStats: MentorEmailAcknowledgementStats;
}) {
  const engagementPct = pctRounded(
    overview.menteeAssignmentsWithCheckInLast14d,
    overview.activeMentees
  );
  const engagementHeadline =
    overview.activeMentees > 0
      ? engagementPct ?? String(overview.menteeAssignmentsWithCheckInLast14d)
      : "—";

  /** Adoption card: active vs full funnel (active + staged mentees + staged mentors). */
  const menteesActiveAdoption = overview.liveMentees;
  const mentorsActiveAdoption = overview.mentors;
  const totalActiveAdoption = menteesActiveAdoption + mentorsActiveAdoption;
  const menteesStagedAdoption = overview.menteeRosterNotLive;
  const mentorsStagedAdoption = overview.stagedMentors;
  const totalUsersAdoption =
    totalActiveAdoption + menteesStagedAdoption + mentorsStagedAdoption;
  const programAdoptionPctRounded =
    totalUsersAdoption > 0 ? Math.round((100 * totalActiveAdoption) / totalUsersAdoption) : null;

  const { sent: emailsSent, opened: emailsAcknowledged, pending: emailsPending, confirmedPct } =
    emailAcknowledgementStats;

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <AdoptionHealthCard
        title="Onboarding needed"
        headerSubtitle="Not Yet on CrewRules™"
        footer={
          <Link
            href={inviteListHref}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 underline-offset-2 transition hover:text-slate-950 hover:underline"
          >
            Open Invite List
            <ArrowRight className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          </Link>
        }
      >
        <dl className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-xs text-slate-600">Mentees</dt>
            <dd className="text-base font-light tabular-nums text-slate-900">{overview.menteeRosterNotLive}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-xs text-slate-600">Mentors</dt>
            <dd className="text-base font-light tabular-nums text-slate-900">{overview.stagedMentors}</dd>
          </div>
        </dl>
      </AdoptionHealthCard>

      <AdoptionHealthCard title="Adoption" headerSubtitle="Active CrewRules™ users.">
        <dl className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-xs text-slate-600">Mentees Active</dt>
            <dd className="text-base font-light tabular-nums text-slate-900">{menteesActiveAdoption}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-xs text-slate-600">Mentors Active</dt>
            <dd className="text-base font-light tabular-nums text-slate-900">{mentorsActiveAdoption}</dd>
          </div>
        </dl>
        <div className="mt-2 border-t border-slate-200 pt-2">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-xl font-light tabular-nums text-slate-900">
              {programAdoptionPctRounded != null ? `${programAdoptionPctRounded}%` : "—"}
            </span>
            <span className="text-[11px] font-medium tracking-wide text-slate-500 normal-case">
              On{" "}
              <span>Crew</span>
              <span className="text-[#75C043]">Rules</span>
              <span>™</span>
            </span>
          </p>
        </div>
      </AdoptionHealthCard>

      <AdoptionHealthCard
        title="Engagement"
        headerSubtitle="Mentor–mentee engagement in CrewRules™"
      >
        <div>
          <p className="text-[11px] font-medium leading-snug text-slate-600">
            Mentor–Mentee Engagement
          </p>
          <p className="mt-0.5 text-xl font-light tabular-nums text-slate-900">{engagementHeadline}</p>
          <p className="mt-0.5 text-xs tabular-nums text-slate-600">
            {overview.activeMentees > 0
              ? `${overview.menteeAssignmentsWithCheckInLast14d} of ${overview.activeMentees} mentees engaged`
              : "No active mentees in scope"}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">Past 14 days</p>
        </div>
      </AdoptionHealthCard>

      <AdoptionHealthCard
        title="Email acknowledgement"
        headerSubtitle="Track Sent, opened, pending emails."
        footer={
          <Link
            href={emailAcknowledgementHref}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 underline-offset-2 transition hover:text-slate-950 hover:underline"
          >
            View Pending
            <ArrowRight className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          </Link>
        }
      >
        <div className="space-y-2">
          <dl className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-xs text-slate-600">Assignment Emails Sent</dt>
              <dd className="text-base font-light tabular-nums text-slate-900">{emailsSent}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-xs text-slate-600">Acknowledged</dt>
              <dd className="text-base font-light tabular-nums text-slate-900">{emailsAcknowledged}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-xs text-slate-600">Pending</dt>
              <dd className="text-base font-light tabular-nums text-slate-900">{emailsPending}</dd>
            </div>
          </dl>
          <p className="mt-1.5 text-sm font-medium tabular-nums text-slate-900">{confirmedPct}% Confirmed</p>
        </div>
      </AdoptionHealthCard>
    </div>
  );
}

/**
 * Net mentor **program** movement for the month: new `mentor_registry` rows minus registry rows moved to
 * inactive/former/archived (same caveats as server JSDoc on `mentorRegistryMarkedInactiveThisMonth`).
 */
function ActiveMentorsMonthDeltaSub({
  registryOnboarded,
  registryInactive,
  monthLabel,
}: {
  registryOnboarded: number;
  registryInactive: number;
  monthLabel: string;
}) {
  const net = registryOnboarded - registryInactive;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1 text-[11px] font-bold leading-tight text-slate-700">
      {net === 0 ? (
        <span className="tabular-nums text-slate-700">0</span>
      ) : net > 0 ? (
        <span className="tabular-nums text-emerald-600">+{net}</span>
      ) : (
        <span className="tabular-nums text-red-600">-{Math.abs(net)}</span>
      )}
      <span className="text-slate-700"> in {monthLabel}</span>
    </span>
  );
}

/** Composite letter from DB-backed inputs (not a stored column). */
function programHealthSnapshot(o: MentoringOverviewStats): {
  grade: string;
  hint: string;
  score: number;
} {
  const m = o.activeMentees;
  const engagementScore = m > 0 ? (o.menteeAssignmentsWithCheckInLast14d / m) * 100 : 100;
  const riskScore = m > 0 ? Math.max(0, 100 - (o.menteeAssignmentsAtRiskNoActivity21d / m) * 100) : 100;
  const contactScore =
    o.mentors > 0 ? Math.max(0, 100 - (o.missingMentorContact / o.mentors) * 100) : 100;

  if (m === 0 && o.unmatchedMentees === 0 && o.mentors === 0) {
    return { grade: "—", hint: "No mentoring data in scope", score: -1 };
  }

  /** Engagement, risk, and mentor contact only (roster / unmatched weighting removed for rework). */
  const score = Math.round(0.4 * engagementScore + 0.35 * riskScore + 0.25 * contactScore);
  const clamped = Math.max(0, Math.min(100, score));
  const grade =
    clamped >= 93
      ? "A"
      : clamped >= 87
        ? "B+"
        : clamped >= 80
          ? "B"
          : clamped >= 73
            ? "C+"
            : clamped >= 65
              ? "C"
              : clamped >= 55
                ? "D"
                : "F";

  let hint = "Weighted snapshot";
  if (m > 0) {
    const riskRt = o.menteeAssignmentsAtRiskNoActivity21d / m;
    const engRt = o.menteeAssignmentsWithCheckInLast14d / m;
    if (riskRt > 0.35) hint = "Many mentees inactive 21+ days";
    else if (engRt < 0.45) hint = "Check-in coverage below half";
    else if (o.missingMentorContact > 0) hint = "Mentors missing contact info";
    else if (clamped >= 82) hint = "Improving";
  }

  return { grade, hint, score: clamped };
}

function OverviewKpiCard({
  title,
  value,
  sub,
  barClass,
  valueClassName,
  valueSizeClassName,
  subTextClassName,
  titleClassName,
  titleUppercase = true,
  titleTrailing,
  /** When true, value and subtitle stay on one row (no flex-wrap). */
  valueSubNoWrap = false,
}: {
  title: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  barClass: string;
  valueClassName?: string;
  /** Overrides default `text-xl font-semibold` for the main KPI value. */
  valueSizeClassName?: string;
  /** Overrides default small subtext when `sub` is a string. */
  subTextClassName?: string;
  /** Merged after base title styles (e.g. `font-bold`). */
  titleClassName?: string;
  /** When false, title shows as written (e.g. "Active Mentors") instead of ALL CAPS. */
  titleUppercase?: boolean;
  /** Optional control in the title row (e.g. help popover). */
  titleTrailing?: React.ReactNode;
  valueSubNoWrap?: boolean;
}) {
  const titleSize = titleUppercase ? "text-[10px]" : "text-xs";
  const titleCasing = titleUppercase ? "uppercase tracking-wide" : "normal-case tracking-tight";
  return (
    <div className="flex h-full min-h-0 min-w-[132px] shrink-0 flex-col self-stretch overflow-visible rounded-lg border border-slate-200 bg-white shadow-sm md:min-w-0 md:w-full">
      <div className="flex min-h-0 flex-1 flex-col px-2.5 pb-1.5 pt-2">
        <div className="flex shrink-0 items-start justify-between gap-1.5">
          <div
            className={`min-w-0 flex-1 ${titleSize} ${titleCasing} text-slate-600 ${titleClassName ?? "font-semibold"}`}
          >
            {title}
          </div>
          {titleTrailing ? <div className="shrink-0 pt-px">{titleTrailing}</div> : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col justify-end">
          <div
            className={`mt-1.5 flex items-baseline gap-x-1.5 gap-y-0 ${valueSubNoWrap ? "flex-nowrap" : "flex-wrap"}`}
          >
            <span
              className={`${valueSizeClassName ?? "text-xl font-semibold"} leading-none tracking-tight tabular-nums ${valueClassName ?? "text-slate-900"} ${valueSubNoWrap ? "shrink-0" : ""}`}
            >
              {value}
            </span>
            {sub != null && sub !== "" ? (
              <span
                className={`leading-tight ${valueSubNoWrap ? "shrink-0 whitespace-nowrap" : "max-w-[11rem] min-w-0 sm:max-w-none"}`}
              >
                {typeof sub === "string" ? (
                  <span className={subTextClassName ?? "text-[10px] text-slate-600"}>{sub}</span>
                ) : (
                  sub
                )}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className={`h-2 w-full shrink-0 overflow-hidden rounded-b-lg ${barClass}`} />
    </div>
  );
}

/** Lower rank = shown first (attention-first). */
function mentorActivityTierRank(tier: MentorActivityRow["activity_tier"]): number {
  switch (tier) {
    case "never":
      return 0;
    case "stale":
      return 1;
    case "this_month":
      return 2;
    case "this_week":
      return 3;
    case "today":
      return 4;
    default:
      return 99;
  }
}

function sortMentorActivityRows(rows: MentorActivityRow[]): MentorActivityRow[] {
  return [...rows].sort((a, b) => {
    const ar = mentorActivityTierRank(a.activity_tier);
    const br = mentorActivityTierRank(b.activity_tier);
    if (ar !== br) return ar - br;
    if (b.mentee_count !== a.mentee_count) return b.mentee_count - a.mentee_count;
    return (a.full_name ?? "").localeCompare(b.full_name ?? "", undefined, { sensitivity: "base" });
  });
}

/** Relative age from `last_milestone_at` (same string the loader uses for the winning milestone). */
function formatMentorActivityRelativeAge(lastAt: string | null): string {
  if (lastAt == null || !String(lastAt).trim()) return "None yet";
  const d = new Date(String(lastAt).trim());
  if (Number.isNaN(d.getTime())) return "None yet";
  return formatDistanceToNow(d, { addSuffix: true });
}

type LastActivityPillBucket = "none" | "green" | "amber" | "red";

/**
 * Last activity pill colors from age of `last_milestone_at`:
 * 0–7 days green, 8–29 days amber, 30+ days red, none / invalid gray.
 */
function lastActivityPillBucket(lastAt: string | null): LastActivityPillBucket {
  if (lastAt == null || !String(lastAt).trim()) return "none";
  const d = new Date(String(lastAt).trim());
  if (Number.isNaN(d.getTime())) return "none";
  const diffMs = Date.now() - d.getTime();
  const day = 86_400_000;
  if (diffMs < 8 * day) return "green";
  if (diffMs < 30 * day) return "amber";
  return "red";
}

const LAST_ACTIVITY_PILL_CLASS: Record<LastActivityPillBucket, string> = {
  green: "border border-emerald-600/40 bg-emerald-50 text-emerald-900",
  amber: "border border-amber-600/35 bg-amber-50/90 text-amber-900",
  red: "border border-red-600/40 bg-red-50 text-red-900",
  none: "border border-slate-300/90 bg-slate-100 text-slate-700",
};

/** Fixed width so every Last activity pill matches ~“21 days ago” + horizontal padding. */
const MENTOR_ACTIVITY_RELATIVE_PILL_W = "w-[7.25rem]";

function mentorLastMilestoneLine1(row: MentorActivityRow): string {
  if (row.last_milestone_at == null || !String(row.last_milestone_at).trim()) {
    return "No milestone activity yet";
  }
  const type = row.last_milestone_milestone_type?.trim();
  return type ? formatMilestoneTypeLabel(type) : "—";
}

function MentorActivityRow({ row }: { row: MentorActivityRow }) {
  const name = row.full_name?.trim() || "—";
  const emp = row.employee_number ? `#${row.employee_number}` : null;
  const menteeLine = row.mentee_count === 1 ? "1 mentee" : `${row.mentee_count} mentees`;
  const relativeAge = formatMentorActivityRelativeAge(row.last_milestone_at);
  const lastActivityPill = LAST_ACTIVITY_PILL_CLASS[lastActivityPillBucket(row.last_milestone_at)];

  const winningMenteeName = row.last_milestone_mentee_name?.trim() || null;

  return (
    <div className="flex flex-col gap-0.5 py-1.5 sm:grid sm:grid-cols-[repeat(14,minmax(0,1fr))] sm:items-start sm:gap-x-3 sm:gap-y-0 sm:py-1.5">
      <div className="min-w-0 sm:col-span-2">
        <span className="block truncate text-sm font-medium leading-tight text-slate-800">{name}</span>
        {emp ? <span className="mt-0.5 text-xs tabular-nums text-slate-500 sm:hidden">{emp}</span> : null}
      </div>
      <div className="hidden min-w-0 sm:col-span-2 sm:block">
        {emp ? (
          <span className="block truncate font-mono text-xs tabular-nums text-slate-600">{emp}</span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </div>
      <div className="text-xs leading-snug text-slate-600 sm:col-span-2">{menteeLine}</div>
      <div className="min-w-0 text-[11px] leading-snug text-slate-500 sm:col-span-4">
        <p className="line-clamp-2">{mentorLastMilestoneLine1(row)}</p>
      </div>
      <div className="min-w-0 text-[11px] leading-snug text-slate-600 sm:col-span-2">
        <span className="block truncate sm:pt-0.5" title={winningMenteeName ?? undefined}>
          {winningMenteeName ?? "—"}
        </span>
      </div>
      <div className="flex justify-end text-right sm:col-span-2 sm:justify-end">
        <span
          className={`inline-block shrink-0 truncate rounded-md px-1.5 py-0.5 text-center text-[11px] font-medium leading-tight sm:mt-0.5 ${MENTOR_ACTIVITY_RELATIVE_PILL_W} ${lastActivityPill}`}
          title={relativeAge}
        >
          {relativeAge}
        </span>
      </div>
    </div>
  );
}

function LockedFeatureCard({
  icon: Icon,
  label,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
}) {
  return (
    <div className="relative flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 opacity-75 select-none">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-500">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">{label}</span>
          <Lock className="h-3 w-3 text-slate-500 shrink-0" />
        </div>
        <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

export function AdminDashboard({
  tenant,
  portal,
  overview,
  mentorActivity,
  tenantFeatures,
  failedMilestoneAttempts = [],
  classOverview,
  programProgress,
  emailAcknowledgementStats,
}: Props) {
  const base = `/${tenant}/${portal}/admin`;

  const engagementPct = pctRounded(overview.menteeAssignmentsWithCheckInLast14d, overview.activeMentees);
  const mentorCoverageSub =
    overview.menteeRosterTotal > 0
      ? `${Math.round((100 * overview.menteeRosterWithMentor) / overview.menteeRosterTotal)}% covered`
      : "—";
  const programHealth = programHealthSnapshot(overview);
  const engagementRate =
    overview.activeMentees > 0 && engagementPct != null ? engagementPct : "—";
  const engagementRatio =
    overview.activeMentees > 0
      ? overview.menteeAssignmentsWithCheckInLast14d / overview.activeMentees
      : 0;
  const engagementValueClass =
    overview.activeMentees <= 0
      ? "text-slate-900"
      : engagementRatio >= 0.7
        ? "text-emerald-600"
        : engagementRatio >= 0.45
          ? "text-slate-900"
          : "text-amber-800";
  const programHealthValueClass =
    programHealth.score < 0
      ? "text-slate-500"
      : programHealth.score >= 82
        ? "text-emerald-600"
        : programHealth.score >= 68
          ? "text-slate-900"
          : "text-amber-800";

  const mentorEnabled = featureEnabled(tenantFeatures, "mentoring");
  const mentorActivitySorted =
    mentorActivity.length > 0 ? sortMentorActivityRows(mentorActivity) : [];
  const mentorActivitySummary = {
    activeToday: mentorActivitySorted.filter((r) => r.activity_tier === "today").length,
    thisWeek: mentorActivitySorted.filter((r) => r.activity_tier === "this_week").length,
    thisMonth: mentorActivitySorted.filter((r) => r.activity_tier === "this_month").length,
    needsAttention: mentorActivitySorted.filter(
      (r) => r.activity_tier === "stale" || r.activity_tier === "never"
    ).length,
  };

  /** Same math as AdoptionProgramHealthGrid — one-line hint when the block is collapsed. */
  const totalActiveAdoptionSummary = overview.liveMentees + overview.mentors;
  const totalUsersAdoptionSummary =
    totalActiveAdoptionSummary + overview.menteeRosterNotLive + overview.stagedMentors;
  const adoptionPctSummary =
    totalUsersAdoptionSummary > 0
      ? `${Math.round((100 * totalActiveAdoptionSummary) / totalUsersAdoptionSummary)}%`
      : "—";
  const engagementSummary =
    overview.activeMentees > 0 && engagementPct != null ? engagementPct : "—";
  const emailsPart =
    emailAcknowledgementStats.sent === 0
      ? "Emails: none pending"
      : `Emails ${emailAcknowledgementStats.confirmedPct}%`;
  const adoptionHealthCollapsedSummary = `Adoption ${adoptionPctSummary} · Engagement ${engagementSummary} · ${emailsPart}`;

  return (
    <div className="space-y-8">
      {/* ── CREWRULES ADOPTION & PROGRAM HEALTH (collapsible; default closed) ── */}
      <AdoptionProgramHealthCollapsible collapsedSummary={adoptionHealthCollapsedSummary}>
        <AdoptionProgramHealthGrid
          overview={overview}
          inviteListHref={`${base}/users`}
          emailAcknowledgementHref={`${base}/mentoring/email-center`}
          emailAcknowledgementStats={emailAcknowledgementStats}
        />
      </AdoptionProgramHealthCollapsible>

      {/* ── PROGRAM SNAPSHOT (7 KPI cards) ─────────────────── */}
      <section aria-labelledby="admin-program-snapshot-heading" className="space-y-3">
        <h2
          id="admin-program-snapshot-heading"
          className="text-sm font-semibold uppercase tracking-wider text-slate-700"
        >
          Program Snapshot
        </h2>
        <div className="-mx-1 flex flex-nowrap items-stretch gap-2 overflow-x-auto px-1 pb-0.5 md:mx-0 md:grid md:grid-cols-7 md:gap-2.5 md:overflow-visible md:px-0">
          <OverviewKpiCard
            title="Active Mentors"
            titleUppercase={false}
            titleClassName="font-bold"
            valueSizeClassName="text-2xl font-bold"
            titleTrailing={<ActiveMentorsMetricHelpPopover />}
            value={overview.mentors}
            sub={
              <ActiveMentorsMonthDeltaSub
                registryOnboarded={overview.mentorRegistryOnboardedThisMonth}
                registryInactive={overview.mentorRegistryMarkedInactiveThisMonth}
                monthLabel={overview.mentorJoinMonthLabel}
              />
            }
            barClass="bg-emerald-500"
          />
          <OverviewKpiCard
            title="Mentor Coverage"
            titleUppercase={false}
            titleClassName="font-bold"
            valueSizeClassName="text-2xl font-bold"
            titleTrailing={<MentorCoverageMetricHelpPopover />}
            value={overview.menteeRosterTotal}
            sub={mentorCoverageSub}
            subTextClassName="text-[11px] font-bold text-slate-700"
            barClass="bg-blue-600"
          />
          <OverviewKpiCard
            title="Unmatched Mentees"
            titleUppercase={false}
            titleClassName="font-bold"
            valueSizeClassName="text-2xl font-bold"
            titleTrailing={<UnmatchedMenteesMetricHelpPopover />}
            valueSubNoWrap
            value={overview.unmatchedMentees}
            sub="Needs assignment"
            subTextClassName="text-[11px] font-bold text-slate-700"
            barClass={overview.unmatchedMentees > 0 ? "bg-red-500" : "bg-emerald-500"}
          />
          <OverviewKpiCard
            title="Engagement Rate"
            titleUppercase={false}
            titleClassName="font-bold"
            valueSizeClassName="text-xl font-bold"
            titleTrailing={<EngagementRateMetricHelpPopover />}
            valueSubNoWrap
            value={engagementRate}
            sub="Active last 14 days"
            subTextClassName="text-[10px] font-bold leading-tight text-slate-700"
            barClass="bg-emerald-800"
            valueClassName={engagementValueClass}
          />
          <OverviewKpiCard
            title="At-Risk Mentees"
            titleUppercase={false}
            titleClassName="font-bold"
            valueSizeClassName="text-2xl font-bold"
            titleTrailing={<AtRiskMenteesMetricHelpPopover />}
            valueSubNoWrap
            value={overview.menteeAssignmentsAtRiskNoActivity21d}
            sub="No check-in 21+ days"
            subTextClassName="text-[11px] font-bold text-slate-700"
            barClass="bg-red-500"
            valueClassName={
              overview.menteeAssignmentsAtRiskNoActivity21d > 0 ? "text-red-600" : "text-slate-900"
            }
          />
          <OverviewKpiCard
            title="Missing Mentor Contact"
            titleUppercase={false}
            titleClassName="font-bold"
            valueSizeClassName="text-2xl font-bold"
            titleTrailing={<MissingMentorContactMetricHelpPopover />}
            valueSubNoWrap
            value={overview.missingMentorContact}
            sub="No phone/email"
            subTextClassName="text-[11px] font-bold text-slate-700"
            barClass="bg-slate-400"
          />
          <OverviewKpiCard
            title="Program Health Score"
            titleUppercase={false}
            titleClassName="font-bold"
            valueSizeClassName="text-2xl font-bold"
            titleTrailing={<ProgramHealthScoreMetricHelpPopover />}
            value={programHealth.grade}
            sub={programHealth.hint}
            subTextClassName="text-[11px] font-bold text-slate-700"
            barClass="bg-lime-400"
            valueClassName={programHealthValueClass}
          />
        </div>
      </section>

      {/* ── OPEN FAILED MILESTONE REVIEWS ─────────────────── */}
      {failedMilestoneAttempts.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center gap-2 bg-red-500 px-4 py-3 sm:px-5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-white" aria-hidden />
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">Attention Required</h2>
          </div>
          <div className="border-l-4 border-l-red-500">
            <div className="flex flex-col gap-4 px-4 pb-4 pt-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:pb-5 sm:pt-5">
              <div className="min-w-0">
                <h3 className="text-base font-semibold tracking-tight text-slate-900">
                  OPEN{" "}
                  <span className="font-normal text-slate-400" aria-hidden="true">
                    •
                  </span>{" "}
                  Failed Milestone Review
                </h3>
              </div>
              <Link
                href={`${base}/mentoring/assignments`}
                className="inline-flex shrink-0 items-center justify-center self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:self-auto"
              >
                Open assignments →
              </Link>
            </div>

            <div className="border-t border-slate-200 bg-slate-50/60">
              <div className="overflow-x-auto px-3 pb-3 pt-0 sm:px-4 sm:pb-4">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/90 text-xs font-medium uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2.5 sm:px-4">Mentee</th>
                        <th className="px-3 py-2.5 sm:px-4">Mentor</th>
                        <th className="px-3 py-2.5 sm:px-4">Milestone</th>
                        <th className="px-3 py-2.5 sm:px-4">Failed date</th>
                        <th className="px-3 py-2.5 sm:px-4">Note</th>
                        <th className="min-w-[7.5rem] max-w-[10rem] px-3 py-2.5 sm:max-w-[12rem] sm:px-4">
                          Assignment ID
                        </th>
                        <th className="w-[1%] whitespace-nowrap px-3 py-2.5 pl-2 text-right sm:px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {failedMilestoneAttempts.map((row) => (
                        <tr key={row.attempt_id} className="text-slate-800">
                          <td
                            className="max-w-[10rem] truncate px-3 py-2.5 align-top sm:max-w-[12rem] sm:px-4"
                            title={row.mentee_display_name ?? undefined}
                          >
                            {row.mentee_display_name?.trim() || "—"}
                          </td>
                          <td
                            className="max-w-[10rem] truncate px-3 py-2.5 align-top sm:max-w-[12rem] sm:px-4"
                            title={row.mentor_display_name ?? undefined}
                          >
                            {row.mentor_display_name?.trim() || "—"}
                          </td>
                          <td className="max-w-[200px] px-3 py-2.5 align-top text-slate-700 sm:max-w-[220px] sm:px-4">
                            <span className="line-clamp-2" title={formatMilestoneTypeLabel(row.milestone_type)}>
                              {formatMilestoneTypeLabel(row.milestone_type)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 align-top tabular-nums text-slate-700 sm:px-4">
                            {formatAttemptYmd(row.occurred_on)}
                          </td>
                          <td className="max-w-[200px] px-3 py-2.5 align-top text-slate-600 sm:max-w-[240px] sm:px-4">
                            {row.note?.trim() ? (
                              <span className="line-clamp-3" title={row.note}>
                                {row.note}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="max-w-[10rem] px-3 py-2.5 align-top sm:max-w-[12rem] sm:px-4">
                            <Link
                              href={`/${tenant}/${portal}/portal/mentoring/${row.assignment_id}`}
                              title={`Open assignment in pilot portal — ${row.assignment_id}`}
                              className="block truncate font-mono text-[11px] font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-950 hover:decoration-slate-500"
                            >
                              {row.assignment_id}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 pl-2 text-right align-top sm:px-4">
                            <div className="flex justify-end">
                              <FailedMilestoneReviewRowActions attemptId={row.attempt_id} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* ── CLASS OVERVIEW + PROGRAM PROGRESS (70% / 30%, class grid max 4 cols) ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[7fr_3fr] lg:items-start">
        <div className="min-w-0">
          <AdminClassOverviewSection classOverview={classOverview} base={base} />
        </div>
        <div className="min-w-0 w-full lg:self-start">
          <AdminProgramProgressSection items={programProgress} />
        </div>
      </div>

      {/* ── MENTOR ACTIVITY ────────────────────────────────── */}
      {mentorEnabled && mentorActivitySorted.length > 0 && (
        <section aria-label="Mentor Activity">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 sm:px-5">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 sm:gap-x-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200/80">
                  <GraduationCap className="h-4 w-4" aria-hidden />
                </div>
                <h2 className="shrink-0 text-sm font-semibold tracking-wide text-[#1a2b4b]">Mentor Activity</h2>
              </div>
              <Link
                href={`${base}/mentoring`}
                className="shrink-0 text-xs text-slate-600 transition hover:text-slate-900"
              >
                View all →
              </Link>
            </div>

            <div className="border-b border-slate-100 bg-slate-50/40 px-3 py-2 sm:px-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-200/90 bg-white px-2.5 py-1.5 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Active today</p>
                  <p className="mt-0.5 text-base font-semibold tabular-nums leading-none text-slate-900">
                    {mentorActivitySummary.activeToday}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200/90 bg-white px-2.5 py-1.5 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">This week</p>
                  <p className="mt-0.5 text-base font-semibold tabular-nums leading-none text-slate-900">
                    {mentorActivitySummary.thisWeek}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200/90 bg-white px-2.5 py-1.5 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">This month</p>
                  <p className="mt-0.5 text-base font-semibold tabular-nums leading-none text-slate-900">
                    {mentorActivitySummary.thisMonth}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200/90 bg-white px-2.5 py-1.5 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Needs attention</p>
                  <p className="mt-0.5 text-base font-semibold tabular-nums leading-none text-red-800">
                    {mentorActivitySummary.needsAttention}
                  </p>
                </div>
              </div>
            </div>

            <div className="hidden border-b border-slate-200 bg-slate-50/80 px-4 py-2 sm:grid sm:grid-cols-[repeat(14,minmax(0,1fr))] sm:gap-x-3 sm:px-5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">
                MENTOR NAME
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">
                Employee #
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">
                Mentees assigned
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:col-span-4">
                LAST MILESTONE UPDATE
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">
                MENTEE NAME
              </div>
              <div className="text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">
                LAST ACTIVITY
              </div>
            </div>

            <div className="px-4 sm:px-5">
              <div className="divide-y divide-slate-200">
                {mentorActivitySorted.slice(0, 10).map((row) => (
                  <MentorActivityRow key={row.mentor_user_id} row={row} />
                ))}
              </div>
            </div>

            {mentorActivitySorted.length > 10 ? (
              <>
                <div className="border-t border-slate-200" />
                <p className="px-4 py-2.5 text-right text-xs text-slate-500 sm:px-5">
                  +{mentorActivitySorted.length - 10} more mentors —{" "}
                  <Link href={`${base}/mentoring`} className="text-slate-600 transition hover:text-slate-900">
                    view all
                  </Link>
                </p>
              </>
            ) : null}
          </div>
        </section>
      )}

      {/* ── QUICK ACTIONS ──────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            {
              icon: UploadCloud,
              label: "Import Mentor CSV",
              sub: "Upload from ALPA roster export",
              href: `${base}/mentoring`,
            },
            {
              icon: Users,
              label: "Manage Users",
              sub: "View, search, or change pilot roles",
              href: `${base}/users`,
            },
            {
              icon: GraduationCap,
              label: "Mentoring Admin",
              sub: "Assignments, milestones, and contacts",
              href: `${base}/mentoring`,
            },
            {
              icon: Clock,
              label: "Program Requests",
              sub:
                overview.openMentorshipProgramRequests > 0
                  ? `${overview.openMentorshipProgramRequests} open requests`
                  : "No open requests",
              href: `${base}/mentoring`,
            },
          ].map(({ icon: Icon, label, sub, href }) => (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50 group shadow-sm"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:text-slate-900 transition">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-800">{label}</div>
                <div className="text-xs text-slate-600 truncate">{sub}</div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition ml-auto shrink-0" />
            </Link>
          ))}
        </div>
      </section>

      {/* ── ENTERPRISE PROGRAMS ────────────────────────────── */}
      {/* Only shown when Super Admin explicitly enables the upsell flag */}
      {featureEnabled(tenantFeatures, "show_enterprise_programs") && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
              Enterprise Programs
            </h2>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
              Contact CrewRules™ to unlock
            </span>
          </div>

          <div className="space-y-2">
            {!featureEnabled(tenantFeatures, "pilot_to_pilot") && (
              <LockedFeatureCard
                icon={MessageSquareMore}
                label="Pilot-to-Pilot Communication"
                description="Anonymous or identified P2P messaging, peer check-ins, and shared experience threads for your crew."
              />
            )}
            {!featureEnabled(tenantFeatures, "advanced_analytics") && (
              <LockedFeatureCard
                icon={BarChart3}
                label="Advanced Analytics"
                description="Engagement heatmaps, milestone completion rates, time-to-match reports, and CSV data exports."
              />
            )}
            {!featureEnabled(tenantFeatures, "scheduling_tools") && (
              <LockedFeatureCard
                icon={CalendarRange}
                label="Scheduling Tools"
                description="Bulk roster import, auto-assignment suggestions, and open-time management helpers."
              />
            )}
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            These features are part of the CrewRules™ Enterprise plan. Once enabled by the
            platform team, they appear here for your tenant automatically.
          </p>
        </section>
      )}

      {/* Connection status indicator */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Wifi className="h-3 w-3" />
        <span>Live Data · Refreshes on page load</span>
      </div>
    </div>
  );
}
