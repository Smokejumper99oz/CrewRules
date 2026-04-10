import Link from "next/link";
import {
  AlertTriangle,
  Users,
  CheckCircle2,
  Clock,
  Wifi,
  UploadCloud,
  GraduationCap,
  MessageSquareMore,
  BarChart3,
  CalendarRange,
  Lock,
  ArrowRight,
  UserCheck,
  UserX,
  ClipboardList,
  Phone,
} from "lucide-react";
import type { MentoringOverviewStats } from "@/lib/mentoring/admin-overview-stats";
import type { FrontierAdminFailedMilestoneAttemptRow } from "@/lib/mentoring/frontier-admin-failed-milestone-attempts";
import { FailedMilestoneReviewRowActions } from "@/components/admin/failed-milestone-review-row-actions";
import type { MentorActivityRow } from "@/lib/mentoring/mentor-activity";
import type { TenantFeature } from "@/lib/tenant-features";

type Props = {
  tenant: string;
  portal: string;
  overview: MentoringOverviewStats;
  mentorActivity: MentorActivityRow[];
  tenantFeatures: TenantFeature[];
  failedMilestoneAttempts?: FrontierAdminFailedMilestoneAttemptRow[];
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

const ATTENTION_SEVERITY_STYLES: Record<
  "critical" | "amber" | "slate" | "teal" | "info" | "success",
  { shell: string; count: string; label: string; icon: string; footer: string }
> = {
  critical: {
    shell: "border-red-500/50 bg-red-950/38 transition hover:opacity-90",
    count: "text-red-200",
    label: "text-red-200",
    icon: "text-red-300/90 opacity-90",
    footer: "text-red-400/80",
  },
  amber: {
    shell: "border-amber-500/40 bg-amber-950/24 transition hover:opacity-90",
    count: "text-amber-200",
    label: "text-amber-200",
    icon: "text-amber-300/90 opacity-90",
    footer: "text-amber-400/80",
  },
  slate: {
    shell: "border-slate-600/50 bg-slate-800/45 transition hover:opacity-90",
    count: "text-slate-200",
    label: "text-slate-200",
    icon: "text-slate-400 opacity-90",
    footer: "text-slate-400/95",
  },
  teal: {
    shell: "border-teal-500/40 bg-teal-950/25 transition hover:opacity-90",
    count: "text-teal-200",
    label: "text-teal-200",
    icon: "text-teal-300/90 opacity-90",
    footer: "text-teal-400/80",
  },
  info: {
    shell: "border-blue-500/40 bg-blue-950/25 transition hover:opacity-90",
    count: "text-blue-200",
    label: "text-blue-200",
    icon: "text-blue-300/90 opacity-90",
    footer: "text-blue-400/80",
  },
  success: {
    shell: "border-green-500/30 bg-green-950/25 transition hover:opacity-90",
    count: "text-green-300",
    label: "text-green-300",
    icon: "text-green-400/90 opacity-90",
    footer: "text-green-400/75",
  },
};

/** Compact tile (StatPill-style layout) with legacy banner severity colors. */
function AttentionStatCard({
  icon: Icon,
  label,
  count,
  href,
  severity,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  href: string;
  severity: "critical" | "amber" | "slate" | "teal" | "info" | "success";
}) {
  const s = ATTENTION_SEVERITY_STYLES[severity];
  return (
    <Link
      href={href}
      className={`group flex min-h-0 flex-col gap-0.5 rounded-xl border px-4 py-3 ${s.shell}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`text-xl font-light leading-none tabular-nums ${s.count}`}>
          {count}
        </span>
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.icon}`} aria-hidden />
      </div>
      <span className={`text-xs leading-snug ${s.label}`}>{label}</span>
      <span className={`mt-1 flex items-center gap-1 text-[11px] ${s.footer}`}>
        Open
        <ArrowRight className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      </span>
    </Link>
  );
}

function StatPill({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-3">
      <span className="text-xl font-light text-slate-100 tabular-nums">{value}</span>
      <span className="text-xs text-slate-300">{label}</span>
      {sub && <span className="text-[11px] text-slate-500">{sub}</span>}
    </div>
  );
}

const ACTIVITY_BADGE: Record<
  MentorActivityRow["activity_tier"],
  { label: string; className: string }
> = {
  today: { label: "Active today", className: "bg-[#75C043]/15 text-[#75C043]" },
  this_week: { label: "This week", className: "bg-blue-500/15 text-blue-400" },
  this_month: { label: "This month", className: "bg-slate-600/60 text-slate-400" },
  stale: { label: "30+ days ago", className: "bg-slate-700/40 text-slate-400" },
  never: { label: "No activity", className: "bg-red-500/10 text-red-400" },
};

function MentorActivityRow({ row }: { row: MentorActivityRow }) {
  const badge = ACTIVITY_BADGE[row.activity_tier];
  const name = row.full_name?.trim() || "—";
  const emp = row.employee_number ? `#${row.employee_number}` : null;

  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700/60 text-xs font-medium text-slate-300">
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-200 truncate">{name}</span>
          {emp && <span className="text-xs text-slate-500 shrink-0">{emp}</span>}
        </div>
        <div className="text-xs text-slate-400">
          {row.mentee_count === 1 ? "1 mentee" : `${row.mentee_count} mentees`}
        </div>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>
        {badge.label}
      </span>
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
    <div className="relative flex items-start gap-3 rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-4 opacity-60 select-none">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-700/55 text-slate-500">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-300">{label}</span>
          <Lock className="h-3 w-3 text-slate-600 shrink-0" />
        </div>
        <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">{description}</p>
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
}: Props) {
  const base = `/${tenant}/${portal}/admin`;

  // Attention items (only show if count > 0)
  const attentionItems = [
    overview.unmatchedMentees > 0 && {
      icon: UserX,
      label: "Mentees waiting for a mentor match",
      count: overview.unmatchedMentees,
      href: `${base}/mentoring/mentee-roster`,
      severity: "critical" as const,
    },
    overview.openMentorshipProgramRequests > 0 && {
      icon: ClipboardList,
      label: "Open mentorship program requests",
      count: overview.openMentorshipProgramRequests,
      href: `${base}/mentoring`,
      severity: "amber" as const,
    },
    overview.missingMentorContact > 0 && {
      icon: Phone,
      label: "Mentors missing contact information",
      count: overview.missingMentorContact,
      href: `${base}/mentoring`,
      severity: "slate" as const,
    },
    {
      icon: MessageSquareMore,
      label: "Mentees needing follow-up",
      count: overview.menteesNeedingFollowUp,
      href: `${base}/mentoring/mentee-roster?follow_up=1`,
      severity:
        overview.menteesNeedingFollowUp > 0 ? ("teal" as const) : ("success" as const),
    },
    overview.stagedMentors > 0 && {
      icon: UserCheck,
      label: "Staged mentors not yet linked to a profile",
      count: overview.stagedMentors,
      href: `${base}/mentoring`,
      severity: "info" as const,
    },
  ].filter(Boolean) as React.ComponentProps<typeof AttentionStatCard>[];

  const mentorEnabled = featureEnabled(tenantFeatures, "mentoring");
  const inactiveCount = mentorActivity.filter(
    (r) => r.activity_tier === "stale" || r.activity_tier === "never"
  ).length;

  return (
    <div className="space-y-8">
      {/* ── ATTENTION REQUIRED ─────────────────────────────── */}
      {attentionItems.length > 0 && (
        <section className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Attention Required
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {attentionItems.map((item) => (
              <AttentionStatCard key={item.label} {...item} />
            ))}
          </div>
        </section>
      )}

      {/* All clear state */}
      {attentionItems.length === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-green-500/35 bg-green-950/30 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
          <span className="text-sm text-green-300">
            Everything looks good — no items need attention right now.
          </span>
        </div>
      )}

      {/* ── OPEN FAILED MILESTONE REVIEWS ─────────────────── */}
      {failedMilestoneAttempts.length > 0 ? (
        <section className="rounded-xl border border-red-500/50 bg-red-950/35 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-300" aria-hidden />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-red-200">
                Open failed milestone reviews
              </h2>
            </div>
            <Link
              href={`${base}/mentoring/assignments`}
              className="shrink-0 text-xs text-slate-400 transition hover:text-slate-200"
            >
              Open assignments →
            </Link>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-slate-500">
            Failed attempts with an open admin review on active assignments (mentors in this tenant). Use assignment ID
            to locate the row on Assignments; mentors and mentees view details in the pilot portal.
          </p>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-700/60 text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3">Mentee</th>
                  <th className="py-2 pr-3">Mentor</th>
                  <th className="py-2 pr-3">Milestone</th>
                  <th className="py-2 pr-3">Failed date</th>
                  <th className="py-2 pr-3">Note</th>
                  <th className="py-2 pl-2 text-right">Assignment ID</th>
                  <th className="py-2 pl-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {failedMilestoneAttempts.map((row) => (
                  <tr key={row.attempt_id} className="text-slate-200">
                    <td className="max-w-[160px] truncate py-2.5 pr-3 align-top" title={row.mentee_display_name ?? undefined}>
                      {row.mentee_display_name?.trim() || "—"}
                    </td>
                    <td className="max-w-[160px] truncate py-2.5 pr-3 align-top" title={row.mentor_display_name ?? undefined}>
                      {row.mentor_display_name?.trim() || "—"}
                    </td>
                    <td className="max-w-[200px] py-2.5 pr-3 align-top text-slate-300">
                      <span className="line-clamp-2" title={formatMilestoneTypeLabel(row.milestone_type)}>
                        {formatMilestoneTypeLabel(row.milestone_type)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-3 align-top tabular-nums text-slate-300">
                      {formatAttemptYmd(row.occurred_on)}
                    </td>
                    <td className="max-w-[220px] py-2.5 pr-3 align-top text-slate-400">
                      {row.note?.trim() ? (
                        <span className="line-clamp-3" title={row.note}>
                          {row.note}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pl-2 text-right align-top">
                      <Link
                        href={`/${tenant}/${portal}/portal/mentoring/${row.assignment_id}`}
                        title="Open assignment in pilot portal"
                        className="inline-block max-w-full break-all text-[11px] text-slate-400 underline-offset-2 transition hover:text-slate-200 hover:underline"
                      >
                        <code className="break-all text-[11px] text-inherit">{row.assignment_id}</code>
                      </Link>
                    </td>
                    <td className="py-2.5 pl-2 align-top">
                      <FailedMilestoneReviewRowActions attemptId={row.attempt_id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* ── PROGRAM SNAPSHOT ───────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
          Program Snapshot
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatPill
            label="Active mentors"
            value={overview.mentors}
            sub={inactiveCount > 0 ? `${inactiveCount} inactive 30d+` : undefined}
          />
          <StatPill label="Active mentees" value={overview.activeMentees} />
          <StatPill
            label="Live in portal"
            value={overview.liveMentees}
            sub="completed onboarding"
          />
          <StatPill
            label="Unmatched"
            value={overview.unmatchedMentees}
            sub="awaiting mentor"
          />
        </div>
      </section>

      {/* ── MENTOR ACTIVITY ────────────────────────────────── */}
      {mentorEnabled && mentorActivity.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                Mentor Activity
              </h2>
            </div>
            <Link
              href={`${base}/mentoring`}
              className="text-xs text-slate-400 hover:text-slate-200 transition"
            >
              View all →
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-700/50 bg-slate-800/45 px-4 divide-y divide-slate-700/50">
            {mentorActivity.slice(0, 10).map((row) => (
              <MentorActivityRow key={row.mentor_user_id} row={row} />
            ))}
          </div>

          {mentorActivity.length > 10 && (
            <p className="text-xs text-slate-500 text-right">
              +{mentorActivity.length - 10} more mentors —{" "}
              <Link href={`${base}/mentoring`} className="text-slate-400 hover:text-slate-300 transition">
                view all
              </Link>
            </p>
          )}
        </section>
      )}

      {/* ── QUICK ACTIONS ──────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
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
              className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3 transition hover:border-slate-600/60 hover:bg-slate-800/65 group"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-700/55 text-slate-300 group-hover:text-slate-100 transition">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-200">{label}</div>
                <div className="text-xs text-slate-400 truncate">{sub}</div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-300 transition ml-auto shrink-0" />
            </Link>
          ))}
        </div>
      </section>

      {/* ── ENTERPRISE PROGRAMS ────────────────────────────── */}
      {/* Only shown when Super Admin explicitly enables the upsell flag */}
      {featureEnabled(tenantFeatures, "show_enterprise_programs") && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-slate-600" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Enterprise Programs
            </h2>
            <span className="rounded-full border border-slate-600/40 bg-slate-800/50 px-2 py-0.5 text-[11px] text-slate-400">
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
        <span>Live data · refreshes on page load</span>
      </div>
    </div>
  );
}
