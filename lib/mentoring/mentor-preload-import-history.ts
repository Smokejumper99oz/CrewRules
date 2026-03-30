import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MentorPreloadCsvImportResult,
  MentorPreloadCsvImportRowResult,
} from "@/lib/mentoring/run-mentor-preload-csv-import";

/** Stored in `row_results` JSONB; identity added at insert time from parsed CSV (not from runner). */
export type MentorPreloadImportHistoryRowResult = MentorPreloadCsvImportRowResult & {
  employeeNumber?: string | null;
  fullName?: string | null;
};

export type MentorPreloadImportHistoryInsertResult = Omit<MentorPreloadCsvImportResult, "rows"> & {
  rows: MentorPreloadImportHistoryRowResult[];
};

export type MentorPreloadImportHistoryRow = {
  id: string;
  tenant: string;
  uploaded_by_user_id: string;
  file_name: string;
  file_type: string;
  total_rows: number;
  success_count: number;
  failed_count: number;
  fatal_error: string | null;
  created_at: string;
  row_results?: MentorPreloadImportHistoryRowResult[] | null;
};

export async function insertMentorPreloadImportHistory(
  admin: SupabaseClient,
  params: {
    tenant: string;
    uploadedByUserId: string;
    fileName: string;
    fileType: "csv" | "xlsx";
    result: MentorPreloadImportHistoryInsertResult;
  },
): Promise<void> {
  const { rows, fatalError, total, success, failed } = params.result;
  const { error } = await admin.from("mentor_preload_import_history").insert({
    tenant: params.tenant,
    uploaded_by_user_id: params.uploadedByUserId,
    file_name: params.fileName,
    file_type: params.fileType,
    total_rows: total,
    success_count: success,
    failed_count: failed,
    row_results: rows.length > 0 ? rows : null,
    fatal_error: fatalError ?? null,
  });
  if (error) {
    console.error("mentor_preload_import_history insert failed:", error.message);
  }
}
