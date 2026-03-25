import Link from "next/link";
import { gateSuperAdmin } from "@/lib/super-admin/gate";

export const dynamic = "force-dynamic";

const sectionCard =
  "rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 sm:p-6";

export default async function SuperAdminMentoringUploadPage() {
  await gateSuperAdmin();

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
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Upload a CSV file to assign mentees to mentors in bulk.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-400">
          <li>Use the provided template</li>
          <li>Fill exactly one mentor identifier per row</li>
          <li>Use YYYY-MM-DD for hire_date</li>
        </ul>
      </section>

      <section className={sectionCard} aria-labelledby="template-heading">
        <h2 id="template-heading" className="text-sm font-semibold text-slate-200">
          Template
        </h2>
        <p className="mt-3 text-xs text-slate-500 leading-relaxed">
          CSV includes required headers and three example rows. Replace sample data with your roster before upload is enabled.
        </p>
        <a
          href="/mentoring-mentee-import-template.csv"
          download="mentoring-mentee-import-template.csv"
          className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-slate-600/60 bg-slate-800/50 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700/40 hover:border-slate-500 transition sm:w-auto"
        >
          Download template
        </a>

        <div
          className="mt-4 rounded-lg border border-slate-700/60 bg-slate-900/35 px-3.5 py-3"
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
        <p className="mt-1 text-xs text-slate-500">File processing is not enabled yet.</p>
        <div
          className="mt-4 flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-600/50 bg-slate-900/30 px-4 py-8 text-center sm:min-h-[160px]"
        >
          <span className="text-sm font-medium text-slate-500">Upload coming soon</span>
          <span className="text-xs text-slate-600 max-w-[260px] leading-relaxed">
            Drag-and-drop or file picker for CSV will be enabled when import is ready
          </span>
        </div>
      </section>
    </div>
  );
}
