"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  MENTORING_IMPORT_ROW_CREATED_MESSAGE,
  MENTORING_IMPORT_ROW_NO_CHANGES_MESSAGE,
  MENTORING_IMPORT_ROW_UPDATED_MESSAGE,
} from "@/lib/mentoring/mentoring-import-summary";
import type {
  MentoringCsvImportResult,
  MentoringCsvImportRowResult,
} from "@/lib/mentoring/run-frontier-mentoring-csv-import";

const rowGridClass =
  "grid grid-cols-[2.25rem_5rem_minmax(7rem,1fr)_5.5rem_5.5rem_minmax(10rem,2fr)] gap-x-3 gap-y-0 items-center";

function rowStatusClass(r: Pick<MentoringCsvImportRowResult, "success" | "message">): string {
  if (!r.success) return "text-red-300/95";
  if (r.message === MENTORING_IMPORT_ROW_CREATED_MESSAGE) return "text-emerald-300/90";
  if (
    r.message === MENTORING_IMPORT_ROW_UPDATED_MESSAGE ||
    r.message === MENTORING_IMPORT_ROW_NO_CHANGES_MESSAGE
  ) {
    return "text-amber-200/95";
  }
  return "text-amber-200/95";
}

function shortStatusLabel(r: MentoringCsvImportRowResult): string {
  if (!r.success) return "Failed";
  if (r.message === MENTORING_IMPORT_ROW_CREATED_MESSAGE) return "Created";
  if (r.message === MENTORING_IMPORT_ROW_UPDATED_MESSAGE) return "Updated";
  if (r.message === MENTORING_IMPORT_ROW_NO_CHANGES_MESSAGE) return "Unchanged";
  return "OK";
}

function formatUploadedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function displayOrFallback(r: MentoringCsvImportRowResult) {
  return (
    r.display ?? {
      menteeName: "",
      menteeEmployeeNumber: "",
      mentorEmployeeNumber: "",
    }
  );
}

export type MentoringMenteeImportResultsProps = {
  state: MentoringCsvImportResult;
  isPending: boolean;
};

export function MentoringMenteeImportResults({ state, isPending }: MentoringMenteeImportResultsProps) {
  const router = useRouter();
  const prevPending = useRef(false);

  useEffect(() => {
    if (prevPending.current && !isPending) {
      router.refresh();
    }
    prevPending.current = isPending;
  }, [isPending, router]);

  return (
    <div className="space-y-4">
      {state.fatalError ? (
        <p className="text-sm text-red-300" role="alert">
          {state.fatalError}
        </p>
      ) : null}

      {state.meta ? (
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/35 px-3.5 py-3 space-y-2">
          <p className="text-xs font-semibold text-slate-200">Import summary</p>
          <dl className="grid grid-cols-1 gap-1.5 text-xs text-slate-400 sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">File</dt>
              <dd className="font-medium text-slate-200 truncate" title={state.meta.fileName}>
                {state.meta.fileName}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Type</dt>
              <dd className="font-medium text-slate-200 uppercase">{state.meta.fileType}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Uploaded</dt>
              <dd className="font-medium text-slate-200">{formatUploadedAt(state.meta.uploadedAtIso)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Total rows</dt>
              <dd className="font-mono text-slate-200">{state.meta.totalRows}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Created</dt>
              <dd className="font-mono text-emerald-300/90">{state.meta.createdCount}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Updated / no change</dt>
              <dd className="font-mono text-amber-200/95">{state.meta.updatedCount}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Failed</dt>
              <dd className="font-mono text-red-300/90">{state.meta.failedCount}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Succeeded (total)</dt>
              <dd className="font-mono text-slate-200">{state.meta.successCount}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {state.rows.length > 0 ? (
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/35 px-3 py-2.5 max-h-[360px] overflow-x-auto overflow-y-auto">
          <p className="text-xs font-semibold text-slate-200 mb-2">Row results</p>
          <div className="min-w-[720px]">
            <div
              className={`${rowGridClass} text-[10px] font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-700/50 pb-1.5 mb-1`}
            >
              <span>Row</span>
              <span>Status</span>
              <span>Mentee</span>
              <span>Emp#</span>
              <span>Mentor#</span>
              <span>Details</span>
            </div>
            <ul className="space-y-0">
              {state.rows.map((r, i) => {
                const d = displayOrFallback(r);
                const lineCls = rowStatusClass(r);
                return (
                  <li
                    key={`${r.rowNumber}-${i}`}
                    className={`${rowGridClass} text-xs font-mono leading-tight py-1 border-b border-slate-800/80 last:border-0 min-w-0 ${lineCls}`}
                  >
                    <span className="tabular-nums">{r.rowNumber}</span>
                    <span className="truncate font-sans text-[11px] font-medium">{shortStatusLabel(r)}</span>
                    <span className="truncate min-w-0" title={d.menteeName || undefined}>
                      {d.menteeName || "—"}
                    </span>
                    <span className="truncate tabular-nums" title={d.menteeEmployeeNumber || undefined}>
                      {d.menteeEmployeeNumber || "—"}
                    </span>
                    <span className="truncate tabular-nums" title={d.mentorEmployeeNumber || undefined}>
                      {d.mentorEmployeeNumber || "—"}
                    </span>
                    <span className="truncate min-w-0 text-left" title={r.message}>
                      {r.message}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
