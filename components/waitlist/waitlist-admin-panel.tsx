import type { WaitlistEntryRow } from "@/lib/waitlist/fetch-waitlist-entries";
import { WaitlistTableWithFilter } from "./waitlist-table-with-filter";

type Props = {
  entries: WaitlistEntryRow[];
  error: { message: string } | null;
  /** When false, the in-panel h1 is omitted (e.g. Super Admin sticky header already shows the title). */
  showPageHeading?: boolean;
};

export function WaitlistAdminPanel({
  entries,
  error,
  showPageHeading = true,
}: Props) {
  const counts = {
    total: entries.length,
    pending: entries.filter((e) => e.status === "pending").length,
    contacted: entries.filter((e) => e.status === "contacted").length,
    launched: entries.filter((e) => e.status === "launched").length,
    closed: entries.filter((e) => e.status === "closed").length,
  };

  const summaryCards = [
    { label: "Total", count: counts.total },
    { label: "Pending", count: counts.pending },
    { label: "Contacted", count: counts.contacted },
    { label: "Launched", count: counts.launched },
    { label: "Closed", count: counts.closed },
  ];

  return (
    <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-6 transition-all duration-200">
      {showPageHeading ? (
        <h1 className="text-xl font-semibold tracking-tight border-b border-white/5">Waitlist</h1>
      ) : null}
      <p className={showPageHeading ? "mt-2 text-slate-300" : "text-slate-300"}>
        Track users requesting access before their airline launches.
      </p>

      {error && <p className="mt-4 text-sm text-rose-400">{error.message}</p>}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {summaryCards.map(({ label, count }) => (
          <div
            key={label}
            className="rounded-xl border border-white/5 bg-slate-950/40 px-4 py-3"
          >
            <div className="text-2xl font-semibold text-white">{count}</div>
            <div className="text-xs text-slate-400">{label}</div>
          </div>
        ))}
      </div>

      <WaitlistTableWithFilter entries={entries} />
    </div>
  );
}
