import { ProBadge } from "@/components/pro-badge";
import { getPlanBadgeLabel, getPlanBadgeVariant } from "@/lib/profile-badge";
import type { Profile } from "@/lib/profile";

type ScheduleStatus = "no_schedule" | "up_to_date" | "outdated";

export function formatLastImport(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString(undefined, { dateStyle: "medium" })} · ${d.toLocaleTimeString(undefined, { timeStyle: "short" })}`;
  } catch {
    return iso;
  }
}

export function ScheduleStatusChip({
  status,
  lastImportedAt,
  profile,
  showProBadge,
  showLastImport = true,
}: {
  status: ScheduleStatus;
  lastImportedAt: string | null;
  profile?: Profile | null;
  showProBadge?: boolean;
  /** When false, Last Import is not rendered (caller can render it elsewhere) */
  showLastImport?: boolean;
}) {
  const config = {
    no_schedule: { label: "No schedule imported yet", className: "border-slate-500/30 bg-slate-500/10 text-slate-400" },
    up_to_date: { label: "Up to date", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
    outdated: { label: "May be outdated", className: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  }[status];

  const useStackedLayout = showProBadge && profile;

  return (
    <div className={useStackedLayout ? "flex flex-col items-end gap-1" : "flex items-center gap-2"}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium ${config.className}`}>
          {config.label}
        </span>
        {useStackedLayout && (
          <ProBadge label={getPlanBadgeLabel(profile)} variant={getPlanBadgeVariant(profile)} size="sm" />
        )}
      </div>
      {showLastImport && lastImportedAt && status !== "no_schedule" && (
        <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">Last Import: {formatLastImport(lastImportedAt)}</span>
      )}
    </div>
  );
}
