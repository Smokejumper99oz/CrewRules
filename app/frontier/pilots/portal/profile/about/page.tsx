import { getProfile, getDisplayName, getSubscriptionDisplayType } from "@/lib/profile";
import { getTenantPortalConfig } from "@/lib/tenant-config";
import packageJson from "../../../../../../package.json";
import { AboutDeviceSection } from "./about-device-section";

export default async function AboutPage() {
  const profile = await getProfile();
  const subscriptionType = getSubscriptionDisplayType(profile);
  const displayName = getDisplayName(profile ?? null);

  const roleLabel =
    profile?.role === "super_admin"
      ? "Super Administrator"
      : profile?.role === "tenant_admin"
        ? "Administrator"
        : profile?.role === "flight_attendant"
          ? "Flight Attendant"
          : "Pilot";

  const apiBaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
    : null;

  const tenantConfig = getTenantPortalConfig(profile?.tenant ?? "frontier", profile?.portal ?? "pilots");
  const airlineDisplayName = tenantConfig?.tenant.displayName ?? profile?.tenant ?? "—";

  return (
    <div className="max-w-2xl">
      <div className="space-y-8">
        {/* A) SOFTWARE INFORMATION */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">
            A) Software Information
          </h2>
          <dl className="space-y-0 divide-y divide-white/5">
            <AboutRow label="Application Name" value="CrewRules™" />
            <AboutRow label="Version" value={packageJson.version ?? "—"} />
            <AboutRow label="Build" value={process.env.NEXT_BUILD_ID ?? "—"} />
            <AboutRow label="Build Date" value={process.env.NEXT_BUILD_DATE ?? "—"} />
            <AboutRow label="Environment" value={process.env.NODE_ENV ?? "—"} />
            <AboutRow label="API Base URL" value={apiBaseUrl ?? "—"} />
            <AboutRow label="License" value="Proprietary" />
            <AboutRow label="System Status" value="Operational" />
          </dl>
        </section>

        {/* B) ACCOUNT & ACCESS */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">
            B) Account & Access
          </h2>
          <dl className="space-y-0 divide-y divide-white/5">
            <AboutRow label="Logged-in User" value={displayName || "—"} />
            <AboutRow label="Role" value={roleLabel} />
            <AboutRow label="Employee ID" value={profile?.employee_number ?? "—"} />
            <AboutRow label="Airline / Tenant" value={airlineDisplayName} />
            <AboutRow label="Subscription Type" value={subscriptionType} />
          </dl>
        </section>

        {/* C) DEVICE & BROWSER */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">
            C) Device & Browser
          </h2>
          <AboutDeviceSection />
        </section>
      </div>
    </div>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-3 first:pt-0">
      <dt className="text-sm text-slate-400 shrink-0">{label}</dt>
      <dd className="text-sm text-slate-200 text-right break-all">{value}</dd>
    </div>
  );
}
