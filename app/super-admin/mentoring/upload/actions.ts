"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForServerAction } from "@/lib/super-admin/gate";
import { createAdminClient } from "@/lib/supabase/admin";
import { insertMentoringImportHistory } from "@/lib/mentoring/mentoring-import-history";
import { frontierMentoringAssignXlsxToCsvText } from "@/lib/mentoring/mentoring-workbook-first-sheet-to-csv-text";
import { summarizeMentoringCsvImportRows } from "@/lib/mentoring/mentoring-import-summary";
import {
  runFrontierMentoringCsvImport,
  type MentoringCsvImportResult,
  type MentoringCsvImportRowResult,
} from "@/lib/mentoring/run-frontier-mentoring-csv-import";

export type {
  MentoringCsvImportRowDisplay,
  MentoringCsvImportRowResult,
  MentoringCsvImportResult,
  MentoringCsvImportMeta,
} from "@/lib/mentoring/run-frontier-mentoring-csv-import";

const MAX_BYTES = 2 * 1024 * 1024;

export async function importFrontierMentoringCsv(
  _prev: MentoringCsvImportResult | null,
  formData: FormData
): Promise<MentoringCsvImportResult> {
  const gate = await requireSuperAdminForServerAction();
  if (!gate.ok) {
    return { rows: [], fatalError: gate.error };
  }
  const { profile } = gate;
  const tenant = String(profile.tenant ?? "frontier").trim() || "frontier";
  const mentoringPortal = String(profile.portal ?? "pilots").trim() || "pilots";
  const uploaderId = profile.id;

  const isTestImport = formData.has("is_test_import");

  const file = formData.get("csv");
  if (!(file instanceof File)) {
    return { rows: [], fatalError: "No file uploaded." };
  }
  const lower = file.name.toLowerCase();
  const isCsv = lower.endsWith(".csv");
  const isXlsx = lower.endsWith(".xlsx");
  if (!isCsv && !isXlsx) {
    return { rows: [], fatalError: "Please upload a .csv or .xlsx file." };
  }
  if (file.size > MAX_BYTES) {
    return { rows: [], fatalError: "File is too large (max 2 MB)." };
  }

  let text: string;
  try {
    if (isCsv) {
      text = await file.text();
    } else {
      const buffer = await file.arrayBuffer();
      const conv = frontierMentoringAssignXlsxToCsvText(buffer);
      if (!conv.ok) {
        return { rows: [], fatalError: conv.error };
      }
      text = conv.csvText;
    }
  } catch {
    return { rows: [], fatalError: "Could not read file." };
  }

  const admin = createAdminClient();
  const result = await runFrontierMentoringCsvImport(admin, tenant, text, mentoringPortal);

  const counts = summarizeMentoringCsvImportRows(result.rows);
  const meta = {
    fileName: file.name,
    fileType: (isCsv ? "csv" : "xlsx") as "csv" | "xlsx",
    uploadedAtIso: new Date().toISOString(),
    totalRows: counts.totalRows,
    successCount: counts.successCount,
    createdCount: counts.createdCount,
    updatedCount: counts.updatedCount,
    failedCount: counts.failedCount,
  };
  const enriched: MentoringCsvImportResult = { ...result, meta };

  await insertMentoringImportHistory(admin, {
    tenant,
    uploadedByUserId: uploaderId,
    fileName: file.name,
    fileType: isCsv ? "csv" : "xlsx",
    result: enriched,
    isTestImport,
  });

  revalidatePath("/super-admin/mentoring/upload");
  revalidatePath("/frontier/pilots/admin/mentoring/mentee-import");

  return enriched;
}
