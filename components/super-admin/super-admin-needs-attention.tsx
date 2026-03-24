"use client";

import Link from "next/link";
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

  const issuesBody = hasIssues ? (
    <ul className="space-y-2">
      {events.map((e) => (
        <li key={e.id} className="flex items-start gap-2 text-sm">
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
  );

  const heading = (
    <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
      <AlertTriangle
        className={`size-4 shrink-0 ${hasIssues ? "text-red-400" : "text-slate-300"}`}
      />
      {hasIssues ? `Needs Attention (${events.length})` : "System Status"}
      {dismissedCount > 0 && (
        <span className="ml-2 font-normal text-slate-500 text-sm">{dismissedCount} dismissed</span>
      )}
    </h2>
  );

  if (hasIssues) {
    return (
      <div className="rounded-xl border px-4 py-6 space-y-3 bg-red-500/5 border-red-400/30">
        {heading}
        {issuesBody}
      </div>
    );
  }

  return (
    <Link
      href="/super-admin/system-health"
      className="block rounded-xl border px-4 py-6 space-y-3 bg-emerald-500/10 border-emerald-400/40 transition-colors hover:bg-emerald-500/[0.14] hover:border-emerald-400/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/35 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
    >
      {heading}
      {issuesBody}
    </Link>
  );
}
