"use client";

import { useActionState } from "react";
import {
  importFrontierPilotAdminMentorCsv,
  type MentorPreloadCsvImportResult,
} from "@/app/frontier/pilots/admin/mentoring/actions";

const initial: MentorPreloadCsvImportResult = { total: 0, success: 0, failed: 0, rows: [] };

export function FrontierPilotAdminMentorCsvUploadForm() {
  const [state, formAction, isPending] = useActionState(importFrontierPilotAdminMentorCsv, initial);

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-2">
        <input
          type="file"
          name="csv"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          disabled={isPending}
          className="block w-full text-[11px] leading-none text-slate-400 file:mr-2 file:inline-flex file:h-7 file:w-44 file:shrink-0 file:items-center file:justify-center file:rounded-md file:border file:border-slate-600 file:bg-slate-800/80 file:px-2.5 file:text-[11px] file:font-semibold file:text-slate-200 hover:file:bg-slate-700/80 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-7 w-44 shrink-0 items-center justify-center rounded-md border border-transparent bg-[#75C043] px-2.5 text-[11px] font-semibold text-slate-950 hover:brightness-110 transition disabled:opacity-50"
        >
          {isPending ? "Importing…" : "Submit Import"}
        </button>
      </form>

      {state.fatalError ? (
        <p className="text-sm text-red-300" role="alert">
          {state.fatalError}
        </p>
      ) : null}

      {!state.fatalError && state.total > 0 ? (
        <p
          className={`text-sm font-medium ${state.failed > 0 ? "text-amber-200/95" : "text-emerald-300/90"}`}
          role="status"
        >
          Import finished: {state.success} succeeded, {state.failed} failed of {state.total} rows.
        </p>
      ) : null}

      {state.rows.length > 0 ? (
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/35 px-3.5 py-3 max-h-[320px] overflow-y-auto">
          <p className="text-xs font-semibold text-slate-200 mb-2">Row results</p>
          <ul className="space-y-1.5 text-xs font-mono leading-snug">
            {state.rows.map((r) => (
              <li
                key={r.rowNumber}
                className={r.status === "success" ? "text-emerald-300/90" : "text-amber-200/95"}
              >
                Row {r.rowNumber}: {r.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
