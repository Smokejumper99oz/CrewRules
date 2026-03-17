"use client";

import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { dismissSystemEvent, type SystemEventRow } from "@/lib/super-admin/actions";
import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";

type SuperAdminNeedsAttentionProps = {
  events: SystemEventRow[];
  dismissedCount: number;
};

function typeLabel(type: string): string {
  if (type === "import") return "Import";
  if (type === "provider") return "Provider";
  return "System";
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "error") return <AlertCircle className="size-3.5 text-red-400 shrink-0" />;
  if (severity === "warning") return <AlertTriangle className="size-3.5 text-amber-400 shrink-0" />;
  return <Info className="size-3.5 text-slate-500 shrink-0" />;
}

export function SuperAdminNeedsAttention({ events, dismissedCount }: SuperAdminNeedsAttentionProps) {
  const router = useRouter();
  const hasIssues = events.length > 0;

  async function handleDismiss(eventId: string) {
    const { error } = await dismissSystemEvent(eventId);
    if (!error) router.refresh();
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-slate-200">
        Needs Attention{hasIssues ? ` (${events.length})` : ""}
        {dismissedCount > 0 && (
          <span className="ml-2 font-normal text-slate-500 text-sm">{dismissedCount} dismissed</span>
        )}
      </h2>
      <div
        className={`rounded-xl border p-4 ${
          hasIssues
            ? "border-amber-600/40 bg-amber-950/20"
            : "border-slate-600/40 bg-slate-800/40"
        }`}
      >
        {hasIssues ? (
          <ul className="space-y-2">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex items-start gap-2 text-sm"
              >
                <SeverityIcon severity={e.severity} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400 bg-slate-700/50">
                      {typeLabel(e.type)}
                    </span>
                    <span className="text-slate-500 text-xs">
                      {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="font-medium text-slate-200 mt-0.5">{e.title}</div>
                  <div className="text-slate-500 text-xs mt-0.5">{e.message}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDismiss(e.id)}
                  className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-700/50 hover:text-slate-300 transition"
                  aria-label="Dismiss"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-300">All clear. No issues requiring attention.</p>
        )}
      </div>
    </div>
  );
}
