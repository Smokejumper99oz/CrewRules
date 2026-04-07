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
import type { MentorActivityRow } from "@/lib/mentoring/mentor-activity";
import type { TenantFeature } from "@/lib/tenant-features";

type Props = {
  tenant: string;
  portal: string;
  overview: MentoringOverviewStats;
  mentorActivity: MentorActivityRow[];
  tenantFeatures: TenantFeature[];
};

function featureEnabled(features: TenantFeature[], key: string) {
  return features.find((f) => f.feature_key === key)?.enabled === true;
}

function AttentionItem({
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
  severity: "critical" | "warning" | "info";
}) {
  const colors = {
    critical: "bg-red-500/10 border-red-500/30 text-red-400",
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-400",
    info: "bg-blue-500/10 border-blue-500/30 text-blue-400",
  };
  const badgeColors = {
    critical: "bg-red-500/20 text-red-300",
    warning: "bg-amber-500/20 text-amber-300",
    info: "bg-blue-500/20 text-blue-300",
  };

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition hover:opacity-90 ${colors[severity]}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${badgeColors[severity]}`}>
        {count}
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
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
    <div className="flex flex-col gap-0.5 rounded-xl border border-white/5 bg-slate-900/50 px-4 py-3">
      <span className="text-xl font-light text-slate-100 tabular-nums">{value}</span>
      <span className="text-xs text-slate-400">{label}</span>
      {sub && <span className="text-[11px] text-slate-600">{sub}</span>}
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
  stale: { label: "30+ days ago", className: "bg-amber-500/10 text-amber-500" },
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
          {emp && <span className="text-xs text-slate-600 shrink-0">{emp}</span>}
        </div>
        <div className="text-xs text-slate-500">
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
    <div className="relative flex items-start gap-3 rounded-xl border border-white/5 bg-slate-900/30 px-4 py-4 opacity-60 select-none">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-700/50 text-slate-500">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-300">{label}</span>
          <Lock className="h-3 w-3 text-slate-600 shrink-0" />
        </div>
        <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{description}</p>
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
}: Props) {
  const base = `/${tenant}/${portal}/admin`;

  // Attention items (only show if count > 0)
  const attentionItems = [
    overview.unmatchedMentees > 0 && {
      icon: UserX,
      label: "Mentees waiting for a mentor match",
      count: overview.unmatchedMentees,
      href: `${base}/mentoring`,
      severity: "critical" as const,
    },
    overview.openMentorshipProgramRequests > 0 && {
      icon: ClipboardList,
      label: "Open mentorship program requests",
      count: overview.openMentorshipProgramRequests,
      href: `${base}/mentoring`,
      severity: "warning" as const,
    },
    overview.missingMentorContact > 0 && {
      icon: Phone,
      label: "Mentors missing contact information",
      count: overview.missingMentorContact,
      href: `${base}/mentoring`,
      severity: "warning" as const,
    },
    overview.stagedMentors > 0 && {
      icon: UserCheck,
      label: "Staged mentors not yet linked to a profile",
      count: overview.stagedMentors,
      href: `${base}/mentoring`,
      severity: "info" as const,
    },
  ].filter(Boolean) as React.ComponentProps<typeof AttentionItem>[];

  const mentorEnabled = featureEnabled(tenantFeatures, "mentoring");
  const inactiveCount = mentorActivity.filter(
    (r) => r.activity_tier === "stale" || r.activity_tier === "never"
  ).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Admin Dashboard</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Frontier Airlines · Pilots Program
        </p>
      </div>

      {/* ── ATTENTION REQUIRED ─────────────────────────────── */}
      {attentionItems.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Attention Required
            </h2>
          </div>
          <div className="space-y-2">
            {attentionItems.map((item) => (
              <AttentionItem key={item.label} {...item} />
            ))}
          </div>
        </section>
      )}

      {/* All clear state */}
      {attentionItems.length === 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-[#75C043]/20 bg-[#75C043]/5 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-[#75C043] shrink-0" />
          <span className="text-sm text-[#75C043]">
            Everything looks good — no items need attention right now.
          </span>
        </div>
      )}

      {/* ── PROGRAM SNAPSHOT ───────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
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
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Mentor Activity
              </h2>
            </div>
            <Link
              href={`${base}/mentoring`}
              className="text-xs text-slate-500 hover:text-slate-300 transition"
            >
              View all →
            </Link>
          </div>

          <div className="rounded-2xl border border-white/5 bg-slate-900/40 px-4 divide-y divide-white/5">
            {mentorActivity.slice(0, 10).map((row) => (
              <MentorActivityRow key={row.mentor_user_id} row={row} />
            ))}
          </div>

          {mentorActivity.length > 10 && (
            <p className="text-xs text-slate-600 text-right">
              +{mentorActivity.length - 10} more mentors —{" "}
              <Link href={`${base}/mentoring`} className="hover:text-slate-400 transition">
                view all
              </Link>
            </p>
          )}
        </section>
      )}

      {/* ── QUICK ACTIONS ──────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
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
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-900/30 px-4 py-3 transition hover:border-white/10 hover:bg-slate-900/60 group"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-700/50 text-slate-400 group-hover:text-slate-200 transition">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-slate-200">{label}</div>
                <div className="text-xs text-slate-500 truncate">{sub}</div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-400 transition ml-auto shrink-0" />
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
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Enterprise Programs
            </h2>
            <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-[11px] text-slate-500">
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

          <p className="text-xs text-slate-600 leading-relaxed">
            These features are part of the CrewRules™ Enterprise plan. Once enabled by the
            platform team, they appear here for your tenant automatically.
          </p>
        </section>
      )}

      {/* Connection status indicator */}
      <div className="flex items-center gap-1.5 text-xs text-slate-700">
        <Wifi className="h-3 w-3" />
        <span>Live data · refreshes on page load</span>
      </div>
    </div>
  );
}
