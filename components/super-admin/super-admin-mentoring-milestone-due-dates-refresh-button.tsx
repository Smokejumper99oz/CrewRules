"use client";

import { useState } from "react";
import { refreshAllSuperAdminMentorshipMilestoneDueDatesFromHire } from "@/lib/super-admin/actions";

type SummaryTone = "success" | "warning" | "error";

function summaryToneClass(tone: SummaryTone): string {
  if (tone === "success") return "text-emerald-300/90";
  if (tone === "warning") return "text-amber-200/95";
  return "text-red-300/90";
}

export function SuperAdminMentoringMilestoneDueDatesRefreshButton() {
  const [summary, setSummary] = useState<{ tone: SummaryTone; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    setSummary(null);
    const result = await refreshAllSuperAdminMentorshipMilestoneDueDatesFromHire();
    setPending(false);

    const n = result.assignmentsWithHireDate;
    const failed = result.failed;
    const ok = n - failed;

    // List query failed (no rows processed; failed sync count not incremented)
    if (result.firstError != null && n === 0 && failed === 0) {
      setSummary({
        tone: "error",
        text: `Could not run refresh. Processed: 0. Failed: 0. Error: ${result.firstError}`,
      });
      return;
    }

    if (failed > 0) {
      setSummary({
        tone: "warning",
        text: `Done. Processed: ${n} assignment(s) with hire date. Succeeded: ${ok}. Failed: ${failed}. First error: ${result.firstError ?? "unknown"}`,
      });
      return;
    }

    if (n === 0) {
      setSummary({
        tone: "success",
        text: "Done. Processed: 0 assignment(s) with hire date. Succeeded: 0. Failed: 0. Nothing to refresh. Completions and notes were not changed.",
      });
      return;
    }

    setSummary({
      tone: "success",
      text: `Done. Processed: ${n} assignment(s) with hire date. Succeeded: ${ok}. Failed: 0. Due dates were recalculated from each DOH for known milestone types. Completions and notes were not changed.`,
    });
  }

  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-600/80 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/40 transition disabled:opacity-50"
      >
        {pending ? "Refreshing due dates…" : "Refresh milestone due dates — all assignments with DOH"}
      </button>
      {summary ? (
        <p className={`text-xs leading-relaxed ${summaryToneClass(summary.tone)}`}>{summary.text}</p>
      ) : null}
      <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
        Overwrites stored <span className="font-mono text-slate-400">due_date</span> for each known milestone
        type using the current schedule from assignment DOH. Does not change completed dates or notes.
      </p>
    </div>
  );
}
