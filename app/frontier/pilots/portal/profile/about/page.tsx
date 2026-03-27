import type { ReactNode } from "react";
import { getProfile, getDisplayName, getSubscriptionDisplayType } from "@/lib/profile";
import { getAccountRoleBadges } from "@/lib/account-role-display";
import { getTenantPortalConfig } from "@/lib/tenant-config";
import packageJson from "../../../../../../package.json";
import { AboutDeviceSection } from "./about-device-section";

export default async function AboutPage() {
  const profile = await getProfile();
  const subscriptionType = getSubscriptionDisplayType(profile);
  const displayName = getDisplayName(profile ?? null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
    : null;

  const tenantConfig = getTenantPortalConfig(profile?.tenant ?? "frontier", profile?.portal ?? "pilots");
  const airlineDisplayName = tenantConfig?.tenant.displayName ?? profile?.tenant ?? "—";

  const deploymentDisplay = (() => {
    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) {
      const match = vercelUrl.match(/-([a-zA-Z0-9]{9})(?=-|\.vercel\.app)/);
      if (match) return match[1];
    }
    const deploymentId = process.env.VERCEL_DEPLOYMENT_ID;
    return deploymentId ? deploymentId.slice(-8) : "—";
  })();
  const deploymentShort = deploymentDisplay;

  const buildDisplay = (() => {
    const customId = process.env.NEXT_BUILD_ID;
    if (customId) return customId;
    const sha = process.env.VERCEL_GIT_COMMIT_SHA;
    if (sha) return sha.slice(0, 7);
    return "—";
  })();

  const buildDateDisplay = (() => {
    const manual = process.env.NEXT_BUILD_DATE;
    if (manual) return manual;
    const ts = process.env.VERCEL_GIT_COMMIT_TIMESTAMP;
    if (!ts) return "—";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "—";
    const iso = d.toISOString();
    return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
  })();

  return (
    <div className="max-w-2xl">
      <div className="space-y-6">
        {/* A) SOFTWARE INFORMATION */}
        <section>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950/40">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">
              A) Software Information
            </h2>
            <dl className="space-y-0 divide-y divide-slate-200 dark:divide-white/5">
              <AboutRow label="Application Name" value="CrewRules™" />
              <AboutRow label="Version" value={packageJson.version ?? "—"} />
              <AboutRow label="Build" value={buildDisplay} />
              <AboutRow label="Build Date" value={buildDateDisplay} />
              <AboutRow label="Environment" value={process.env.NODE_ENV ?? "—"} />
              <AboutRow label="Deployment" value={deploymentShort} />
              <AboutRow label="API Base URL" value={apiBaseUrl ?? "—"} />
              <AboutRow label="License" value="Proprietary" />
              <AboutRow label="System Status" value="Operational" />
            </dl>
          </div>
        </section>

        {/* B) ACCOUNT & ACCESS */}
        <section>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950/40">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">
              B) Account & Access
            </h2>
            <dl className="space-y-0 divide-y divide-slate-200 dark:divide-white/5">
              <AboutRow label="Logged-in User" value={displayName || "—"} />
              <AboutRow
                label="Role"
                value={
                  profile ? (
                    <AboutRoleBadgeRow
                      role={profile.role}
                      is_admin={profile.is_admin}
                      is_mentor={profile.is_mentor}
                    />
                  ) : (
                    "—"
                  )
                }
              />
              <AboutRow label="Employee ID" value={profile?.employee_number ?? "—"} />
              <AboutRow label="Airline / Tenant" value={airlineDisplayName} />
              <AboutRow label="Subscription Type" value={subscriptionType} />
            </dl>
          </div>
        </section>

        {/* C) DEVICE & BROWSER */}
        <section>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-950/40">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">
              C) Device & Browser
            </h2>
            <AboutDeviceSection />
          </div>
        </section>
      </div>
    </div>
  );
}

function AboutRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-3 first:pt-0">
      <dt className="text-sm text-slate-400 shrink-0">{label}</dt>
      <dd className="text-sm text-slate-200 text-right break-all">{value}</dd>
    </div>
  );
}

function AboutRoleBadgeRow({
  role,
  is_admin,
  is_mentor,
}: {
  role: string;
  is_admin?: boolean | null;
  is_mentor?: boolean | null;
}) {
  const { baseLabel, badges } = getAccountRoleBadges({
    role,
    is_admin,
    is_mentor,
  });
  const isPlatformOwner = role === "super_admin";

  return (
    <span className="inline-flex max-w-full flex-wrap items-center justify-end gap-1.5">
      {isPlatformOwner ? (
        <span className="inline-flex rounded-md border border-amber-400/40 bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
          {baseLabel}
        </span>
      ) : (
        <>
          <span className="inline-flex rounded-md border border-slate-400/40 bg-slate-500/20 px-2 py-0.5 text-xs font-semibold text-slate-200">
            {baseLabel}
          </span>
          {badges.map((b) =>
            b === "Admin" ? (
              <span
                key="admin"
                className="inline-flex rounded-md border border-emerald-400/40 bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300"
              >
                Admin
              </span>
            ) : (
              <span
                key="mentor"
                className="inline-flex rounded-md border border-cyan-400/40 bg-cyan-500/20 px-2 py-0.5 text-xs font-semibold text-cyan-200"
              >
                Mentor
              </span>
            )
          )}
        </>
      )}
    </span>
  );
}
