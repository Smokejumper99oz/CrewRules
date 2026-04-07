import { gateSuperAdmin } from "@/lib/super-admin/gate";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantFeatures } from "@/lib/tenant-features";
import { TenantFeatureToggle } from "@/components/super-admin/tenant-feature-toggle";
import {
  GraduationCap,
  MessageSquareMore,
  BarChart3,
  CalendarRange,
  Lock,
  Eye,
} from "lucide-react";

export const dynamic = "force-dynamic";

const FEATURE_ORDER = ["mentoring", "show_enterprise_programs", "pilot_to_pilot", "advanced_analytics", "scheduling_tools"];

const FEATURE_META: Record<
  string,
  { label: string; description: string; icon: React.ComponentType<{ className?: string }> }
> = {
  mentoring: {
    label: "ALPA NH Mentorship Program",
    description:
      "Pilot mentorship workflow: assignments, milestones, mentor portal, and admin tools.",
    icon: GraduationCap,
  },
  pilot_to_pilot: {
    label: "Pilot-to-Pilot Communication",
    description:
      "Anonymous or identified P2P messaging, peer check-ins, and shared experience threads.",
    icon: MessageSquareMore,
  },
  advanced_analytics: {
    label: "Advanced Analytics",
    description:
      "Engagement heatmaps, milestone completion rates, time-to-match reports, and CSV exports.",
    icon: BarChart3,
  },
  scheduling_tools: {
    label: "Scheduling Tools",
    description:
      "Bulk roster import, auto-assignment suggestions, and open-time management helpers.",
    icon: CalendarRange,
  },
  show_enterprise_programs: {
    label: "Show Enterprise Programs Upsell",
    description:
      "Reveals the locked 'Enterprise Programs' section on the tenant admin dashboard. Turn on when you're ready to pitch additional features to this airline.",
    icon: Eye,
  },
};


type TenantRow = { tenant: string; portal: string; displayName: string };

async function getActiveTenants(admin: ReturnType<typeof createAdminClient>): Promise<TenantRow[]> {
  const { data } = await admin
    .from("profiles")
    .select("tenant, portal")
    .not("tenant", "is", null)
    .not("portal", "is", null);

  if (!data) return [];

  const seen = new Set<string>();
  const rows: TenantRow[] = [];
  for (const r of data as { tenant: string; portal: string }[]) {
    const key = `${r.tenant}::${r.portal}`;
    if (!seen.has(key)) {
      seen.add(key);
      rows.push({
        tenant: r.tenant,
        portal: r.portal,
        displayName: `${r.tenant.charAt(0).toUpperCase() + r.tenant.slice(1)} / ${r.portal}`,
      });
    }
  }
  return rows.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export default async function TenantFeaturesPage() {
  await gateSuperAdmin();

  const admin = createAdminClient();
  const tenants = await getActiveTenants(admin);

  const featuresByTenant = await Promise.all(
    tenants.map(async (t) => ({
      ...t,
      features: await getTenantFeatures(t.tenant, t.portal),
    }))
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Tenant Features</h1>
        <p className="mt-1 text-sm text-slate-400">
          Toggle Enterprise features on or off per airline tenant. Changes take effect immediately
          — no deploy needed.
        </p>
      </div>

      {featuresByTenant.map((tenant) => {
        const featureMap = new Map(tenant.features.map((f) => [f.feature_key, f]));

        return (
          <div
            key={`${tenant.tenant}::${tenant.portal}`}
            className="rounded-2xl border border-slate-700/50 bg-slate-800/30 overflow-hidden"
          >
            <div className="border-b border-slate-700/50 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-100">{tenant.displayName}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {tenant.tenant} · {tenant.portal} portal
              </p>
            </div>

            <div className="divide-y divide-slate-700/30">
              {FEATURE_ORDER.map((key) => {
                const meta = FEATURE_META[key];
                if (!meta) return null;
                const row = featureMap.get(key as Parameters<typeof featureMap.get>[0]);
                const Icon = meta.icon;

                return (
                  <div
                    key={key}
                    className="flex items-start justify-between gap-4 px-6 py-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          row?.enabled
                            ? "bg-[#75C043]/10 text-[#75C043]"
                            : "bg-slate-700/50 text-slate-500"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-200">
                            {meta.label}
                          </span>
                          {!row?.enabled && (
                            <Lock className="h-3 w-3 text-slate-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          {meta.description}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 pt-0.5">
                      {row ? (
                        <TenantFeatureToggle
                          tenant={tenant.tenant}
                          portal={tenant.portal}
                          featureKey={key as Parameters<typeof TenantFeatureToggle>[0]["featureKey"]}
                          initialEnabled={row.enabled}
                          enabledAt={row.enabled_at}
                        />
                      ) : (
                        <span className="text-xs text-slate-600">not seeded</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {featuresByTenant.length === 0 && (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 px-6 py-12 text-center">
          <p className="text-slate-500 text-sm">No tenants found in the database yet.</p>
        </div>
      )}
    </div>
  );
}
