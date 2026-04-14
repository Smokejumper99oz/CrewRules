import type { MentoringImportHistoryRow } from "@/lib/mentoring/mentoring-import-history";
import {
  MENTORING_IMPORT_ROW_CREATED_MESSAGE,
  MENTORING_IMPORT_ROW_NO_CHANGES_MESSAGE,
  MENTORING_IMPORT_ROW_UPDATED_MESSAGE,
} from "@/lib/mentoring/mentoring-import-summary";
import type { MentorPreloadImportHistoryRowResult } from "@/lib/mentoring/mentor-preload-import-history";
import type { MentoringCsvImportRowResult } from "@/lib/mentoring/run-frontier-mentoring-csv-import";

export type MentoringImportHistorySectionEntry = MentoringImportHistoryRow & {
  row_results?: (MentorPreloadImportHistoryRowResult | MentoringCsvImportRowResult)[] | null;
};

const mentorHistoryRowGridClass =
  "grid grid-cols-[2.25rem_4.5rem_minmax(0,1fr)_5rem_minmax(0,1.2fr)] gap-x-2 gap-y-0.5 items-center";

function formatTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Stored history may predate `success`; support legacy `status`. */
function mentorPreloadHistoryRowSuccess(row: MentorPreloadImportHistoryRowResult): boolean {
  const r = row as MentorPreloadImportHistoryRowResult & { status?: string };
  if (typeof r.success === "boolean") return r.success;
  return r.status === "success";
}

function mentorPreloadHistoryShortLabel(row: MentorPreloadImportHistoryRowResult): string {
  if (!mentorPreloadHistoryRowSuccess(row)) return "Failed";
  if (row.message === MENTORING_IMPORT_ROW_CREATED_MESSAGE) return "Created";
  if (row.message === MENTORING_IMPORT_ROW_UPDATED_MESSAGE) return "Updated";
  if (row.message === MENTORING_IMPORT_ROW_NO_CHANGES_MESSAGE) return "Unchanged";
  return "OK";
}

function mentorPreloadHistoryLineClass(row: MentorPreloadImportHistoryRowResult): string {
  if (!mentorPreloadHistoryRowSuccess(row)) return "text-red-800";
  if (row.message === MENTORING_IMPORT_ROW_CREATED_MESSAGE) return "text-emerald-900";
  if (
    row.message === MENTORING_IMPORT_ROW_UPDATED_MESSAGE ||
    row.message === MENTORING_IMPORT_ROW_NO_CHANGES_MESSAGE
  ) {
    return "text-amber-950";
  }
  return "text-slate-800";
}

function rowLineClass(status: string): string {
  if (status === "success") return "text-emerald-900";
  return "text-red-800";
}

function menteeRowStatusLabel(row: MentoringCsvImportRowResult): string {
  if (!row.success) return "Failed";
  const m = row.message;
  if (m.includes("Created")) return "Created";
  if (m.includes("Updated")) return "Updated";
  return "Unchanged";
}

