import { CommuteAssistSettingsForm } from "@/components/commute-assist-settings-form";
import { getProfile, isProActive } from "@/lib/profile";

export default async function CommuteAssistSettingsPage() {
  const profile = await getProfile();

  if (!profile) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Sign in to manage Commute{" "}
        <span className="text-[#75C043]">Assist</span>
        <span className="align-super text-[10px]">™</span> settings.
      </p>
    );
  }

  return <CommuteAssistSettingsForm profile={profile} proActive={isProActive(profile)} />;
}
