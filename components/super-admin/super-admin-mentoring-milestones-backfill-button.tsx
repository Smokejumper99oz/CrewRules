"use client";

import { useState } from "react";
import { backfillMissingMentorshipMilestones } from "@/lib/super-admin/actions";

const SEED_ERROR_PREVIEW_CAP = 10;

type SeedErrorPreview = {
  total: number;
  items: string[];
};

export function SuperAdminMentoringMilestonesBackfillButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [seedErrorPreview, setSeedErrorPreview] = useState<SeedErrorPreview | null>(null);
  const [tone, setTone] = useState<"ok" | "warn" | "err">("ok");
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    setMessage(null);
    setSeedErrorPreview(null);
    const result = await backfillMissingMentorshipMilestones();
    setPending(false);
    if (result.error) {
      setTone("err");
      setMessage(result.error);
      return;
    }
    const parts = [
      `Processed ${result.processedWithHireDate} assignment(s) with hire date (missing milestone types inserted where needed).`,
    ];
    if (result.stillMissingOeComplete.length > 0) {
      parts.push(
        `Still missing IOE Complete row with Type Rating present: ${result.stillMissingOeComplete.length} assignment(s).`,
      );
    }
    if (result.missingHireDateBlockingRepair.length > 0) {
      parts.push(
        `Cannot repair without hire_date on assignment: ${result.missingHireDateBlockingRepair.length} assignment(s) (set hire date, then run again).`,
      );
    }
    if (
      result.seedErrors.length === 0 &&
      result.stillMissingOeComplete.length === 0
    ) {
      parts.push("No type_rating-without-oe_complete gaps remain.");
    }
    const hasWarn =
      result.seedErrors.length > 0 ||
      result.stillMissingOeComplete.length > 0 ||
      result.missingHireDateBlockingRepair.length > 0;
    setTone(hasWarn ? "warn" : "ok");
    setMessage(parts.join(" "));

    if (result.seedErrors.length > 0) {
      setSeedErrorPreview({
        total: result.seedErrors.length,
        items: result.seedErrors.slice(0, SEED_ERROR_PREVIEW_CAP),
      });
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex min-h-[40px] items-center justify-center rounded-lg border border-slate-600/80 bg-slate-800/50 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/40 transition disabled:opacity-50"
      >
        {pending ? "Generating…" : "Generate missing milestones"}
      </button>
      {message ? (
        <div
          className={`text-xs leading-relaxed space-y-2 ${
            tone === "err" ? "text-red-300" : tone === "warn" ? "text-amber-200/95" : "text-emerald-300/90"
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message}</p>
          {seedErrorPreview && seedErrorPreview.items.length > 0 ? (
            <div
              className={
                tone === "err"
                  ? "rounded border border-red-500/30 bg-red-500/5 p-2.5"
                  : "rounded border border-amber-500/25 bg-amber-500/5 p-2.5"
              }
            >
              <p className="text-[11px] font-medium text-slate-200/90 mb-1.5">
                Seed errors: {seedErrorPreview.total} total{seedErrorPreview.total > SEED_ERROR_PREVIEW_CAP
                  ? ` (showing first ${SEED_ERROR_PREVIEW_CAP})`
                  : ""}
              </p>
              <ul className="list-inside list-decimal space-y-1.5 font-mono text-[11px] text-slate-200/80 leading-snug">
                {seedErrorPreview.items.map((line, i) => (
                  <li key={i} className="pl-0.5 break-all">
                    {line}
                  </li>
                ))}
              </ul>
              {seedErrorPreview.total > SEED_ERROR_PREVIEW_CAP ? (
                <p className="mt-2 text-[11px] text-slate-400/95">
                  … {seedErrorPreview.total - SEED_ERROR_PREVIEW_CAP} more not shown (cap {SEED_ERROR_PREVIEW_CAP} per
                  run for readability).
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
