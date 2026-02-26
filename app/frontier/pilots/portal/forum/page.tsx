import Link from "next/link";
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
          {url
            ? "Discourse discussions for Frontier Airlines pilots. Open the forum in a new tab to participate."
            : "Configure the Discourse URL in lib/tenant-config.ts."}
        </p>
      </div>

      {url ? (
        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-8 text-center">
          <p className="text-slate-300">
            Discourse blocks embedding for security. Open the forum in a new tab.
          </p>
          <Link
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#75C043] px-5 py-3 font-semibold text-slate-950 hover:opacity-95 transition touch-manipulation"
          >
            Open Forum →
          </Link>
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6 text-slate-300">
          Discourse URL is not set yet. Update it for this portal in{" "}
          <b>lib/tenant-config.ts</b>.
        </div>
      )}
    </div>
  );
}
