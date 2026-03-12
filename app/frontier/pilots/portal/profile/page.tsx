import { getProfile, isProActive, getPlanBadgeLabel, getPlanBadgeVariant } from "@/lib/profile";
import { ProfileForm } from "@/components/profile-form";
import { InboundEmailDisplay } from "@/components/inbound-email-display";
import { getOrCreateInboundAlias } from "@/lib/email/get-or-create-inbound-alias";
import { getInboundAddress } from "@/lib/email/get-inbound-address";

export default async function ProfilePage() {
  const profile = await getProfile();
  const planBadgeLabel = getPlanBadgeLabel(profile);
  const planBadgeVariant = getPlanBadgeVariant(profile);

  let inboundEmail: string | null = null;
  if (profile && isProActive(profile)) {
    try {
      const inboundAlias = await getOrCreateInboundAlias(profile.id);
      if (!inboundAlias.startsWith("u_")) {
        inboundEmail = getInboundAddress(inboundAlias);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? "n/a";
      const code = (err as { code?: string })?.code ?? "n/a";
      const details = (err as { details?: string })?.details ?? "n/a";
      console.error(`[Profile] inbound alias error: message=${msg} code=${code} details=${details}`);
      inboundEmail = null;
    }
  }

  return (
    <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20 p-6">
      {profile ? (
        <>
          <ProfileForm profile={profile} proActive={isProActive(profile)} proBadgeLabel={planBadgeLabel} proBadgeVariant={planBadgeVariant} />
          {inboundEmail && <InboundEmailDisplay email={inboundEmail} />}
        </>
      ) : (
        <p className="text-sm text-slate-500">Sign in to manage your profile.</p>
      )}
    </div>
  );
}
