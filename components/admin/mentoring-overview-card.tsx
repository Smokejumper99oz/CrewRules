import Link from "next/link";
import type { MentoringOverviewStats } from "@/lib/mentoring/admin-overview-stats";
import { GraduationCap } from "lucide-react";

const cardBase =
  "group block rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400/25 hover:shadow-[0_10px_30px_rgba(0,0,0,0.35)]";

type Props = {
  stats: MentoringOverviewStats;
  manageHref: string;
  /** e.g. "Platform-wide" / "Frontier · Pilots" */
  subtitle?: string;
  manageCta?: string;
};

export function MentoringOverviewCard({
  stats,
  manageHref,
  subtitle,
  manageCta = "Manage users →",
}: Props) {
  return (
    <Link href={manageHref} className={cardBase}>
      <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <GraduationCap className="size-4 text-cyan-400/90 shrink-0" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-200">Mentoring overview</h2>
            {subtitle ? <p className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</p> : null}
          </div>
        </div>
        <span className="text-[11px] text-slate-500 shrink-0 group-hover:text-[#75C043]">
          {manageCta}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat label="Mentors" value={stats.mentors} />
        <Stat label="Active mentees" value={stats.activeMentees} />
        <Stat label="Unmatched mentees" value={stats.unmatchedMentees} warn={stats.unmatchedMentees > 0} />
        <Stat
          label="Missing mentor contact"
          value={stats.missingMentorContact}
          warn={stats.missingMentorContact > 0}
        />
      </div>
      <p className="mt-3 text-[11px] text-slate-500 leading-snug">
        Unmatched = assignment with no linked portal user yet. Missing contact = mentor profile has no phone or mentor
        email for the mentee card. Open Users to update.
      </p>
    </Link>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-slate-500 leading-tight">{label}</div>
      <div
        className={`text-xl font-semibold tabular-nums ${warn ? "text-amber-300/95" : "text-slate-100"}`}
      >
        {value}
      </div>
    </div>
  );
}
