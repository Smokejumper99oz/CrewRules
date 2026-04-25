import Link from "next/link";
import { CrewrulesGuideShell } from "@/components/guides/crewrules-guide-shell";
import { GuideImage } from "@/components/guides/guide-image";
import { GuideStep } from "@/components/guides/guide-step";

export default function CommuteAssistAlertsGuidePage() {
  return (
    <div className="mx-auto max-w-3xl pb-8">
      <Link
        href="/frontier/pilots/portal/guides"
        className="mb-6 inline-block text-sm font-medium text-[#75C043] hover:underline"
      >
        ← All guides
      </Link>
      <CrewrulesGuideShell documentTitle="Commute Assist™ Alerts">
        <p className="text-sm text-slate-600">
          When your report time is approaching and CrewRules™ does not find a same-day commute option that fits your
          rules, we can email you so you can adjust your plan early.
        </p>
        <GuideStep step={1} title="CHOOSE WHERE ALERTS ARE SENT">
          <p>
            Open <strong>Settings → Commute Assist™</strong>. In <strong>Commute Assist™ Alert email</strong>, enter a
            personal address where you receive phone notifications. CrewRules™ sends commute alerts to this email first;
            if you leave it blank, alerts go to your account email.
          </p>
          <GuideImage
            src="/help/guides/commute-assist-alert-private-email-settings.png"
            alt="Commute Assist settings: Alert email section with personal email field"
          />
        </GuideStep>
        <GuideStep step={2} title="KEEP YOUR SCHEDULE CURRENT">
          <p>
            Alerts use your imported schedule and commute rules. Upload schedule updates regularly so conflict checks
            stay accurate.
          </p>
        </GuideStep>
        <GuideStep step={3} title="UNDERSTAND THE ALERT">
          <p>
            You will hear from us when no qualifying same-day commute is available by your configured report buffer.
            Use it as a heads-up to re-check commute options or adjust your plans.
          </p>
          <p className="text-sm text-slate-600">
            Below is an example of the CrewRules™ email: report time, flights we checked, and a clear next step (such as
            commuting the day before).
          </p>
          <GuideImage
            src="/help/guides/commute-assist-alert-email-example.png"
            alt="Example CrewRules Commute Assist alert email: same-day flights reviewed, arrival vs buffer, and recommended action"
          />
        </GuideStep>
        <GuideStep step={4} title="REVIEW YOUR DASHBOARD">
          <p>
            When no safe same-day commute is available, CrewRules™ highlights this directly on your Dashboard.
          </p>
          <p>You&apos;ll see:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>A clear warning: &ldquo;No safe same-day commute options&rdquo;</li>
            <li>Your report time and required arrival buffer</li>
            <li>The latest safe arrival time</li>
            <li>Flights that do not qualify — and why</li>
          </ul>
          <p>
            CrewRules™ shows exactly why each flight does not qualify — including arriving after your buffer and after
            report time.
          </p>
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-slate-800">
            <p className="font-medium text-slate-900">
              To be safe, you must arrive before your report time minus your buffer.
            </p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Example</p>
            <ul className="mt-2 space-y-1 font-normal normal-case text-slate-800">
              <li>
                <span className="text-slate-600">Report:</span> 14:19 Local
              </li>
              <li>
                <span className="text-slate-600">Buffer:</span> 1:00 hour
              </li>
              <li>
                <span className="text-slate-600">Latest safe arrival:</span> 13:19 Local
              </li>
            </ul>
          </div>
          <div className="mt-4">
            <GuideImage
              src="/help/guides/commute-assist-alert-dashboard-example.png"
              alt="Dashboard: Commute Assist warning when no same-day flights qualify, with report time, buffer, latest safe arrival, and per-flight reasons"
            />
            <p className="mt-2 text-center text-sm text-slate-600">
              Example: Dashboard showing why no flights qualify for a safe same-day commute
            </p>
          </div>
        </GuideStep>
      </CrewrulesGuideShell>
    </div>
  );
}
