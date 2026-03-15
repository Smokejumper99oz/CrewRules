import { createClient } from "@/lib/supabase/server";
import { getProfile, isProActive, getPlanBadgeLabel, getPlanBadgeVariant } from "@/lib/profile";
import { ProfileForm } from "@/components/profile-form";
import { InboundEmailDisplay } from "@/components/inbound-email-display";
import { getOrCreateInboundAlias } from "@/lib/email/get-or-create-inbound-alias";
import { getInboundAddress } from "@/lib/email/get-inbound-address";

type Props = {
  searchParams: Promise<{ upgrade?: string }>;
};

export default async function ProfilePage({ searchParams }: Props) {
  const profile = await getProfile();

  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_founding_pilot", true);
  const foundingPilotCount = count ?? 0;
  const planBadgeLabel = getPlanBadgeLabel(profile);
  const planBadgeVariant = getPlanBadgeVariant(profile);
  const params = await searchParams;
  const upgrade = params.upgrade;

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
      {upgrade === "success" && (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
          Your subscription is being activated.
        </div>
      )}
      {upgrade === "canceled" && (
        <div className="mb-4 rounded-lg border border-slate-600/40 bg-slate-800/50 px-4 py-3 text-sm text-slate-300">
          Checkout canceled.
        </div>
      )}
      {profile ? (
        <>
          <ProfileForm profile={profile} proActive={isProActive(profile)} proBadgeLabel={planBadgeLabel} proBadgeVariant={planBadgeVariant} foundingPilotCount={foundingPilotCount} />
          {inboundEmail && <InboundEmailDisplay email={inboundEmail} />}
        </>
      ) : (
        <p className="text-sm text-slate-500">Sign in to manage your profile.</p>
      )}
    </div>
  );
}
