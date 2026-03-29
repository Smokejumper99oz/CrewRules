"use client";

import { useState, useTransition } from "react";
import { runFinalizePendingAccountDeletionSuperAdmin } from "@/lib/super-admin/actions";
import type { FinalizePendingAccountDeletionResult } from "@/lib/super-admin/actions";

export function SuperAdminAccountDeletionFinalizeClient() {
  const [userId, setUserId] = useState("");
  const [result, setResult] = useState<FinalizePendingAccountDeletionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function runFinalize() {
    setResult(null);
    startTransition(async () => {
      const out = await runFinalizePendingAccountDeletionSuperAdmin(userId);
      setResult(out);
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">
        <p className="font-semibold text-red-50">Destructive internal tool</p>
        <p className="mt-2 leading-relaxed text-red-100/90">
          This permanently deletes the Supabase <code className="rounded bg-black/30 px-1">auth</code> user and
          cascades application data per database rules. Only run for accounts that have already passed the scheduled
          deletion time. There is no undo.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="finalize-user-id" className="block text-sm font-medium text-slate-300">
          User ID (UUID)
        </label>
        <input
          id="finalize-user-id"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="e.g. 00000000-0000-0000-0000-000000000000"
          className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-red-500/60 focus:outline-none focus:ring-1 focus:ring-red-500/40"
        />
      </div>

      <button
        type="button"
        disabled={!userId.trim() || isPending}
        onClick={runFinalize}
        className="rounded-lg border border-red-600 bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Running…" : "Finalize account deletion (destructive)"}
      </button>

      {result && (
        <div className="rounded-lg border border-slate-600 bg-slate-950/80 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Result</p>
          <pre className="mt-2 max-h-96 overflow-auto text-xs text-slate-200 whitespace-pre-wrap break-all">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
