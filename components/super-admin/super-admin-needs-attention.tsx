"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  deleteSystemEventsByIds,
  dismissSystemEvent,
  type MentoringMilestoneIntegritySignals,
  type SystemEventRow,
} from "@/lib/super-admin/actions";
import { AlertCircle, AlertTriangle, Info, X } from "lucide-react";

type SuperAdminNeedsAttentionProps = {
  events: SystemEventRow[];
  activeTotal: number;
  eventsPage: number;
  pageSize: number;
  mentoringIntegrity: MentoringMilestoneIntegritySignals;
};

function mentoringIntegrityPseudoEvents(s: MentoringMilestoneIntegritySignals): SystemEventRow[] {
  if (!s.hasAny) return [];
  const iso = new Date().toISOString();
  const out: SystemEventRow[] = [];
  if (s.typeRatingWithoutOeCompleteCount > 0) {
    out.push({
      id: "mentoring-signal-type-rating-no-oe",
      type: "mentoring",
      severity: "warning",
      title: "Type Rating without IOE Complete",
      message: `${s.typeRatingWithoutOeCompleteCount} assignment(s) have Type Rating but no IOE Complete row. Super Admin → Mentoring → Generate missing milestones.`,
      metadata: null,
      created_at: iso,
    });
  }
  if (s.hireDateMissingStandardMilestoneCount > 0) {
    out.push({
      id: "mentoring-signal-incomplete-standard",
      type: "mentoring",
      severity: "warning",
      title: "Incomplete standard milestone set",
      message: `${s.hireDateMissingStandardMilestoneCount} assignment(s) with hire date are missing one or more standard program milestones. Generate missing milestones.`,
      metadata: null,
      created_at: iso,
    });
  }
  if (s.typeRatingWithoutOeMissingHireDateCount > 0) {
    out.push({
      id: "mentoring-signal-no-hire",
      type: "mentoring",
      severity: "warning",
      title: "Mentoring repair blocked (hire date)",
      message: `${s.typeRatingWithoutOeMissingHireDateCount} assignment(s) have Type Rating without IOE Complete and no valid hire date. Set hire date on the assignment, then generate milestones.`,
      metadata: null,
      created_at: iso,
    });
  }
  return out;
}

/** After each `:`, capitalize the next alphabetic character (for Super Admin error copy). */
function capitalizeLetterAfterColon(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === ":") {
      out += ":";
      i += 1;
      while (i < text.length && /\s/.test(text[i]!)) {
        out += text[i];
        i += 1;
      }
      if (i < text.length && /[a-z]/.test(text[i]!)) {
        out += text[i]!.toUpperCase();
        i += 1;
      }
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

function typeLabel(type: string): string {
  if (type === "import") return "Import";
  if (type === "provider") return "Provider";
  if (type === "mentoring") return "Mentoring";
  if (type === "error") return "Error";
  return "System";
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "error") return <AlertCircle className="size-3.5 text-red-400 shrink-0" />;
  if (severity === "warning") return <AlertTriangle className="size-3.5 text-amber-400 shrink-0" />;
  return <Info className="size-3.5 text-slate-500 shrink-0" />;
}

function isRealSystemEventRow(e: SystemEventRow): boolean {
  return !e.id.startsWith("mentoring-signal-");
}

/** Lowercase haystack for classification (shared by explanations + badges). */
function buildSystemEventHaystack(e: SystemEventRow): string {
  const parts: string[] = [e.title, e.message];
  const meta = e.metadata;
  if (meta != null && typeof meta === "object" && !Array.isArray(meta)) {
    const rec = meta as Record<string, unknown>;
    if (typeof rec.path === "string") parts.push(rec.path);
    if (typeof rec.stack === "string") parts.push(rec.stack);
    try {
      parts.push(JSON.stringify(meta));
    } catch {
      /* ignore stringify failures (e.g. circular refs) */
    }
  }
  return parts.join("\n").toLowerCase();
}

/** Known Next/webpack dev noise only — not AviationStack, class overview, or generic errors. */
function isFrameworkNoiseEvent(e: SystemEventRow): boolean {
  if (e.id.startsWith("mentoring-signal-")) return false;
  const h = buildSystemEventHaystack(e);
  return (
    h.includes("webpack-runtime") ||
    h.includes("__webpack_require__") ||
    h.includes("reading 'call'") ||
    h.includes("react client manifest") ||
    h.includes("segmentviewnode")
  );
}

