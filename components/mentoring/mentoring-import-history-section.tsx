import type { MentoringImportHistoryRow } from "@/lib/mentoring/mentoring-import-history";

function formatTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function MentoringImportHistorySection({
  title = "Recent imports",
  entries,
}: {
  title?: string;
  entries: MentoringImportHistoryRow[];
}) {
  if (entries.length === 0) {
    return (
      <section className="rounded-lg border border-slate-700/60 bg-slate-900/25 px-3.5 py-3" aria-label={title}>
        <p className="text-xs font-semibold text-slate-200">{title}</p>
        <p className="mt-2 text-xs text-slate-500">No imports recorded yet for this tenant.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-700/60 bg-slate-900/25 px-3.5 py-3" aria-label={title}>
      <p className="text-xs font-semibold text-slate-200">{title}</p>
      <ul className="mt-3 space-y-2.5 text-xs text-slate-300">
        {entries.map((e) => (
          <li
            key={e.id}
            className="border-b border-slate-700/40 pb-2 last:border-0 last:pb-0 leading-snug"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-slate-400 shrink-0">{formatTs(e.created_at)}</span>
              {e.is_test_import ? (
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-500/15 text-amber-400/95 ring-1 ring-amber-400/25">
                  TEST
                </span>
              ) : null}
              <span className="font-medium text-slate-100 truncate max-w-[min(100%,280px)]" title={e.file_name}>
                {e.file_name}
              </span>
              <span className="uppercase text-slate-500">{e.file_type}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              by {e.uploader_display ?? "Unknown user"}
            </p>
            <div className="mt-1 font-mono text-[11px] text-slate-400">
              rows {e.total_rows} — succeeded {e.success_count} — created {e.created_count} — updated {e.updated_count}{" "}
              — failed {e.failed_count}
              {e.fatal_error ? (
                <span className="block text-red-300/90 mt-0.5">Fatal: {e.fatal_error}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
