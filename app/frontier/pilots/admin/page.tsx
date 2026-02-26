import Link from "next/link";

const TENANT = "frontier";
const PORTAL = "pilots";

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="mt-2 text-slate-300">
          Manage documents and settings for {TENANT} {PORTAL} portal.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href={`/${TENANT}/${PORTAL}/admin/documents`}
          className="group rounded-3xl border border-white/10 bg-slate-950/40 p-6 transition hover:-translate-y-1 hover:border-[#75C043]/20"
        >
          <div className="text-lg font-semibold text-white group-hover:text-[#75C043]">
            Uploads
          </div>
          <div className="mt-2 text-sm text-slate-300">
            Upload CBA, LOAs, training docs, memos. PDF, Word, or text.
          </div>
        </Link>

        <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6 opacity-60">
          <div className="text-lg font-semibold">Indexing</div>
          <div className="mt-2 text-sm text-slate-400">
            Re-index documents for AI search (coming soon)
          </div>
        </div>
      </div>
    </div>
  );
}
