import type { ReactNode } from "react";
import { getTenantPortalConfig } from "@/lib/tenant-config";

const TENANT = "frontier";
const PORTAL = "pilots";

export default function TenantPortalLayout({ children }: { children: ReactNode }) {
  const cfg = getTenantPortalConfig(TENANT, PORTAL);

  if (!cfg) {
    return (
      <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-8">
        <div className="max-w-lg text-center">
          <h1 className="text-2xl font-bold">Portal not found</h1>
          <p className="mt-3 text-slate-300">
            Unknown tenant or portal. Check your URL (ex: /frontier/pilots/login).
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
