import { PlaceholderCard } from "./placeholder-card";
import { FileWarning, AlertCircle, WifiOff } from "lucide-react";

export function SuperAdminNeedsAttention() {
  const hasIssues = false;

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-slate-200">Needs Attention</h2>
      <div
        className={`rounded-xl border p-4 ${
          hasIssues
            ? "border-amber-600/40 bg-amber-950/20"
            : "border-slate-600/40 bg-slate-800/40"
        }`}
      >
        {hasIssues ? (
          <p className="text-sm text-amber-200">Issues detected — check below</p>
        ) : (
          <p className="text-sm text-slate-300">All clear. No issues requiring attention.</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <PlaceholderCard
            title="Failed imports"
            subtitle="Not yet wired"
            icon={<FileWarning className="size-3.5" />}
            variant="compact"
          />
          <PlaceholderCard
            title="System errors"
            subtitle="Not yet wired"
            icon={<AlertCircle className="size-3.5" />}
            variant="compact"
          />
          <PlaceholderCard
            title="Provider failures"
            subtitle="Not yet wired"
            icon={<WifiOff className="size-3.5" />}
            variant="compact"
          />
        </div>
      </div>
    </div>
  );
}
