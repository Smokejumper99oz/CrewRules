import { FrontierPilotAdminMentorCsvUploadForm } from "@/components/admin/frontier-pilot-admin-mentor-csv-upload-form";
import { MentoringImportHistorySection } from "@/components/mentoring/mentoring-import-history-section";
import { createAdminClient } from "@/lib/supabase/admin";
import { mentoringImportUploaderLabel } from "@/lib/mentoring/mentoring-import-history";
import type { MentorPreloadImportHistoryRow } from "@/lib/mentoring/mentor-preload-import-history";

export const dynamic = "force-dynamic";

const sectionCard = "rounded-lg border border-slate-700/50 bg-slate-800/50 p-4 sm:p-5";

const TENANT = "frontier";

export default async function FrontierPilotAdminMentoringMentorImportPage() {
  const admin = createAdminClient();
  const { data: historyRows } = await admin
    .from("mentor_preload_import_history")
    .select(
      "id, tenant, uploaded_by_user_id, file_name, file_type, total_rows, success_count, failed_count, fatal_error, created_at, row_results",
    )
    .eq("tenant", TENANT)
    .order("created_at", { ascending: false })
    .limit(25);

  const rows = (historyRows ?? []) as MentorPreloadImportHistoryRow[];
  const uploaderIds = [...new Set(rows.map((r) => r.uploaded_by_user_id))];
  const profileById = new Map<
    string,
    { full_name: string | null; email: string | null; personal_email: string | null }
  >();
  if (uploaderIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, full_name, email, personal_email")
      .in("id", uploaderIds);
    for (const p of profs ?? []) {
      const id = p.id as string;
      profileById.set(id, {
        full_name: p.full_name as string | null,
        email: p.email as string | null,
        personal_email: p.personal_email as string | null,
      });
    }
  }

  const historyEntries = rows.map((r) => ({
    id: r.id,
    tenant: r.tenant,
    uploaded_by_user_id: r.uploaded_by_user_id,
    file_name: r.file_name,
    file_type: r.file_type,
    total_rows: r.total_rows,
    success_count: r.success_count,
    created_count: 0,
    updated_count: 0,
    failed_count: r.failed_count,
    fatal_error: r.fatal_error,
    created_at: r.created_at,
    is_test_import: false,
    uploader_display: mentoringImportUploaderLabel(profileById.get(r.uploaded_by_user_id)),
    row_results: Array.isArray(r.row_results) ? r.row_results : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight border-b border-white/5 pb-3">Mentor Imports</h1>
        <p className="mt-2 text-sm text-slate-400">
          Upload the roster template to preload mentors in bulk. Matching uses employee number when mentors sign
          in—profiles link automatically (Frontier Airline pilots only).
        </p>
      </div>

      <section className={sectionCard} aria-labelledby="mentor-import-csv-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id="mentor-import-csv-heading" className="text-base font-semibold text-slate-200">
            Upload Mentors in Bulk (Download Excel Template to the right)
          </h2>
          <a
            href="/frontier-mentor-roster-import-template.xlsx"
            download="frontier-mentor-roster-import-template.xlsx"
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-emerald-400/30 bg-slate-800/50 px-3 text-xs font-medium text-emerald-300 transition hover:border-emerald-400/50 hover:bg-emerald-400/10"
          >
            Download template
          </a>
        </div>
        <p className="mt-2 text-sm leading-snug text-slate-400">
          Bulk import mentors using the template. Required columns: mentor_full_name, mentor_employee_number,
          mentor_phone_number, mentor_email_@flyfrontier.com, and notes. Optional staging columns (when present in the
          header row): mentor_position (captain, first_officer, flight_attendant) and mentor_base_airport (3-letter IATA).
          Existing preload rows update automatically. Duplicate mentor_employee_number values in the same file are ignored
          and flagged.
        </p>
        <div className="mt-3">
          <FrontierPilotAdminMentorCsvUploadForm />
        </div>
        <div className="mt-4">
          <MentoringImportHistorySection entries={historyEntries} variant="mentor" />
        </div>
      </section>
    </div>
  );
}
