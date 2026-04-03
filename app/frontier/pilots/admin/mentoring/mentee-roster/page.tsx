import { MenteeRosterTable } from "../mentee-roster-table";
import { loadFrontierPilotMenteeRosterPageData } from "@/lib/mentoring/frontier-mentee-roster-load";

export const dynamic = "force-dynamic";

export default async function FrontierPilotAdminMentoringMenteeRosterPage() {
  const collectDohAudit = process.env.MENTEE_ROSTER_DOH_AUDIT === "1";
  const { roster, counts } = await loadFrontierPilotMenteeRosterPageData({
    collectDohAudit,
    emitDohAuditToConsole: collectDohAudit,
  });

  return (
    <div className="space-y-4 lg:space-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight border-b border-white/5 pb-3 lg:pb-2">Mentee Roster</h1>
        <p className="mt-2 text-sm text-slate-400 leading-snug lg:mt-1.5">
          Frontier Airlines first-year pilots and mentoring assignment rows. Left CRA shows mentee CrewRules activation.
          Right CRA shows mentor CrewRules activation. Staged mentors may appear without a live account.
        </p>
        <p className="mt-1.5 text-xs text-slate-500">
          Live = mentor and mentee are both active in CrewRules · Not Live = mentor assigned but one or both have not
          activated CrewRules yet · Unassigned = no mentor assigned · Left CRA shows mentee activation · Right CRA shows
          mentor activation
        </p>
      </div>

      {roster.length === 0 ? (
        <p className="text-sm text-slate-500">No roster rows yet.</p>
      ) : (
        <MenteeRosterTable roster={roster} counts={counts} />
      )}
    </div>
  );
}
