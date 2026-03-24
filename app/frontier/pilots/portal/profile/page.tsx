import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isProActive, getPlanBadgeLabel, getPlanBadgeVariant } from "@/lib/profile";
import { ProfileForm } from "@/components/profile-form";
import { CheckoutStatusBanner } from "@/components/checkout-status-banner";
import { getInboundEmailForDisplay } from "@/lib/email/get-inbound-email-for-display";
import { getScheduleImportStatus } from "@/app/frontier/pilots/portal/schedule/actions";

export default async function ProfilePage() {
  const profile = await getProfile();

  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_founding_pilot", true);
  const foundingPilotCount = count ?? 0;
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

  return (
    <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20 p-6">
      <Suspense fallback={null}>
        <CheckoutStatusBanner />
      </Suspense>
      {profile ? (
        <>
          <ProfileForm profile={profile} proActive={isProActive(profile)} proBadgeLabel={planBadgeLabel} proBadgeVariant={planBadgeVariant} foundingPilotCount={foundingPilotCount} inboundEmail={inboundEmail} scheduleStatus={scheduleStatus} />
        </>
      ) : (
        <p className="text-sm text-slate-500">Sign in to manage your profile.</p>
      )}
    </div>
  );
}
