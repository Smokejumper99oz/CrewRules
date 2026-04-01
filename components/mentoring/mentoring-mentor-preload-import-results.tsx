"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { MentorPreloadCsvImportActionResult } from "@/app/frontier/pilots/admin/mentoring/actions";
import type { MentorPreloadCsvImportRowResult } from "@/lib/mentoring/run-mentor-preload-csv-import";

/** Server action returns runner rows plus CSV identity fields from enrichment. */
type MentorPreloadImportLiveRow = MentorPreloadCsvImportRowResult & {
  fullName?: string | null;
  employeeNumber?: string | null;
};

const rowGridClass =
  "grid grid-cols-[2.25rem_4.5rem_minmax(0,1fr)_5rem_minmax(0,1.2fr)] gap-x-2 gap-y-0.5 items-center";

function rowStatusClass(r: MentorPreloadCsvImportRowResult): string {
  return r.status === "success" ? "text-emerald-300/90" : "text-red-300/95";
}

function shortStatusLabel(r: MentorPreloadCsvImportRowResult): string {
  return r.status === "success" ? "Success" : "Failed";
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
              <dt className="text-slate-500">Succeeded</dt>
              <dd className="font-mono text-emerald-300/90">{state.meta.successCount}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Failed</dt>
              <dd className="font-mono text-red-300/90">{state.meta.failedCount}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {state.rows.length > 0 ? (
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/35 px-3 py-2.5 max-h-[360px] overflow-x-auto overflow-y-auto">
          <p className="text-xs font-semibold text-slate-200 mb-2">Row results</p>
          <div className="min-w-[520px]">
            <div
              className={`${rowGridClass} text-[10px] font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-700/50 pb-1.5 mb-1`}
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
                    className={`${rowGridClass} text-xs font-mono leading-tight py-1 border-b border-slate-800/80 last:border-0 min-w-0 ${lineCls}`}
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
