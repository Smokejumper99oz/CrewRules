import type { MentoringCsvImportRowResult } from "@/lib/mentoring/run-frontier-mentoring-csv-import";

/** Exact success messages from `runFrontierMentoringCsvImport` (assignment sync). */
export const MENTORING_IMPORT_ROW_CREATED_MESSAGE = "Created (new assignment)";
export const MENTORING_IMPORT_ROW_UPDATED_MESSAGE = "Updated (filled missing data)";
export const MENTORING_IMPORT_ROW_NO_CHANGES_MESSAGE = "No changes (already up to date)";

export type MentoringImportRowCounts = {
  totalRows: number;
  successCount: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
};

export function summarizeMentoringCsvImportRows(rows: MentoringCsvImportRowResult[]): MentoringImportRowCounts {
  let createdCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  for (const r of rows) {
    if (!r.success) {
      failedCount++;
      continue;
    }
    if (r.message === MENTORING_IMPORT_ROW_CREATED_MESSAGE) {
      createdCount++;
    } else if (
      r.message === MENTORING_IMPORT_ROW_UPDATED_MESSAGE ||
      r.message === MENTORING_IMPORT_ROW_NO_CHANGES_MESSAGE
    ) {
      updatedCount++;
    } else {
      updatedCount++;
    }
  }
  const successCount = createdCount + updatedCount;
  return {
    totalRows: rows.length,
    successCount,
    createdCount,
    updatedCount,
    failedCount,
  };
}
