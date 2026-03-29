import { getProfile, isProActive } from "@/lib/profile";
import { PayProjectionSettingsForm } from "@/components/pay-projection-settings-form";

export default async function PayProjectionSettingsPage() {
  const profile = await getProfile();

  if (!profile) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">Sign in to manage Pay Projection settings.</p>
    );
  }

  return <PayProjectionSettingsForm profile={profile} proActive={isProActive(profile)} />;
}
