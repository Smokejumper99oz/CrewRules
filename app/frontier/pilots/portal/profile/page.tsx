import { getProfile } from "@/lib/profile";
import { ProfileForm } from "@/components/profile-form";

export default async function ProfilePage() {
  const profile = await getProfile();

  return (
    <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20 p-6">
      <h1 className="text-xl font-semibold tracking-tight border-b border-white/5 pb-4">Profile</h1>
      <p className="mt-2 text-sm text-slate-400">
        Identity, base, subscription, and display preferences.
      </p>

      <div className="mt-6">
        {profile ? (
          <ProfileForm profile={profile} />
        ) : (
          <p className="text-sm text-slate-500">Sign in to manage your profile.</p>
        )}
      </div>
    </div>
  );
}
