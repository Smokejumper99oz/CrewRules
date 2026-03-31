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
            You manage your mentee&apos;s progress. Keep milestones accurate and use updates to
            stay ahead of changes.
          </p>
          <ul className="mt-3 list-disc space-y-3 pl-4 text-sm leading-relaxed text-slate-400">
            <li>
              <span className="font-medium text-slate-300">Manage the timeline</span>
              <span className="mt-1 block">
                Each milestone reflects your mentee&apos;s progress (Type Rating, IOE, etc.). Keep
                these accurate.
              </span>
            </li>
            <li>
              <span className="font-medium text-slate-300">Mark Complete (your responsibility)</span>
              <span className="mt-1 block">
                Mark a milestone complete when your mentee finishes that step. This updates the
                timeline and moves them forward.
              </span>
            </li>
            <li>
              <span className="font-medium text-slate-300">Adjust when things change</span>
              <span className="mt-1 block">
                If training shifts (delays, early completion), update the timeline so it stays
                correct.
              </span>
            </li>
            <li>
              <span className="font-medium text-slate-300">Use notes for context</span>
              <span className="mt-1 block">
                Add short notes like:
              </span>
              <span className="mt-1 block pl-3 italic text-slate-500">
                &ldquo;Type Rating moved due sim availability&rdquo;
              </span>
              <span className="mt-0.5 block pl-3 italic text-slate-500">
                &ldquo;IOE completed early&rdquo;
              </span>
            </li>
            <li>
              <span className="font-medium text-slate-300">Stay ahead of milestones</span>
              <span className="mt-1 block">
                Use the timeline to anticipate upcoming events and check in before issues arise.
              </span>
            </li>
          </ul>
        </section>
        <section className="rounded-2xl border border-white/5 bg-slate-950/40 p-5">
          <div>
            <p className={sectionEyebrowClass}>Overview</p>
            <h2 className="text-lg font-semibold text-white">Your Guide</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Your mentoring timeline shows where you are and what&apos;s coming next. Your mentor
            updates milestones — you keep them informed.
          </p>
          <div className="mt-5 space-y-5 text-sm leading-relaxed text-slate-400">
            <div>
              <p className="font-medium text-slate-300">🔹 Understand your timeline</p>
              <p className="mt-2">Each milestone is a key step in your training:</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Type Rating</li>
                <li>IOE Complete</li>
                <li>3 Months On Line</li>
              </ul>
              <p className="mt-2 text-slate-300">
                👉 Use this to stay aware of what&apos;s next.
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-300">🔹 Your role</p>
              <p className="mt-2">You do not update milestones.</p>
              <p>Your mentor marks progress.</p>
              <p className="mt-2 text-slate-300">
                👉 Your job is to keep your mentor informed
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-300">🔹 Add updates when things change</p>
              <p className="mt-2">Use updates when your schedule shifts:</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Type Rating moved</li>
                <li>IOE start date changed</li>
                <li>Finished earlier than planned</li>
              </ul>
              <p className="mt-2 text-slate-300">👉 This keeps your timeline accurate.</p>
            </div>
            <div>
              <p className="font-medium text-slate-300">🔹 Why updates matter</p>
              <p className="mt-2">If you don&apos;t update:</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Your mentor sees outdated info</li>
                <li>Check-ins may be off</li>
                <li>Expectations get misaligned</li>
              </ul>
              <p className="mt-2 text-slate-300">👉 Quick updates = smoother training</p>
            </div>
            <div>
              <p className="font-medium text-slate-300">🔹 Stay ahead</p>
              <p className="mt-2">
                Check your timeline regularly and update your mentor early when something changes.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
