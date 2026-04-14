"use client";

import { useState, useEffect } from "react";
import {
  upsertPayScaleSetting,
  getShowConnectFlicaOnboardingSetting,
  setShowConnectFlicaOnboardingSetting,
} from "./actions";

export default function AdminSettingsPage() {
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [flicaEnabled, setFlicaEnabled] = useState<boolean | null>(null);
  const [flicaError, setFlicaError] = useState<string | null>(null);
  const [flicaSaving, setFlicaSaving] = useState(false);

  async function handleSubmit() {
    setResult(null);
    setLoading(true);
    try {
      const res = await upsertPayScaleSetting();
      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getShowConnectFlicaOnboardingSetting();
      if (cancelled) return;
      if ("error" in res) {
        setFlicaError(res.error);
        setFlicaEnabled(null);
      } else {
        setFlicaError(null);
        setFlicaEnabled(res.enabled);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleFlicaSet(enabled: boolean) {
    setFlicaSaving(true);
    setFlicaError(null);
    try {
      const res = await setShowConnectFlicaOnboardingSetting(enabled);
      if (res.error) {
        setFlicaError(res.error);
      } else {
        setFlicaEnabled(enabled);
      }
    } finally {
      setFlicaSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight border-b border-slate-200 pb-2 text-[#1a2b4b]">
          Connect FLICA onboarding (profile card)
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          When off, pilots do not see the Connect FLICA section on Profile. Missing row defaults to on (same as app).
        </p>
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-700">
            Current:{" "}
            {flicaEnabled === null && !flicaError ? (
              <span className="text-slate-500">Loading…</span>
            ) : flicaError ? (
              <span className="text-red-400">—</span>
            ) : flicaEnabled ? (
              <span className="text-emerald-400">On</span>
            ) : (
              <span className="text-amber-400">Off</span>
            )}
          </p>
          {flicaError && <p className="text-sm text-red-400">{flicaError}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleFlicaSet(true)}
              disabled={flicaSaving || (flicaEnabled === null && !flicaError) || flicaEnabled === true}
              className="rounded-xl bg-[#75C043] px-4 py-2 text-sm font-semibold text-slate-950 hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Turn on
            </button>
            <button
              type="button"
              onClick={() => handleFlicaSet(false)}
              disabled={flicaSaving || (flicaEnabled === null && !flicaError) || flicaEnabled === false}
              className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Turn off
            </button>
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight border-b border-slate-200 pb-2 text-[#1a2b4b]">
          Tenant Settings
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          Seed or update tenant-level configuration. Admin only.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="rounded-xl bg-[#75C043] px-4 py-2 text-sm font-semibold text-slate-950 hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Seeding…" : "Seed pay_scale (frontier / pilots)"}
          </button>
          {result?.success && (
            <span className="text-sm text-emerald-400">Done.</span>
          )}
          {result?.error && (
            <span className="text-sm text-red-400">{result.error}</span>
          )}
        </div>
      </div>
    </div>
  );
}
