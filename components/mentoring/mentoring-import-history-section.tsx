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
  if (!mentorPreloadHistoryRowSuccess(row)) return "text-red-300/95";
  if (row.message === MENTORING_IMPORT_ROW_CREATED_MESSAGE) return "text-emerald-300/90";
  if (
    row.message === MENTORING_IMPORT_ROW_UPDATED_MESSAGE ||
    row.message === MENTORING_IMPORT_ROW_NO_CHANGES_MESSAGE
  ) {
    return "text-amber-200/95";
  }
  return "text-amber-200/95";
}

function rowLineClass(status: string): string {
  if (status === "success") return "text-emerald-300/90";
  return "text-red-300/95";
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
      <section className="rounded-lg border border-slate-700/60 bg-slate-900/25 px-3.5 py-3" aria-label={title}>
        <p className="text-xs font-semibold text-slate-200">{title}</p>
        <p className="mt-2 text-xs text-slate-500">No imports recorded yet for this tenant.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-700/60 bg-slate-900/25 px-3.5 py-3" aria-label={title}>
      <p className="text-xs font-semibold text-slate-200">{title}</p>
      <ul className="mt-3 space-y-2.5 text-xs text-slate-300">
        {entries.map((e) => (
          <li
            key={e.id}
            className="border-b border-slate-700/40 pb-2 last:border-0 last:pb-0 leading-snug"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-slate-400 shrink-0">{formatTs(e.created_at)}</span>
              {e.is_test_import ? (
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-500/15 text-amber-400/95 ring-1 ring-amber-400/25">
                  TEST
                </span>
              ) : null}
              <span className="font-medium text-slate-100 truncate max-w-[min(100%,280px)]" title={e.file_name}>
                {e.file_name}
              </span>
              <span className="uppercase text-slate-500">{e.file_type}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              by {e.uploader_display ?? "Unknown user"}
            </p>
            <div className="mt-1 font-mono text-[11px] text-slate-400">
              {variant === "mentor" ? (
                <>
                  rows {e.total_rows} — succeeded {e.success_count} — failed {e.failed_count}
                </>
              ) : (
                <>
                  rows {e.total_rows} — succeeded {e.success_count} — created {e.created_count} — updated{" "}
                  {e.updated_count} — failed {e.failed_count}
                </>
              )}
              {e.fatal_error ? (
                <span className="block text-red-300/90 mt-0.5">Fatal: {e.fatal_error}</span>
              ) : null}
            </div>

            {Array.isArray(e.row_results) && e.row_results.length > 0 ? (
              <details className="mt-2 rounded-md border border-slate-700/55 bg-slate-950/30">
                <summary className="cursor-pointer select-none px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:bg-slate-800/35">
                  Row details ({e.row_results.length})
                </summary>
                <div className="border-t border-slate-700/40 px-2 pb-2 pt-2 max-h-[280px] overflow-x-auto overflow-y-auto">
                  <div className="min-w-[520px]">
                    <div
                      className={`${mentorHistoryRowGridClass} text-[10px] font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-700/45 pb-1 mb-1.5`}
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
                              className={`${mentorHistoryRowGridClass} text-[10px] font-mono leading-snug py-1 border-b border-slate-800/70 last:border-0 min-w-0 ${lineCls}`}
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
                            className={`${mentorHistoryRowGridClass} text-[10px] font-mono leading-snug py-1 border-b border-slate-800/70 last:border-0 min-w-0 ${lineCls}`}
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
