import { gateSuperAdmin } from "@/lib/super-admin/gate";
import { SuperAdminAccountDeletionFinalizeClient } from "@/components/super-admin/super-admin-account-deletion-finalize-client";

export const dynamic = "force-dynamic";

export default async function SuperAdminAccountDeletionFinalizePage() {
  await gateSuperAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">
          Test / Manual Finalize Account Deletion
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Super Admin only. One user at a time; eligibility is re-checked on the server before any delete.
        </p>
      </div>

      <SuperAdminAccountDeletionFinalizeClient />
    </div>
  );
}
