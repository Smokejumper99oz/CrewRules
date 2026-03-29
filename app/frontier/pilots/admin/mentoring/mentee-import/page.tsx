import { FrontierPilotAdminMentoringCsvUploadForm } from "@/components/admin/frontier-pilot-admin-mentoring-csv-upload-form";
import { MentoringImportHistorySection } from "@/components/mentoring/mentoring-import-history-section";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  mentoringImportUploaderLabel,
  type MentoringImportHistoryRow,
} from "@/lib/mentoring/mentoring-import-history";

export const dynamic = "force-dynamic";

const sectionCard = "rounded-lg border border-slate-700/50 bg-slate-800/50 p-4 sm:p-5";

const TENANT = "frontier";

export default async function FrontierPilotAdminMentoringMenteeImportPage() {
  const admin = createAdminClient();
  const { data: historyRows } = await admin
    .from("mentoring_import_history")
    .select(
      "id, tenant, uploaded_by_user_id, file_name, file_type, total_rows, success_count, created_count, updated_count, failed_count, fatal_error, created_at, is_test_import",
    )
    .eq("tenant", TENANT)
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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight border-b border-white/5 pb-3">Mentee Imports</h1>
        <p className="mt-2 text-sm text-slate-400">
          Upload the roster template to assign mentees to mentors in bulk. Matching is based on employee number—users
          will be created or linked automatically when they sign in (Frontier Airline pilots only).
        </p>
      </div>

      <section className={sectionCard} aria-labelledby="mentee-import-csv-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id="mentee-import-csv-heading" className="text-base font-semibold text-slate-200">
            Upload Mentees in Bulk (Download Excel Template to the right)
          </h2>
          <a
            href="/frontier-mentee-roster-import-template.xlsx"
            download="frontier-mentee-roster-import-template.xlsx"
            className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-emerald-400/30 bg-slate-800/50 px-3 text-xs font-medium text-emerald-300 transition hover:border-emerald-400/50 hover:bg-emerald-400/10"
          >
            Download template
          </a>
        </div>
        <p className="mt-2 text-sm leading-snug text-slate-400">
          Bulk assign mentees using the template. Mentors require Employee Number only. Mentees require Employee Number,
          Date of Hire, Full Name, Private Phone, and Email to enable accurate matching. Existing assignments update
          automatically. Duplicates are ignored and flagged.
        </p>
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
