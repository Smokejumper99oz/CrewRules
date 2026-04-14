import Link from "next/link";
import type { MentoringOverviewStats } from "@/lib/mentoring/admin-overview-stats";
import { GraduationCap } from "lucide-react";

const cardInteractive =
  "group block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#75C043]/40 hover:shadow-md";

const cardFlat = "block rounded-xl border border-slate-200 bg-white p-4 shadow-sm";

type Props = {
  stats: MentoringOverviewStats;
  manageHref: string;
  /** e.g. "Platform-wide" / "Frontier Airlines • Pilots" */
  subtitle?: string;
  manageCta?: string;
  /** When true, no lift/shadow/border hover or group-hover accents (e.g. tenant admin dashboard). */
  disableHover?: boolean;
};

export function MentoringOverviewCard({
  stats,
  manageHref,
  subtitle,
  manageCta = "Manage users →",
  disableHover = false,
}: Props) {
  const hasOpenProgramRequests = stats.openMentorshipProgramRequests > 0;

  const ctaClass = disableHover
    ? "text-[11px] text-slate-500 shrink-0"
    : "text-[11px] text-slate-500 shrink-0 group-hover:text-[#75C043]";

  const requestsPillClass = hasOpenProgramRequests
    ? disableHover
      ? "inline-flex w-fit items-center rounded-md border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-[11px] font-semibold text-amber-300/95 shadow-[0_0_0_1px_rgba(245,158,11,0.08)]"
      : "inline-flex w-fit items-center rounded-md border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-[11px] font-semibold text-amber-300/95 shadow-[0_0_0_1px_rgba(245,158,11,0.08)] transition-colors group-hover:border-amber-400/45 group-hover:bg-amber-500/25 group-hover:text-amber-200"
    : disableHover
      ? "inline-flex w-fit items-center rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm"
      : "inline-flex w-fit items-center rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition-colors group-hover:border-[#75C043]/40 group-hover:bg-white group-hover:text-[#75C043]";

  return (
    <Link href={manageHref} className={disableHover ? cardFlat : cardInteractive}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <GraduationCap className="size-4 text-cyan-600 shrink-0" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#1a2b4b]">Mentoring Overview</h2>
            {subtitle ? <p className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</p> : null}
          </div>
        </div>
        <span className={ctaClass}>{manageCta}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 sm:gap-4">
        <Stat label="Live Mentors" value={stats.mentors} />
        <Stat label="Staged Mentors" value={stats.stagedMentors} />
        <Stat label="Assigned Mentees" value={stats.activeMentees} />
        <Stat label="Live Mentees" value={stats.liveMentees} />
        <Stat label="Unmatched Mentees" value={stats.unmatchedMentees} warn={stats.unmatchedMentees > 0} />
        <Stat
          label="Missing Mentor Contacts"
          value={stats.missingMentorContact}
          warn={stats.missingMentorContact > 0}
        />
        <Stat
          label="Open Program Requests"
          value={stats.openMentorshipProgramRequests}
          warn={stats.openMentorshipProgramRequests > 0}
        />
      </div>
      <p className="mt-3 text-[11px] text-slate-500 leading-snug">
        Unmatched = assignment with no linked portal user yet. Missing contact = mentor profile has no phone or mentor
        email for the mentee card. Open Users to update.
      </p>
      <div className="mt-3">
        <span className={requestsPillClass}>View requests →</span>
      </div>
    </Link>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-slate-500 leading-tight">{label}</div>
      <div
        className={`text-xl font-semibold tabular-nums ${warn ? "text-amber-700" : "text-slate-900"}`}
      >
        {value}
      </div>
    </div>
  );
}
