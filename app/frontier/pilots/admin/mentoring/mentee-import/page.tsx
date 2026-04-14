import { FrontierPilotAdminMentoringCsvUploadForm } from "@/components/admin/frontier-pilot-admin-mentoring-csv-upload-form";
import { MentoringImportHistorySection } from "@/components/mentoring/mentoring-import-history-section";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MentoringImportHistorySectionEntry } from "@/components/mentoring/mentoring-import-history-section";
import {
  mentoringImportUploaderLabel,
  type MentoringImportHistoryRow,
} from "@/lib/mentoring/mentoring-import-history";

export const dynamic = "force-dynamic";

const sectionCard = "rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-sm";

const TENANT = "frontier";

export default async function FrontierPilotAdminMentoringMenteeImportPage() {
  const admin = createAdminClient();
  const { data: historyRows } = await admin
    .from("mentoring_import_history")
    .select(
      "id, tenant, uploaded_by_user_id, file_name, file_type, total_rows, success_count, created_count, updated_count, failed_count, fatal_error, created_at, is_test_import, row_results",
    )
    .eq("tenant", TENANT)
    .order("created_at", { ascending: false })
    .limit(25);

  const rows = (historyRows ?? []) as (MentoringImportHistoryRow & {
    row_results: MentoringImportHistorySectionEntry["row_results"];
  })[];
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

  const historyEntries: MentoringImportHistorySectionEntry[] = rows.map((r) => ({
    ...r,
    uploader_display: mentoringImportUploaderLabel(profileById.get(r.uploaded_by_user_id)),
    row_results: Array.isArray(r.row_results) ? r.row_results : null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight border-b border-slate-200 pb-3 text-[#1a2b4b]">Mentee Imports</h1>

      <section className={sectionCard} aria-labelledby="mentee-import-csv-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id="mentee-import-csv-heading" className="text-base font-semibold text-slate-800">
            Upload Mentees in Bulk (Download Excel Template to the right)
          </h2>
          <a
            href="/frontier-mentee-roster-import-template.xlsx"
            download="frontier-mentee-roster-import-template.xlsx"
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-emerald-300 bg-emerald-50 px-3 text-xs font-medium text-emerald-900 transition hover:border-emerald-400 hover:bg-emerald-100"
          >
            Download template
          </a>
        </div>
        <div className="mt-2 text-sm leading-snug text-slate-600">
          <p>Bulk import mentees using the template for Frontier Airlines mentoring.</p>

          <p className="mt-3 text-sm font-semibold text-slate-800">Required fields</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            <li>mentee_full_name</li>
            <li>mentee_employee_number</li>
            <li>hire_date</li>
          </ul>

          <p className="mt-3 text-sm font-semibold text-slate-800">Email (optional)</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            <li>mentee_email@private (optional)</li>
            <li>mentee_email@flyfrontier.com (optional)</li>
          </ul>

          <p className="mt-3 text-sm font-semibold text-slate-800">Recommended fields</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            <li>mentor_employee_number (leave blank to import as unassigned)</li>
            <li>mentee_phone</li>
            <li>notes</li>
          </ul>

          <p className="mt-3 text-sm font-semibold text-slate-800">How it works</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            <li>All rows in one mentee class upload must use the same Hire Date</li>
            <li>If multiple hire dates are detected, the import will stop (no partial writes)</li>
            <li>Employee number is the source of truth for matching mentees</li>
            <li>Mentor employee number is optional; blank imports as Unassigned</li>
            <li>Existing assignments update automatically by employee number</li>
            <li>Duplicate mentee employee numbers in the same file are flagged</li>
            <li>Mentees can be imported before creating a CrewRules account</li>
            <li>Data can be corrected later by the mentee after signup</li>
          </ul>

          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="mb-2 text-xs font-semibold text-slate-800">Example row</p>
            <div className="space-y-0.5 font-mono text-[11px] leading-relaxed">
              <div>mentee_full_name: Jane Test</div>
              <div>mentee_employee_number: 123456</div>
              <div>hire_date: 2026-02-16</div>
              <div>mentor_employee_number: 439645</div>
              <div>mentee_phone: 555-555-5555</div>
              <div>mentee_email@private: janetest@gmail.com</div>
              <div>notes: Part 91</div>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <FrontierPilotAdminMentoringCsvUploadForm />
        </div>
        <div className="mt-4">
          <MentoringImportHistorySection entries={historyEntries} />
        </div>
      </section>
    </div>
  );
}
