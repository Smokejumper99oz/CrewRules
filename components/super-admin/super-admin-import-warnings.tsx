import type { ImportWarningRow } from "@/lib/super-admin/import-warnings";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { SuperAdminUserWithMailto } from "./super-admin-user-mailto";

function dedupeImportWarnings(warnings: ImportWarningRow[]): ImportWarningRow[] {
  const seen = new Set<string>();
  const out: ImportWarningRow[] = [];
  for (const w of warnings) {
    const key = `${w.atIso}\0${w.userLabel}\0${w.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

export function SuperAdminImportWarnings({ warnings }: { warnings: ImportWarningRow[] }) {
  const rows = dedupeImportWarnings(warnings);

  return (
    <section className="rounded-xl border border-amber-500/25 bg-slate-800/50 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-100/95">
        <AlertTriangle className="size-4 shrink-0 text-amber-400" aria-hidden />
        Recent Import Warnings
      </div>
      <p className="mb-3 text-xs leading-snug text-slate-500">
        Same recent import batches as on the main dashboard. Heuristic checks only — users may not report
        issues.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No import warnings detected from recent activity.</p>
      ) : (
        <ul className="sidebar-scrollbar-hide max-h-56 space-y-5 overflow-y-auto">
          {rows.map((w) => (
            <li key={`${w.atIso}-${w.userLabel}-${w.reason}`} className="min-w-0 space-y-1.5">
              <div className="flex min-w-0 items-center gap-x-1.5 text-sm leading-snug">
                <time
                  className="shrink-0 tabular-nums font-medium text-slate-200"
                  dateTime={w.atIso}
                >
                  {format(new Date(w.atIso), "MMMM d HH:mm")}
                </time>
                <span className="shrink-0 text-slate-600" aria-hidden>
                  ·
                </span>
                <div className="min-w-0 flex-1">
                  <SuperAdminUserWithMailto
                    rootClassName="w-full"
                    displayLabel={w.userLabel}
                    email={w.userEmail}
                    nameClassName="font-medium text-slate-100"
                  />
                </div>
              </div>
              <p className="mt-1.5 text-sm leading-snug text-slate-400">
                <span aria-hidden>⚠️</span>
                <span className="pl-1">{w.reason}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
