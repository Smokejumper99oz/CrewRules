import Link from "next/link";

const TENANT = "frontier";
const PORTAL = "pilots";

export default function PortalDashboard() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-2 text-slate-300">
          Tenant: <span className="text-white">{TENANT}</span> • Portal:{" "}
          <span className="text-white">{PORTAL}</span>
        </p>

        <div className="mt-5">
          <label className="text-sm text-slate-200">Ask Crew<span className="text-[#75C043]">Rules</span>™</label>
          <div className="mt-2 flex gap-2">
            <input
              placeholder="Ask a contract, training, or union question…"
              className="flex-1 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/40"
            />
            <Link
              href={`/${TENANT}/${PORTAL}/portal/ask`}
              className="rounded-xl bg-[#75C043] px-5 py-3 font-semibold text-slate-950 hover:opacity-95 transition"
            >
              Ask
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { t: "Library", d: "Contracts, LOAs, training docs, memos" },
          { t: "Forum", d: "Discourse discussions (embedded)" },
          { t: "Notes", d: "Saved Q&As, bookmarks, personal notes" },
          { t: "Updates", d: "Union + committee communications hub" },
        ].map((x) => (
          <div key={x.t} className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
            <div className="text-lg font-semibold">{x.t}</div>
            <div className="mt-2 text-sm text-slate-300">{x.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
