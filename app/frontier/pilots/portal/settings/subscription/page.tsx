import {
  getProfile,
  getPlanBadgeLabel,
  getPlanBadgeVariant,
  getSubscriptionDisplayType,
  getActiveProTrialDaysRemaining,
  isEligibleForProTrialStartCta,
  isProActive,
} from "@/lib/profile";
import { getFoundingPilotCount } from "@/lib/founding-pilot-count";
import { SubscriptionSettingsPanel } from "@/components/subscription-settings-panel";

export default async function SubscriptionSettingsPage() {
  const profile = await getProfile();

  if (!profile) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">Sign in to manage your subscription.</p>
    );
  }

  const foundingPilotCount = await getFoundingPilotCount();

  return (
    <>
      <SubscriptionSettingsPanel
        profile={profile}
        proActive={isProActive(profile)}
        proBadgeLabel={getPlanBadgeLabel(profile)}
        proBadgeVariant={getPlanBadgeVariant(profile)}
        foundingPilotCount={foundingPilotCount}
        planDisplayType={getSubscriptionDisplayType(profile)}
        trialDaysRemaining={getActiveProTrialDaysRemaining(profile)}
        showProTrialStartCta={isEligibleForProTrialStartCta(profile)}
      />
    </>
  );
}
