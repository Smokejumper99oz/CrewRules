import { loadFrontierMentoringEmailCenterPageData } from "@/lib/mentoring/frontier-mentoring-email-center-load";
import { getMentorEmailDetailRows } from "@/lib/mentoring/mentor-email-detail-rows";
import { MentoringEmailAcknowledgementDetailSection } from "./mentoring-email-acknowledgement-detail-section";
import { MentoringEmailCenterTable } from "./mentoring-email-center-table";

export const dynamic = "force-dynamic";

export default async function FrontierPilotAdminMentoringEmailCenterPage() {
  const collectDohAudit = process.env.MENTEE_ROSTER_DOH_AUDIT === "1";
  const [{ roster, counts }, emailAcknowledgementRows] = await Promise.all([
    loadFrontierMentoringEmailCenterPageData({
      collectDohAudit,
      emitDohAuditToConsole: collectDohAudit,
    }),
    getMentorEmailDetailRows(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight border-b border-slate-200 pb-3 text-[#1a2b4b]">Mentoring Email Center</h1>
        <p className="mt-2 text-sm text-slate-600">
          Review mentor and mentee email readiness before sending notifications.
        </p>
        <p className="mt-1.5 text-xs text-slate-600">
          Same roster as Mentee Roster: {counts.live} live · {counts.not_live} not live · {counts.unassigned} unassigned
        </p>
      </div>

      <section className="mt-6">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="rounded-t-xl bg-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold tracking-wide text-slate-900">Assignment Email Status</h2>
            <p className="mt-1 text-xs text-slate-500">
              Shows sent, opened, and pending mentor assignment emails.
            </p>
          </div>

          <div className="border-t border-slate-200" />

          <div className="p-4">
            <MentoringEmailAcknowledgementDetailSection rows={emailAcknowledgementRows} />
          </div>
        </div>
      </section>

      {roster.length === 0 ? (
        <p className="text-sm text-slate-500">No roster rows yet.</p>
      ) : (
        <MentoringEmailCenterTable roster={roster} />
      )}
    </div>
  );
}
