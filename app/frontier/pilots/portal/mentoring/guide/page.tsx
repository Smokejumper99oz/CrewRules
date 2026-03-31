import Link from "next/link";

const guideLinkClass =
  "text-sm font-medium text-[#75C043] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75C043]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

const sectionEyebrowClass =
  "mb-1 text-[11px] uppercase tracking-wide text-slate-500";

export default function PilotPortalMentoringGuidePage() {
  return (
    <div className="rounded-3xl border border-white/5 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Mentoring Guide</h1>
        <p className="mt-2 text-sm text-slate-400">
          Everything you need to understand and use CrewRules mentoring tools effectively.
        </p>
      </div>
      <div className="mt-6 space-y-5">
        <section className="rounded-2xl border border-white/5 bg-slate-950/40 p-5">
          <div>
            <p className={sectionEyebrowClass}>Mentor tools</p>
            <h2 className="text-lg font-semibold text-white">For Mentors</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            CrewRules mentoring tools help you stay organized and proactive while supporting your
            mentees. Use the portal to see progress at a glance and keep touchpoints on track.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-slate-400">
            <li>Track mentee progress and milestones</li>
            <li>Log and review check-ins</li>
            <li>Stay ahead of important training events</li>
            <li>Keep communication organized</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
            <Link href="/frontier/pilots/portal/mentoring" className={guideLinkClass}>
              View My Mentees
            </Link>
            <Link href="/frontier/pilots/portal/mentoring/profile" className={guideLinkClass}>
              Open Mentor Profile
            </Link>
          </div>
        </section>
        <section className="rounded-2xl border border-white/5 bg-slate-950/40 p-5">
          <div>
            <p className={sectionEyebrowClass}>Mentee tools</p>
            <h2 className="text-lg font-semibold text-white">For Mentees</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Your mentoring experience is clearer when you know what is coming next. CrewRules
            surfaces milestones and context so you and your mentor stay aligned.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-slate-400">
            <li>Understand your mentoring timeline</li>
            <li>Track milestones and key events</li>
            <li>Stay connected with your mentor</li>
            <li>Know what to expect at each stage</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
            <Link href="/frontier/pilots/portal/mentoring" className={guideLinkClass}>
              View My Mentor
            </Link>
          </div>
        </section>
        <section className="rounded-2xl border border-white/5 bg-slate-950/40 p-5">
          <div>
            <p className={sectionEyebrowClass}>Admin tools</p>
            <h2 className="text-lg font-semibold text-white">For Admins</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Administrators can steer program health from pairing through participation. CrewRules
            supports operational oversight without replacing the relationship between mentors and
            mentees.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-slate-400">
            <li>Assign and manage mentor/mentee relationships</li>
            <li>Upload resources and guidance</li>
            <li>Monitor mentoring engagement</li>
            <li>Support mentor and mentee success</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
            <Link href="/frontier/pilots/admin/mentoring" className={guideLinkClass}>
              Open Admin Mentoring
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
