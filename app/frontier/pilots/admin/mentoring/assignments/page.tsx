import { createAdminClient } from "@/lib/supabase/admin";
import { PairingReviewAssignmentsTable } from "@/components/admin/pairing-review-assignments-table";
import { getMentoringAssignmentTableForTenant } from "@/lib/super-admin/mentoring-page-data";

export const dynamic = "force-dynamic";

const TENANT = "frontier";
const PORTAL = "pilots";

const emptyStateCard = "rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm";

export default async function FrontierPilotAdminMentoringAssignmentsPage() {
  const admin = createAdminClient();
  const rows = await getMentoringAssignmentTableForTenant(admin, { tenant: TENANT, portal: PORTAL });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight border-b border-slate-200 pb-3 text-[#1a2b4b]">Pairing Review</h1>
        <p className="mt-2 text-sm text-slate-600">
          Review mentor pairings for active CrewRules™ mentors, monitor onboarding for their mentees, and update DOH when
          needed.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className={emptyStateCard}>
          <h2 className="text-sm font-semibold text-slate-800">No mentoring assignments in this tenant</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Assignments appear when mentors in this tenant have mentoring records.
          </p>
        </div>
      ) : (
        <PairingReviewAssignmentsTable rows={rows} />
      )}
    </div>
  );
}
