import { getProfile, isProActive } from "@/lib/profile";
import { PilotProfileSettingsForm } from "@/components/pilot-profile-settings-form";

export default async function PilotSettingsPage() {
  const profile = await getProfile();

  if (!profile) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">Sign in to manage your pilot profile.</p>
    );
  }

  return <PilotProfileSettingsForm profile={profile} proActive={isProActive(profile)} />;
}
