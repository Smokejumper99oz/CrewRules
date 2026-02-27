import Link from "next/link";
import { PortalRecentQA } from "@/components/portal-recent-qa";

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
      {/* HERO: Ask */}
      <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-6 sm:p-8 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20">
        <h1 className="text-xl font-semibold tracking-tight border-b border-white/5">Ask</h1>

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
            className="flex min-h-[88px] items-center justify-center rounded-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-4 font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20 hover:bg-white/5 touch-manipulation"
          >
            {tile.label}
          </Link>
        ))}
      </div>

      <PortalRecentQA tenant={TENANT} portal={PORTAL} />

      {/* Saved (3 items) */}
      <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20">
        <h2 className="text-xl font-semibold tracking-tight border-b border-white/5">Saved</h2>
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
