import { ProBadge } from "@/components/pro-badge";
import { getPlanBadgeLabel, getPlanBadgeVariant } from "@/lib/profile-badge";
import type { Profile } from "@/lib/profile";

type ScheduleStatus = "no_schedule" | "up_to_date" | "outdated";

function formatLastImport(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function ScheduleStatusChip({
  status,
  lastImportedAt,
  profile,
  showProBadge,
}: {
  status: ScheduleStatus;
  lastImportedAt: string | null;
  profile?: Profile | null;
  showProBadge?: boolean;
}) {
  const config = {
    no_schedule: { label: "No schedule imported", className: "border-slate-500/30 bg-slate-500/10 text-slate-400" },
    up_to_date: { label: "Up to date", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
    outdated: { label: "May be outdated", className: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  }[status];

  const useStackedLayout = showProBadge && profile;

  return (
    <div className={useStackedLayout ? "flex flex-col items-end gap-1" : "flex flex-wrap items-center gap-2"}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.className}`}>
          {config.label}
        </span>
        {useStackedLayout && (
          <ProBadge label={getPlanBadgeLabel(profile)} variant={getPlanBadgeVariant(profile)} size="sm" />
        )}
      </div>
      {lastImportedAt && status !== "no_schedule" && (
        <span className="text-xs text-slate-400">Last Import: {formatLastImport(lastImportedAt)}</span>
      )}
    </div>
  );
}
