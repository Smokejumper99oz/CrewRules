import Link from "next/link";
import { gateSuperAdmin } from "@/lib/super-admin/gate";
import { SuperAdminMentoringCsvUploadForm } from "@/components/super-admin/super-admin-mentoring-csv-upload-form";
import { MentoringImportHistorySection } from "@/components/mentoring/mentoring-import-history-section";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  mentoringImportUploaderLabel,
  type MentoringImportHistoryRow,
} from "@/lib/mentoring/mentoring-import-history";

export const dynamic = "force-dynamic";

const sectionCard =
  "rounded-lg border border-slate-700/50 bg-slate-800/50 p-4 sm:p-5";

export default async function SuperAdminMentoringUploadPage() {
  const { profile } = await gateSuperAdmin();
  const tenant = String(profile.tenant ?? "frontier").trim() || "frontier";

  const admin = createAdminClient();
  const { data: historyRows } = await admin
    .from("mentoring_import_history")
    .select(
      "id, tenant, uploaded_by_user_id, file_name, file_type, total_rows, success_count, created_count, updated_count, failed_count, fatal_error, created_at, is_test_import",
    )
    .eq("tenant", tenant)
    .order("created_at", { ascending: false })
    .limit(25);

  const rows = (historyRows ?? []) as Omit<MentoringImportHistoryRow, "uploader_display">[];
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

  const historyEntries: MentoringImportHistoryRow[] = rows.map((r) => ({
    ...r,
    uploader_display: mentoringImportUploaderLabel(profileById.get(r.uploaded_by_user_id)),
  }));

  return (
    <div className="-mt-6 space-y-6 sm:-mt-8 max-w-2xl">
      <Link
        href="/super-admin/mentoring"
        className="inline-block text-sm text-slate-400 hover:text-slate-200 transition"
      >
        ← Back to Mentoring
      </Link>

      <h1 className="text-xl font-semibold tracking-tight text-slate-100">Upload mentees</h1>

      <section className={sectionCard} aria-labelledby="upload-instructions-heading">
        <h2 id="upload-instructions-heading" className="text-sm font-semibold text-slate-200">
          Instructions
        </h2>
        <p className="mt-2 text-sm leading-snug text-slate-400">
          Upload a CSV or Excel file to assign mentees to mentors in bulk.
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-snug text-slate-400">
          <li>Use the provided template</li>
          <li>Fill exactly one mentor identifier per row</li>
          <li>Use YYYY-MM-DD for hire_date</li>
        </ul>
      </section>

      <section className={sectionCard} aria-labelledby="template-heading">
        <h2 id="template-heading" className="text-sm font-semibold text-slate-200">
          Template
        </h2>
        <p className="mt-2 text-xs text-slate-500 leading-snug">
          CSV includes required headers and three empty example rows. Replace with your roster before importing.
        </p>
        <a
          href="/mentoring-mentee-import-template.csv"
          download="mentoring-mentee-import-template.csv"
          className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-600/60 bg-slate-800/50 px-3 text-xs font-medium text-slate-200 hover:bg-slate-700/40 hover:border-slate-500/80 transition sm:w-auto"
        >
          Download template
        </a>

        <div
          className="mt-3 rounded-md border border-slate-700/60 bg-slate-900/35 px-3 py-2"
          aria-labelledby="template-rules-heading"
        >
          <h3 id="template-rules-heading" className="text-xs font-semibold text-slate-200">
            Template rules
          </h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-snug text-slate-400">
            <li>Use exactly one mentor identifier per row</li>
            <li>Use YYYY-MM-DD for hire_date</li>
            <li>Do not repeat mentee_employee_number in the same file</li>
          </ul>
        </div>
      </section>

      <section className={sectionCard} aria-labelledby="upload-zone-heading">
        <h2 id="upload-zone-heading" className="text-sm font-semibold text-slate-200">
          Upload file
        </h2>
        <p className="mt-1 text-xs text-slate-500 leading-relaxed">
          Use the template headers exactly. Mentor and mentee are matched by employee number in your tenant only.
          New mentees need a company or personal email in the CSV so an auth user can be created.
        </p>
        <div className="mt-3">
          <SuperAdminMentoringCsvUploadForm />
        </div>
        <div className="mt-4">
          <MentoringImportHistorySection entries={historyEntries} />
        </div>
      </section>
    </div>
  );
}
