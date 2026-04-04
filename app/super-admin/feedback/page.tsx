import { gateSuperAdmin } from "@/lib/super-admin/gate";
import { getFeedbackSubmissionsForSuperAdmin } from "@/lib/super-admin/actions";
import { SuperAdminFeedbackTable } from "@/components/super-admin/super-admin-feedback-table";

export const dynamic = "force-dynamic";

export default async function SuperAdminFeedbackPage() {
  await gateSuperAdmin();
  const rows = await getFeedbackSubmissionsForSuperAdmin();

  return (
    <div className="-mt-6 space-y-2 sm:-mt-8">
      <SuperAdminFeedbackTable rows={rows} />
    </div>
  );
}
