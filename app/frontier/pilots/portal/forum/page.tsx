import { getTenantPortalConfig } from "@/lib/tenant-config";

const TENANT = "frontier";
const PORTAL = "pilots";

export default function ForumPage() {
  const cfg = getTenantPortalConfig(TENANT, PORTAL);
  const url = cfg?.portal.discourseUrl ?? "";

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold">Forum</h1>
        <p className="mt-2 text-slate-300">
          Embedded Discourse. Configure the URL in{" "}
          <code className="text-slate-200">lib/tenant-config.ts</code>.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40">
        {url ? (
          <iframe
            title="Discourse Forum"
            src={url}
            className="h-[75vh] w-full"
          />
        ) : (
          <div className="p-6 text-slate-300">
            Discourse URL is not set yet. Update it for this portal in{" "}
            <b>lib/tenant-config.ts</b>.
          </div>
        )}
      </div>
    </div>
  );
}
