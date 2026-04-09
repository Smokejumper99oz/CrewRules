import { loadFrontierMentoringEmailCenterPageData } from "@/lib/mentoring/frontier-mentoring-email-center-load";
import { MentoringEmailCenterTable } from "./mentoring-email-center-table";

export const dynamic = "force-dynamic";

export default async function FrontierPilotAdminMentoringEmailCenterPage() {
  const collectDohAudit = process.env.MENTEE_ROSTER_DOH_AUDIT === "1";
  const { roster, counts } = await loadFrontierMentoringEmailCenterPageData({
    collectDohAudit,
    emitDohAuditToConsole: collectDohAudit,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight border-b border-white/5 pb-3">Mentoring Email Center</h1>
        <p className="mt-2 text-sm text-slate-400">
          Review mentor and mentee email readiness before sending notifications.
        </p>
        <p className="mt-1.5 text-xs text-slate-500">
          Same roster as Mentee Roster: {counts.live} live · {counts.not_live} not live · {counts.unassigned} unassigned
        </p>
      </div>

      {roster.length === 0 ? (
        <p className="text-sm text-slate-500">No roster rows yet.</p>
      ) : (
        <MentoringEmailCenterTable roster={roster} />
      )}
    </div>
  );
}
