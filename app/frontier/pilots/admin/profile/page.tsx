import { getProfile, getDisplayName } from "@/lib/profile";
import { formatUsPhoneStored } from "@/lib/format-us-phone";
import { AccountSettingsForm } from "@/components/account-settings-form";
import { AdminProfileBasicsForm } from "./admin-profile-basics-form";

export default async function AdminProfilePage() {
  const profile = await getProfile();

  if (!profile) {
    return <p className="text-sm text-slate-400">Sign in to manage your account.</p>;
  }

  const fullNameDefault =
    profile.full_name?.trim() || getDisplayName(profile);
  const phoneDisplayDefault = formatUsPhoneStored(profile.phone) ?? "";

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-6 transition-all duration-200">
        <h1 className="text-xl font-semibold tracking-tight border-b border-white/5 pb-2 text-white">
          Your account
        </h1>
        <p className="mt-3 text-sm text-slate-300">
          Sign-in, security, and account-level controls for <strong className="font-medium text-slate-200">your</strong>{" "}
          CrewRules admin user. Tenant-wide options (FLICA onboarding, pay scale seeding, etc.) are under{" "}
          <span className="text-slate-200">Settings</span>.
        </p>
      </div>

      <AdminProfileBasicsForm
        key={profile.updated_at}
        fullNameDefault={fullNameDefault}
        phoneDisplayDefault={phoneDisplayDefault}
      />

      <AccountSettingsForm
        email={profile.email}
        isAccountDeletionScheduled={
          profile.deletion_scheduled_for != null || profile.deleted_at != null
        }
        deletionScheduledFor={profile.deletion_scheduled_for ?? null}
        deletionReasonScheduled={profile.deletion_reason ?? null}
      />
    </div>
  );
}