function systemEventHumanExplanation(e: SystemEventRow): string | null {
  if (e.id.startsWith("mentoring-signal-")) {
    return null;
  }
  const haystack = buildSystemEventHaystack(e);

  if (
    haystack.includes("webpack-runtime") ||
    haystack.includes("__webpack_require__") ||
    haystack.includes("reading 'call'")
  ) {
    return "Bundling or hot-reload glitch. Usually harmless in local dev; hard refresh or restart next dev. If it repeats in production, check the route and latest deploy.";
  }
  if (haystack.includes("react client manifest") || haystack.includes("segmentviewnode")) {
    return "Next.js / React Server Components manifest mismatch. Often dev-tooling noise, not CrewRules™ business logic.";
  }
  if (haystack.includes("aviationstack returned no flights")) {
    return "AviationStack returned no flights for that route/date. CrewRules™ may have used the fallback provider.";
  }
  if (haystack.includes("class_overview_health is not defined")) {
    return "Admin class overview UI reference error. Likely a stale build or mismatched health key.";
  }
  return "Unexpected app error. Use the raw message and metadata stack if it repeats.";
}

export function SuperAdminNeedsAttention({
  events,
  activeTotal,
  eventsPage,
  pageSize,
  mentoringIntegrity,
}: SuperAdminNeedsAttentionProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const mentoringPseudo =
    mentoringIntegrity && mentoringIntegrity.hasAny
      ? mentoringIntegrityPseudoEvents(mentoringIntegrity)
      : [];
  const pageEvents =
    eventsPage === 1 ? [...mentoringPseudo, ...events] : [...events];
  const headerTotalCount = activeTotal + mentoringPseudo.length;
  const hasAnyIssueInSystem = activeTotal > 0 || mentoringPseudo.length > 0;
  const hasIssuesOnPage = pageEvents.length > 0;
  const hasErrorSeverity = pageEvents.some((e) => e.severity === "error");
  const totalPages = Math.max(1, Math.ceil(activeTotal / pageSize));
  const showingFrom =
    activeTotal > 0 ? (eventsPage - 1) * pageSize + 1 : 0;
  const showingTo =
    activeTotal > 0 ? Math.min(eventsPage * pageSize, activeTotal) : 0;

  const selectableIdsOnPage = pageEvents.filter(isRealSystemEventRow).map((e) => e.id);
  const allPageSelected =
    selectableIdsOnPage.length > 0 &&
    selectableIdsOnPage.every((id) => selectedIds.has(id));

  function handleToggleSelectPage() {
    setSelectedIds((prev) => {
      const ids = pageEvents.filter(isRealSystemEventRow).map((e) => e.id);
      if (ids.length === 0) return prev;
      const next = new Set(prev);
      if (ids.every((id) => next.has(id))) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });
  }

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  async function handleDismiss(eventId: string) {
    const { error } = await dismissSystemEvent(eventId);
    if (!error) router.refresh();
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0 || bulkDeleting) return;
    setBulkDeleting(true);
    const result = await deleteSystemEventsByIds([...selectedIds]);
    setBulkDeleting(false);
    if (result.ok) {
      setSelectedIds(new Set());
      router.refresh();
    } else {
      window.alert(result.error);
    }
  }

  const issuesBody = hasIssuesOnPage ? (
    <ul className="space-y-2">
      {pageEvents.map((e) => {
        const explanation = systemEventHumanExplanation(e);
        return (
          <li key={e.id} className="flex items-start gap-2 text-sm">
            {isRealSystemEventRow(e) ? (
              <input
                type="checkbox"
                className="mt-1 size-3.5 shrink-0 rounded border-slate-500 bg-slate-800 text-[#75C043] focus:ring-[#75C043]/50"
                checked={selectedIds.has(e.id)}
                onChange={() => toggleSelected(e.id)}
                aria-label={`Select: ${e.title}`}
              />
            ) : (
              <span className="mt-1 inline-block w-3.5 shrink-0" aria-hidden />
            )}
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
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <div className="min-w-0 font-medium text-slate-200">
                  {capitalizeLetterAfterColon(e.title)}
                </div>
                {isFrameworkNoiseEvent(e) ? (
                  <span className="shrink-0 rounded border border-emerald-500/35 bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-300/95">
                    Safe to delete
                  </span>
                ) : null}
              </div>
              <div className="text-slate-500 text-xs mt-0.5">
                {capitalizeLetterAfterColon(e.message)}
              </div>
              {explanation ? (
                <div className="mt-1 text-[11px] leading-snug text-slate-600">
                  {capitalizeLetterAfterColon(explanation)}
                </div>
              ) : null}
            </div>
            {e.id.startsWith("mentoring-signal-") ? null : (
              <button
                type="button"
                onClick={() => handleDismiss(e.id)}
                className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-700/50 hover:text-slate-300 transition"
                aria-label="Dismiss"
              >
                <X className="size-3.5" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  ) : (
    <p className="text-sm text-slate-300">All clear. No issues requiring attention.</p>
  );

  const paginationControls =
    hasAnyIssueInSystem && totalPages > 1 ? (
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs text-slate-400">
        {eventsPage <= 1 ? (
          <span className="rounded px-2 py-1 font-medium text-slate-500 opacity-40">Previous</span>
        ) : (
          <Link
            href={`/super-admin?eventsPage=${eventsPage - 1}`}
            className="rounded px-2 py-1 font-medium text-slate-300 transition hover:bg-slate-700/50 hover:text-slate-100"
            scroll={false}
          >
            Previous
          </Link>
        )}
        <span className="tabular-nums text-slate-500">
          Page {eventsPage} of {totalPages}
        </span>
        {eventsPage >= totalPages ? (
          <span className="rounded px-2 py-1 font-medium text-slate-500 opacity-40">Next</span>
        ) : (
          <Link
            href={`/super-admin?eventsPage=${eventsPage + 1}`}
            className="rounded px-2 py-1 font-medium text-slate-300 transition hover:bg-slate-700/50 hover:text-slate-100"
            scroll={false}
          >
            Next
          </Link>
        )}
      </div>
    ) : null;

  const showingSummary =
    activeTotal > 0 ? (
      <p className="text-xs tabular-nums text-slate-500">
        Showing {showingFrom}{'\u2013'}{showingTo} of {activeTotal}
      </p>
    ) : null;

  const needsAttentionHeadingLabel = `Needs Attention (${headerTotalCount})`;

  const heading = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-slate-200 flex flex-wrap items-center gap-2">
        <AlertTriangle
          className={`size-4 shrink-0 ${
            hasAnyIssueInSystem
              ? hasErrorSeverity
                ? "text-red-400"
                : "text-amber-400"
              : "text-slate-300"
          }`}
        />
        {hasAnyIssueInSystem ? needsAttentionHeadingLabel : "System Status"}
      </h2>
      {hasAnyIssueInSystem && selectableIdsOnPage.length > 0 ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleToggleSelectPage}
            disabled={bulkDeleting}
            className="shrink-0 rounded-md border border-slate-500/50 bg-slate-800/60 px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:border-slate-400/60 hover:bg-slate-700/50 disabled:pointer-events-none disabled:opacity-40"
          >
            {allPageSelected ? "Deselect page" : "Select page"}
          </button>
          <button
            type="button"
            onClick={() => void handleDeleteSelected()}
            disabled={selectedIds.size === 0 || bulkDeleting}
            className="shrink-0 rounded-md border border-red-400/40 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-200 transition hover:bg-red-500/20 disabled:pointer-events-none disabled:opacity-40"
          >
            {bulkDeleting ? "Deleting…" : "Delete selected"}
          </button>
        </div>
      ) : null}
    </div>
  );

  if (hasAnyIssueInSystem) {
    return (
      <div
        className={`rounded-xl border px-4 py-6 space-y-3 ${
          hasErrorSeverity ? "bg-red-500/5 border-red-400/30" : "bg-amber-500/5 border-amber-400/35"
        }`}
      >
        {heading}
        <div className="space-y-3">
          {issuesBody}
          {showingSummary}
          {paginationControls}
        </div>
      </div>
    );
  }

  return (
    <Link
      href="/super-admin/system-health"
      className="block rounded-xl border px-4 py-6 space-y-3 bg-emerald-500/10 border-emerald-400/40 transition-colors hover:bg-emerald-500/[0.14] hover:border-emerald-400/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/35 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
    >
      {heading}
      <div className="space-y-3">
        {issuesBody}
        {paginationControls}
      </div>
    </Link>
  );
}
