import { FrontierPilotAdminMentorCsvUploadForm } from "@/components/admin/frontier-pilot-admin-mentor-csv-upload-form";
import { MentoringImportHistorySection } from "@/components/mentoring/mentoring-import-history-section";
import { createAdminClient } from "@/lib/supabase/admin";
import { mentoringImportUploaderLabel } from "@/lib/mentoring/mentoring-import-history";
import type { MentorPreloadImportHistoryRow } from "@/lib/mentoring/mentor-preload-import-history";

export const dynamic = "force-dynamic";

const sectionCard = "rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-sm";

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
      <h1 className="text-xl font-semibold tracking-tight border-b border-slate-200 pb-3 text-[#1a2b4b]">Mentor Imports</h1>

      <section className={sectionCard} aria-labelledby="mentor-import-csv-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id="mentor-import-csv-heading" className="text-base font-semibold text-slate-800">
            Upload Mentors in Bulk (Download Excel Template to the right)
          </h2>
          <a
            href="/frontier-mentor-roster-import-template.xlsx"
            download="frontier-mentor-roster-import-template.xlsx"
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-emerald-300 bg-emerald-50 px-3 text-xs font-medium text-emerald-900 transition hover:border-emerald-400 hover:bg-emerald-100"
          >
            Download template
          </a>
        </div>
        <div className="mt-2 text-sm leading-snug text-slate-600">
          <p>Bulk import ALPA mentors using the template.</p>

          <p className="mt-3 text-sm font-semibold text-slate-800">Required fields</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            <li>mentor_full_name</li>
            <li>mentor_employee_number</li>
            <li>mentor_phone_number</li>
          </ul>

          <p className="mt-3 text-sm font-semibold text-slate-800">Email (at least one required)</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            <li>mentor_email_@flyfrontier.com (company / work)</li>
            <li>mentor_email_@for.mentoring (personal mentoring)</li>
          </ul>

          <p className="mt-3 text-sm font-semibold text-slate-800">
            Recommended fields (improves setup &amp; avoids manual edits)
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            <li>program — NH, CA, BOTH, COMPANY, POTENTIAL</li>
            <li>status — ACTIVE, NON ACTIVE, FORMER</li>
            <li>seat — CA, FO, FA</li>
            <li>crew_base — 3-letter IATA (e.g. SJU)</li>
            <li>notes — optional notes for admin context</li>
          </ul>

          <p className="mt-3 text-sm font-semibold text-slate-800">How it works</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            <li>Program sets the mentoring role (New Hire, Captain, or both)</li>
            <li>Status controls mentor activity (active, non-active, former)</li>
            <li>Seat defines CrewRules position (Captain, First Officer, Flight Attendant)</li>
            <li>Missing fields will NOT overwrite existing data</li>
            <li>Existing mentors update automatically by employee number</li>
            <li>Profiles link automatically when the mentor signs in</li>
          </ul>

          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="mb-2 text-xs font-semibold text-slate-800">Example row</p>
            <div className="space-y-0.5 font-mono text-[11px] leading-relaxed">
              <div>mentor_full_name: Joe Test</div>
              <div>mentor_employee_number: 400000</div>
              <div>mentor_phone_number: 555-555-555</div>
              <div>mentor_email_@for.mentoring: joetest@gmail.com</div>
              <div>program: BOTH</div>
              <div>status: ACTIVE</div>
              <div>seat: CA</div>
              <div>crew_base: SJU</div>
            </div>
          </div>
        </div>
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
