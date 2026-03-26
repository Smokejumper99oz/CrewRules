import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isProActive, getPlanBadgeLabel, getPlanBadgeVariant } from "@/lib/profile";
import { ProfileForm } from "@/components/profile-form";
import { CheckoutStatusBanner } from "@/components/checkout-status-banner";
import { getInboundEmailForDisplay } from "@/lib/email/get-inbound-email-for-display";
import { getScheduleImportStatus } from "@/app/frontier/pilots/portal/schedule/actions";
import { getTenantSetting } from "@/lib/tenant-settings";
import { getFoundingPilotCount } from "@/lib/founding-pilot-count";

const TENANT = "frontier";
const PORTAL = "pilots";

function showConnectFlicaOnboardingFromSetting(raw: unknown): boolean {
  if (raw == null) return true;
  if (raw === false) return false;
  if (raw === true) return true;
  if (typeof raw === "object" && raw !== null && "enabled" in raw) {
    const e = (raw as { enabled: unknown }).enabled;
    if (e === false) return false;
    if (e === true) return true;
  }
  return true;
}

export default async function ProfilePage() {
  const profile = await getProfile();

  const supabase = await createClient();
  const foundingPilotCount = await getFoundingPilotCount(supabase);
  const planBadgeLabel = getPlanBadgeLabel(profile);
  const planBadgeVariant = getPlanBadgeVariant(profile);
  let inboundEmail: string | null = null;
  let scheduleStatus: { count: number; lastImportedAt: string | null } = { count: 0, lastImportedAt: null };
  if (profile) {
    try {
      inboundEmail = await getInboundEmailForDisplay(profile.id);
    } catch (err) {
      console.warn("[Profile] getInboundEmailForDisplay failed:", err);
    }
    try {
      const s = await getScheduleImportStatus();
      scheduleStatus = { count: s.count, lastImportedAt: s.lastImportedAt };
    } catch (err) {
      console.warn("[Profile] getScheduleImportStatus failed:", err);
    }
  }

  const rawFlag = await getTenantSetting<unknown>(TENANT, PORTAL, "show_connect_flica_onboarding");
  const showConnectFlicaOnboarding = showConnectFlicaOnboardingFromSetting(rawFlag);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-400/30 dark:border-white/5 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-900/60 dark:to-slate-950/80 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)] dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] dark:hover:border-emerald-400/20">
      <Suspense fallback={null}>
        <CheckoutStatusBanner />
      </Suspense>
      {profile ? (
        <>
          <ProfileForm
            profile={profile}
            proActive={isProActive(profile)}
            proBadgeLabel={planBadgeLabel}
            proBadgeVariant={planBadgeVariant}
            foundingPilotCount={foundingPilotCount}
            inboundEmail={inboundEmail}
            scheduleStatus={scheduleStatus}
            showConnectFlicaOnboarding={showConnectFlicaOnboarding}
          />
        </>
      ) : (
        <p className="text-sm text-slate-500">Sign in to manage your profile.</p>
      )}
    </div>
  );
}
