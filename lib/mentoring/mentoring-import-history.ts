import type { SupabaseClient } from "@supabase/supabase-js";
import type { MentoringCsvImportResult } from "@/lib/mentoring/run-frontier-mentoring-csv-import";
import { summarizeMentoringCsvImportRows } from "@/lib/mentoring/mentoring-import-summary";

export type MentoringImportHistoryRow = {
  id: string;
  tenant: string;
  uploaded_by_user_id: string;
  file_name: string;
  file_type: string;
  total_rows: number;
  success_count: number;
  created_count: number;
  updated_count: number;
  failed_count: number;
  fatal_error: string | null;
  created_at: string;
  is_test_import: boolean;
  /** Set when list loaders fetch `profiles` for Recent imports UI. */
  uploader_display?: string;
};

/** Display string for history list: `full_name` then `personal_email` then `email`; missing profile or empty → "Unknown user". */
export function mentoringImportUploaderLabel(
  profile: { full_name: string | null; email: string | null; personal_email: string | null } | undefined,
): string {
  if (!profile) return "Unknown user";
  const name = (profile.full_name ?? "").trim();
  if (name) return name;
  const personal = (profile.personal_email ?? "").trim();
  if (personal) return personal;
  const email = (profile.email ?? "").trim();
  if (email) return email;
  return "Unknown user";
}

export async function insertMentoringImportHistory(
  admin: SupabaseClient,
  params: {
    tenant: string;
    uploadedByUserId: string;
    fileName: string;
    fileType: "csv" | "xlsx";
    result: MentoringCsvImportResult;
    isTestImport: boolean;
  },
): Promise<void> {
  const { rows, fatalError } = params.result;
  const s = summarizeMentoringCsvImportRows(rows);
  const { error } = await admin.from("mentoring_import_history").insert({
    tenant: params.tenant,
    uploaded_by_user_id: params.uploadedByUserId,
    file_name: params.fileName,
    file_type: params.fileType,
    total_rows: s.totalRows,
    success_count: s.successCount,
    created_count: s.createdCount,
    updated_count: s.updatedCount,
    failed_count: s.failedCount,
    fatal_error: fatalError ?? null,
    row_results: rows.length > 0 ? rows : null,
    is_test_import: params.isTestImport,
  });
  if (error) {
    console.error("mentoring_import_history insert failed:", error.message);
  }
}
