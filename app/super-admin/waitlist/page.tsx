import { gateSuperAdmin } from "@/lib/super-admin/gate";
import { fetchWaitlistEntries } from "@/lib/waitlist/fetch-waitlist-entries";
import { WaitlistAdminPanel } from "@/components/waitlist/waitlist-admin-panel";

export default async function SuperAdminWaitlistPage() {
  await gateSuperAdmin();
  const { entries, error } = await fetchWaitlistEntries();

  return (
    <div className="-mt-6 space-y-2 sm:-mt-8">
      <WaitlistAdminPanel entries={entries} error={error} showPageHeading={false} />
    </div>
  );
}
