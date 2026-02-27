import type { ReactNode } from "react";
import { getTenantPortalConfig } from "@/lib/tenant-config";

const TENANT = "frontier";
const PORTAL = "flight-attendants";

export default function FlightAttendantLayout({ children }: { children: ReactNode }) {
  const cfg = getTenantPortalConfig(TENANT, PORTAL);

  if (!cfg) {
    return (
      <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-8">
        <div className="max-w-lg text-center">
          <h1 className="text-xl font-semibold tracking-tight border-b border-white/5">Portal not found</h1>
          <p className="mt-3 text-slate-300">
            Unknown tenant or portal. Check your URL.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
