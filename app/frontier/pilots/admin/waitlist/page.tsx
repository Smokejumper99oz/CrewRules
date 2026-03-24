import { redirect } from "next/navigation";
import { getProfile } from "@/lib/profile";
import { fetchWaitlistEntries } from "@/lib/waitlist/fetch-waitlist-entries";
import { WaitlistAdminPanel } from "@/components/waitlist/waitlist-admin-panel";

export default async function AdminWaitlistPage() {
  const profile = await getProfile();
  if (profile?.role !== "super_admin") {
    redirect("/frontier/pilots/admin");
  }

  const { entries, error } = await fetchWaitlistEntries();

  return <WaitlistAdminPanel entries={entries} error={error} showPageHeading />;
}
