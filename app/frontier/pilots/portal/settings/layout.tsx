import type { ReactNode } from "react";
import { Suspense } from "react";
import { PortalSettingsShell } from "@/components/portal-settings-shell";
import { CheckoutStatusBanner } from "@/components/checkout-status-banner";
import {
  getProfile,
  getCommunitySettingsTabLabel,
  shouldShowCommunityMentoringSettings,
} from "@/lib/profile";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const profile = await getProfile();
  const communityTabLabel = getCommunitySettingsTabLabel(profile);
  const showCommunityMentoring = shouldShowCommunityMentoringSettings(profile);

  return (
    <PortalSettingsShell
      communityTabLabel={communityTabLabel}
      shouldShowCommunityMentoringSettings={showCommunityMentoring}
    >
      <Suspense fallback={null}>
        <CheckoutStatusBanner />
      </Suspense>
      {children}
    </PortalSettingsShell>
  );
}
