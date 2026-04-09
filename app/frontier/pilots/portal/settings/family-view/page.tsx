import { getProfile, isProActive } from "@/lib/profile";
import { FamilyViewSettingsForm } from "@/components/family-view-settings-form";

function showInternalFamilyViewInvitesTest(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.CREWRULES_FAMILY_VIEW_INVITES_TEST === "1"
  );
}

export default async function FamilyViewSettingsPage() {
  const profile = await getProfile();

  if (!profile) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">Sign in to manage Family View settings.</p>
    );
  }

  return (
    <FamilyViewSettingsForm
      profile={profile}
      proActive={isProActive(profile)}
      showInternalInviteTestPanel={showInternalFamilyViewInvitesTest()}
    />
  );
}
