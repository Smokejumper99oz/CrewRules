import { getProfile } from "@/lib/profile";
import { MentorContactSettingsForm } from "@/components/mentor-contact-settings-form";

export default async function CommunitySettingsPage() {
  const profile = await getProfile();

  if (!profile) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">Sign in to manage Community settings.</p>
    );
  }

  return <MentorContactSettingsForm profile={profile} />;
}
