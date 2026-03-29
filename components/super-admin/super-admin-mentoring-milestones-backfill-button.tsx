"use client";

import { useState } from "react";
import { backfillMissingMentorshipMilestones } from "@/lib/super-admin/actions";

export function SuperAdminMentoringMilestonesBackfillButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"ok" | "warn" | "err">("ok");
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    setMessage(null);
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
    if (result.seedErrors.length > 0) {
      parts.push(`Seed errors: ${result.seedErrors.slice(0, 5).join(" | ")}${result.seedErrors.length > 5 ? " …" : ""}`);
    }
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
        <p
          className={`text-xs leading-relaxed ${
            tone === "err" ? "text-red-300" : tone === "warn" ? "text-amber-200/95" : "text-emerald-300/90"
          }`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
