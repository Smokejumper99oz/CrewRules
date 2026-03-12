import Link from "next/link";
import { getProfile } from "@/lib/profile";

const TENANT = "frontier";
const PORTAL = "pilots";

export default async function AdminDashboard() {
  const profile = await getProfile();
  const isSuperAdmin = profile?.role === "super_admin";

  return (
    <div className="space-y-6">
      <div className={`grid gap-4 ${isSuperAdmin ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <Link
          href={`/${TENANT}/${PORTAL}/admin/documents`}
          className="group rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20"
        >
          <div className="text-xl font-semibold tracking-tight border-b border-white/5 text-white group-hover:text-[#75C043]">
            Uploads
          </div>
          <div className="mt-2 text-sm text-slate-300">
            Upload CBA, LOAs, training docs, memos. PDF, Word, or text.
          </div>
        </Link>

        <Link
          href={`/${TENANT}/${PORTAL}/admin/library`}
          className="group rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20"
        >
          <div className="text-xl font-semibold tracking-tight border-b border-white/5 text-white group-hover:text-[#75C043]">
            Library
          </div>
          <div className="mt-2 text-sm text-slate-300">
            Enable AI questions, re-index documents, and manage the document library.
          </div>
        </Link>

        <Link
          href={`/${TENANT}/${PORTAL}/admin/people`}
          className="group rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20"
        >
          <div className="text-xl font-semibold tracking-tight border-b border-white/5 text-white group-hover:text-[#75C043]">
            People & Permissions
          </div>
          <div className="mt-2 text-sm text-slate-300">
            Manage user access, roles, and admin permissions.
          </div>
        </Link>

        {isSuperAdmin && (
          <Link
            href={`/${TENANT}/${PORTAL}/admin/waitlist`}
            className="group rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20"
          >
            <div className="text-xl font-semibold tracking-tight border-b border-white/5 text-white group-hover:text-[#75C043]">
              Waitlist
            </div>
            <div className="mt-2 text-sm text-slate-300">
              Track users requesting access before their airline launches.
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
