import { FrontierPilotAdminMentorCsvUploadForm } from "@/components/admin/frontier-pilot-admin-mentor-csv-upload-form";

export const dynamic = "force-dynamic";

const sectionCard = "rounded-lg border border-slate-700/50 bg-slate-800/50 p-4 sm:p-5";

export default function FrontierPilotAdminMentoringMentorImportPage() {
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
          Bulk import mentors using the template. Each row requires Employee Number, Full Name, optional are Work Email,
          Personal Email, Phone number—use the template columns exactly for accurate preload. Existing preload rows
          update automatically. Duplicate employee numbers in the same file are ignored and flagged.
        </p>
        <div className="mt-3">
          <FrontierPilotAdminMentorCsvUploadForm />
        </div>
      </section>
    </div>
  );
}
