import { getProfile } from "@/lib/profile";
import { ConnectFlicaSection } from "@/components/connect-flica-section";
import { getInboundEmailForDisplay } from "@/lib/email/get-inbound-email-for-display";
import { getScheduleImportStatus } from "@/app/frontier/pilots/portal/schedule/actions";
import { getTenantSetting } from "@/lib/tenant-settings";
import { PortalSettingsPlaceholder } from "@/components/portal-settings-placeholder";

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

export default async function ScheduleImportSettingsPage() {
  const profile = await getProfile();

  if (!profile) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">Sign in to manage schedule import.</p>
    );
  }

  let inboundEmail: string | null = null;
  let scheduleStatus: { count: number; lastImportedAt: string | null } = { count: 0, lastImportedAt: null };
  try {
    inboundEmail = await getInboundEmailForDisplay(profile.id);
  } catch (err) {
    console.warn("[ScheduleImport] getInboundEmailForDisplay failed:", err);
  }
  try {
    const s = await getScheduleImportStatus();
    scheduleStatus = { count: s.count, lastImportedAt: s.lastImportedAt };
  } catch (err) {
    console.warn("[ScheduleImport] getScheduleImportStatus failed:", err);
  }

  const rawFlag = await getTenantSetting<unknown>(TENANT, PORTAL, "show_connect_flica_onboarding");
  const showConnectFlicaOnboarding = showConnectFlicaOnboardingFromSetting(rawFlag);

  if (!showConnectFlicaOnboarding) {
    return (
      <PortalSettingsPlaceholder
        title="FLICA"
        description="Connections and options for bringing your schedule into CrewRules™."
      />
    );
  }

  return <ConnectFlicaSection inboundEmail={inboundEmail} scheduleStatus={scheduleStatus} />;
}
