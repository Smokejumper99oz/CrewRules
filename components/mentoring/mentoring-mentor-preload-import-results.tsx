"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { MentorPreloadCsvImportActionResult } from "@/app/frontier/pilots/admin/mentoring/actions";
import {
  MENTORING_IMPORT_ROW_CREATED_MESSAGE,
  MENTORING_IMPORT_ROW_NO_CHANGES_MESSAGE,
  MENTORING_IMPORT_ROW_UPDATED_MESSAGE,
} from "@/lib/mentoring/mentoring-import-summary";
import type { MentorPreloadCsvImportRowResult } from "@/lib/mentoring/run-mentor-preload-csv-import";

/** Server action returns runner rows plus CSV identity fields from enrichment. */
type MentorPreloadImportLiveRow = MentorPreloadCsvImportRowResult & {
  fullName?: string | null;
  employeeNumber?: string | null;
};

const rowGridClass =
  "grid grid-cols-[2.25rem_4.5rem_minmax(0,1fr)_5rem_minmax(0,1.2fr)] gap-x-2 gap-y-0.5 items-center";

function rowStatusClass(r: MentorPreloadCsvImportRowResult): string {
  if (!r.success) return "text-red-800";
  if (r.message === MENTORING_IMPORT_ROW_CREATED_MESSAGE) return "text-emerald-900";
  if (
    r.message === MENTORING_IMPORT_ROW_UPDATED_MESSAGE ||
    r.message === MENTORING_IMPORT_ROW_NO_CHANGES_MESSAGE
  ) {
    return "text-amber-950";
  }
  return "text-slate-800";
}

function shortStatusLabel(r: MentorPreloadCsvImportRowResult): string {
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

export type MentoringMentorPreloadImportResultsProps = {
  state: MentorPreloadCsvImportActionResult;
  isPending: boolean;
};

export function MentoringMentorPreloadImportResults({
  state,
  isPending,
}: MentoringMentorPreloadImportResultsProps) {
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
        <p className="text-sm font-medium text-red-800" role="alert">
          {state.fatalError}
        </p>
      ) : null}

      {state.meta ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="text-xs font-semibold text-slate-900">Import summary</p>
          <dl className="grid grid-cols-1 gap-1.5 text-xs text-slate-700 sm:grid-cols-2">
            <div>
              <dt className="text-slate-600">File</dt>
              <dd className="truncate font-medium text-slate-900" title={state.meta.fileName}>
                {state.meta.fileName}
              </dd>
            </div>
            <div>
              <dt className="text-slate-600">Type</dt>
              <dd className="font-medium uppercase text-slate-900">{state.meta.fileType}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-600">Uploaded</dt>
              <dd className="font-medium text-slate-900">{formatUploadedAt(state.meta.uploadedAtIso)}</dd>
            </div>
            <div>
              <dt className="text-slate-600">Total rows</dt>
              <dd className="font-mono text-slate-900">{state.meta.totalRows}</dd>
            </div>
            <div>
              <dt className="text-slate-600">Succeeded</dt>
              <dd className="font-mono font-semibold text-emerald-800">{state.meta.successCount}</dd>
            </div>
            <div>
              <dt className="text-slate-600">Failed</dt>
              <dd className="font-mono font-semibold text-red-700">{state.meta.failedCount}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {state.rows.length > 0 ? (
        <div className="max-h-[360px] overflow-x-auto overflow-y-auto rounded-lg border border-slate-200 bg-white px-3 py-2.5">
          <p className="mb-2 text-xs font-semibold text-slate-900">Row results</p>
          <div className="min-w-[520px]">
            <div
              className={`${rowGridClass} mb-1 border-b border-slate-200 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600`}
            >
              <span>Row</span>
              <span>Status</span>
              <span>Name</span>
              <span className="whitespace-nowrap">Emp #</span>
              <span>Message</span>
            </div>
            <ul className="space-y-0">
              {(state.rows as MentorPreloadImportLiveRow[]).map((r, i) => {
                const lineCls = rowStatusClass(r);
                const name = r.fullName?.trim() || "—";
                const emp = r.employeeNumber?.trim() || "—";
                return (
                  <li
                    key={`${r.rowNumber}-${i}`}
                    className={`${rowGridClass} min-w-0 border-b border-slate-100 py-1 font-mono text-xs leading-tight last:border-0 ${lineCls}`}
                  >
                    <span className="tabular-nums">{r.rowNumber}</span>
                    <span className="truncate font-sans text-[11px] font-medium">{shortStatusLabel(r)}</span>
                    <span className="truncate min-w-0" title={name !== "—" ? name : undefined}>
                      {name}
                    </span>
                    <span className="truncate tabular-nums" title={emp !== "—" ? emp : undefined}>
                      {emp}
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
