import { SuperAdminImportWarnings } from "@/components/super-admin/super-admin-import-warnings";
import { gateSuperAdmin } from "@/lib/super-admin/gate";
import {
  getMentoringMilestoneIntegritySignals,
  getRecentImportWarningsForSuperAdmin,
} from "@/lib/super-admin/actions";

const sectionCard = "rounded-xl border border-slate-700/50 bg-slate-800/50 p-4";

export default async function SuperAdminSystemHealthPage() {
  await gateSuperAdmin();

  const [importWarnings, mentoringIntegrity] = await Promise.all([
    getRecentImportWarningsForSuperAdmin(),
    getMentoringMilestoneIntegritySignals(),
  ]);

  const mentoringStatusCopy =
    mentoringIntegrity.hasAny ? (
      <>
        <p className="mt-2 text-sm text-amber-200/95">
          Mentoring milestone data needs attention: {mentoringIntegrity.hireDateMissingStandardMilestoneCount}{" "}
          assignment(s) missing standard milestones; {mentoringIntegrity.typeRatingWithoutOeCompleteCount} with Type
          Rating but no IOE Complete; {mentoringIntegrity.typeRatingWithoutOeMissingHireDateCount} of those lack a
          valid hire date (repair blocked until hire date is set).
        </p>
        <p className="mt-2 text-sm text-slate-400">
          Super Admin → Mentoring → use Generate missing milestones after fixing hire dates where needed.
        </p>
      </>
    ) : (
      <p className="mt-2 text-sm text-slate-300">All systems operational</p>
    );

  return (
    <div className="-mt-6 space-y-4 sm:-mt-8">
      <section className={sectionCard}>
        <h2 className="text-sm font-semibold text-slate-200">System Status</h2>
        {mentoringStatusCopy}
      </section>

      <SuperAdminImportWarnings warnings={importWarnings} />

      <section className={sectionCard}>
        <h2 className="text-sm font-semibold text-slate-200">System Events</h2>
        <p className="mt-3 text-sm text-slate-300">No issues detected</p>
        <p className="mt-1.5 text-sm leading-snug text-slate-500">
          Vercel, API, and platform alerts will appear here
        </p>
      </section>
    </div>
  );
}
