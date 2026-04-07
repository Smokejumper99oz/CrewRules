"use client";

import { useState, useTransition } from "react";
import { Lock, Unlock } from "lucide-react";
import { toggleTenantFeature } from "@/app/super-admin/tenant-features/actions";
import type { TenantFeatureKey } from "@/lib/tenant-features";

type Props = {
  tenant: string;
  portal: string;
  featureKey: TenantFeatureKey;
  initialEnabled: boolean;
  enabledAt: string | null;
};

export function TenantFeatureToggle({
  tenant,
  portal,
  featureKey,
  initialEnabled,
  enabledAt,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggle = () => {
    const next = !enabled;
    startTransition(async () => {
      setError(null);
      const result = await toggleTenantFeature(tenant, portal, featureKey, next);
      if (result.ok) {
        setEnabled(next);
      } else {
        setError(result.error ?? "Failed to update");
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleToggle}
        disabled={pending}
        aria-pressed={enabled}
        aria-label={`${enabled ? "Disable" : "Enable"} ${featureKey}`}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#75C043] disabled:opacity-50 ${
          enabled ? "bg-[#75C043]" : "bg-slate-600"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      {enabled ? (
        <Unlock className="h-3.5 w-3.5 text-[#75C043]" />
      ) : (
        <Lock className="h-3.5 w-3.5 text-slate-500" />
      )}
      {enabled && enabledAt && (
        <span className="text-xs text-slate-500">
          since {new Date(enabledAt).toLocaleDateString()}
        </span>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