export function MentoringImportHistorySection({
  title = "Recent imports",
  entries,
  variant = "mentee",
}: {
  title?: string;
  entries: MentoringImportHistorySectionEntry[];
  /** Mentor preload row details use the same message-based labels as mentee import. */
  variant?: "mentee" | "mentor";
}) {
  if (entries.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3" aria-label={title}>
        <p className="text-xs font-semibold text-slate-900">{title}</p>
        <p className="mt-2 text-xs text-slate-600">No imports recorded yet for this tenant.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3" aria-label={title}>
      <p className="text-xs font-semibold text-slate-900">{title}</p>
      <ul className="mt-3 space-y-2.5 text-xs text-slate-800">
        {entries.map((e) => (
          <li
            key={e.id}
            className="border-b border-slate-200 pb-2 last:border-0 last:pb-0 leading-snug"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="shrink-0 text-slate-600">{formatTs(e.created_at)}</span>
              {e.is_test_import ? (
                <span className="shrink-0 rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
                  TEST
                </span>
              ) : null}
              <span className="max-w-[min(100%,280px)] truncate font-medium text-slate-900" title={e.file_name}>
                {e.file_name}
              </span>
              <span className="uppercase text-slate-500">{e.file_type}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-600">
              by {e.uploader_display ?? "Unknown user"}
            </p>
            <div className="mt-1 font-mono text-[11px] text-slate-700">
              {variant === "mentor" ? (
                <>
                  rows <span className="font-semibold text-slate-900">{e.total_rows}</span>
                  <span className="text-slate-400"> — </span>
                  succeeded <span className="font-semibold text-emerald-800">{e.success_count}</span>
                  <span className="text-slate-400"> — </span>
                  failed <span className="font-semibold text-red-700">{e.failed_count}</span>
                </>
              ) : (
                <>
                  rows <span className="font-semibold text-slate-900">{e.total_rows}</span>
                  <span className="text-slate-400"> — </span>
                  succeeded <span className="font-semibold text-emerald-800">{e.success_count}</span>
                  <span className="text-slate-400"> — </span>
                  created <span className="font-semibold text-emerald-900">{e.created_count}</span>
                  <span className="text-slate-400"> — </span>
                  updated <span className="font-semibold text-sky-900">{e.updated_count}</span>
                  <span className="text-slate-400"> — </span>
                  failed <span className="font-semibold text-red-700">{e.failed_count}</span>
                </>
              )}
              {e.fatal_error ? (
                <span className="mt-0.5 block font-sans font-medium text-red-800">Fatal: {e.fatal_error}</span>
              ) : null}
            </div>

            {Array.isArray(e.row_results) && e.row_results.length > 0 ? (
              <details className="mt-2 rounded-md border border-slate-200 bg-white">
                <summary className="cursor-pointer select-none px-2.5 py-1.5 text-[11px] font-medium text-slate-800 hover:bg-slate-50">
                  Row details ({e.row_results.length})
                </summary>
                <div className="max-h-[280px] overflow-x-auto overflow-y-auto border-t border-slate-200 px-2 pb-2 pt-2">
                  <div className="min-w-[520px]">
                    <div
                      className={`${mentorHistoryRowGridClass} mb-1.5 border-b border-slate-200 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600`}
                    >
                      <span>Row</span>
                      <span>Status</span>
                      <span>Name</span>
                      <span className="whitespace-nowrap">Emp #</span>
                      <span>Message</span>
                    </div>
                    <ul className="space-y-0">
                      {e.row_results.map((row, idx) => {
                        if (variant === "mentor") {
                          const mRow = row as MentorPreloadImportHistoryRowResult;
                          const lineCls = mentorPreloadHistoryLineClass(mRow);
                          const name = mRow.fullName?.trim() || "—";
                          const emp = mRow.employeeNumber?.trim() || "—";
                          return (
                            <li
                              key={`${mRow.rowNumber}-${idx}`}
                              className={`${mentorHistoryRowGridClass} min-w-0 border-b border-slate-100 py-1 font-mono text-[10px] leading-snug last:border-0 ${lineCls}`}
                            >
                              <span className="tabular-nums">{mRow.rowNumber}</span>
                              <span className="font-sans text-[10px] font-medium">
                                {mentorPreloadHistoryShortLabel(mRow)}
                              </span>
                              <span className="truncate min-w-0" title={name !== "—" ? name : undefined}>
                                {name}
                              </span>
                              <span className="truncate tabular-nums" title={emp !== "—" ? emp : undefined}>
                                {emp}
                              </span>
                              <span className="truncate min-w-0 text-left" title={mRow.message}>
                                {mRow.message}
                              </span>
                            </li>
                          );
                        }

                        const menteeRow = row as MentoringCsvImportRowResult;
                        const lineCls = rowLineClass(menteeRow.success ? "success" : "error");
                        const name = menteeRow.display?.menteeName?.trim() || "—";
                        const emp = menteeRow.display?.menteeEmployeeNumber?.trim() || "—";
                        const mentorEmp = menteeRow.display?.mentorEmployeeNumber?.trim();
                        const mentorName = menteeRow.display?.mentorFullName?.trim();
                        const baseMsg = menteeRow.message;
                        let messageDisplay = baseMsg;
                        if (mentorEmp) {
                          if (mentorName) {
                            messageDisplay = `${baseMsg} · ${mentorName} (${mentorEmp})`;
                          } else {
                            messageDisplay = `${baseMsg} · Mentor # ${mentorEmp}`;
                          }
                        }
                        return (
                          <li
                            key={`${menteeRow.rowNumber}-${idx}`}
                            className={`${mentorHistoryRowGridClass} min-w-0 border-b border-slate-100 py-1 font-mono text-[10px] leading-snug last:border-0 ${lineCls}`}
                          >
                            <span className="tabular-nums">{menteeRow.rowNumber}</span>
                            <span className="font-sans text-[10px] font-medium">
                              {menteeRowStatusLabel(menteeRow)}
                            </span>
                            <span className="truncate min-w-0" title={name !== "—" ? name : undefined}>
                              {name}
                            </span>
                            <span className="truncate tabular-nums" title={emp !== "—" ? emp : undefined}>
                              {emp}
                            </span>
                            <span className="truncate min-w-0 text-left" title={messageDisplay}>
                              {messageDisplay}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </details>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
