import Link from "next/link";

const TENANT = "frontier";
const PORTAL = "pilots";

const QUICK_TILES = [
  { label: "Reserve", href: "ask" },
  { label: "Pay", href: "ask" },
  { label: "Library", href: "library" },
  { label: "Updates", href: "updates" },
];

export default function PortalDashboard() {
  return (
    <div className="space-y-6">
      {/* HERO: Ask CrewRules™ */}
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
        <h1 className="text-2xl font-bold">
          Ask Crew<span className="text-[#75C043]">Rules</span>™
        </h1>

        <div className="mt-6">
          <Link
            href={`/${TENANT}/${PORTAL}/portal/ask`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#75C043] px-5 py-3 font-semibold text-slate-950 hover:opacity-95 transition touch-manipulation"
          >
            Open Ask Workspace
          </Link>
        </div>
      </div>

      {/* Quick Tiles (2x2) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {QUICK_TILES.map((tile) => (
          <Link
            key={tile.label}
            href={`/${TENANT}/${PORTAL}/portal/${tile.href}`}
            className="flex min-h-[88px] items-center justify-center rounded-2xl border border-white/10 bg-slate-950/40 p-4 font-semibold text-white hover:border-[#75C043]/20 hover:bg-white/5 transition touch-manipulation"
          >
            {tile.label}
          </Link>
        ))}
      </div>

      {/* Recent Q&A (3 items) */}
      <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
        <h2 className="text-lg font-semibold">Recent Q&A</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          {["Q1…", "Q2…", "Q3…"].map((item, i) => (
            <li key={i} className="rounded-lg px-3 py-2 hover:bg-white/5">
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Saved (3 items) */}
      <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
        <h2 className="text-lg font-semibold">Saved</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-300">
          {["Bookmark…", "Note…", "Item…"].map((item, i) => (
            <li key={i} className="rounded-lg px-3 py-2 hover:bg-white/5">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
