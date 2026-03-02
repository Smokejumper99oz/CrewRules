"use client";

import { useState } from "react";
import { upsertPayScaleSetting } from "./actions";

export default function AdminSettingsPage() {
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 p-6">
        <h2 className="text-xl font-semibold tracking-tight border-b border-white/5 pb-2">
          Tenant Settings
        </h2>
        <p className="mt-3 text-sm text-slate-400">
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
