import { getProfile } from "@/lib/profile";
import { AccountSettingsForm } from "@/components/account-settings-form";

export default async function AccountSettingsPage() {
  const profile = await getProfile();

  if (!profile) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">Sign in to manage your account.</p>
    );
  }

  return (
    <AccountSettingsForm
      email={profile.email}
      isAccountDeletionScheduled={
        profile.deletion_scheduled_for != null || profile.deleted_at != null
      }
      deletionScheduledFor={profile.deletion_scheduled_for ?? null}
      deletionReasonScheduled={profile.deletion_reason ?? null}
    />
  );
}
