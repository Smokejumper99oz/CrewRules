"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import {
  importFrontierPilotAdminMentoringCsv,
  type MentoringCsvImportResult,
} from "@/app/frontier/pilots/admin/mentoring/actions";
import { MentoringMenteeImportResults } from "@/components/mentoring/mentoring-mentee-import-results";

const initial: MentoringCsvImportResult = { rows: [] };

export function FrontierPilotAdminMentoringCsvUploadForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [state, formAction, isPending] = useActionState(importFrontierPilotAdminMentoringCsv, initial);

  const isBusy = isSubmitting || isPending;

  useEffect(() => {
    if (!isPending) setIsSubmitting(false);
  }, [isPending]);

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-snug text-slate-500">
        All rows in one mentee class upload must use the same Hire Date. If multiple hire dates are detected, the import
        will stop.
      </p>
      <form
        action={formAction}
        onSubmit={() => setIsSubmitting(true)}
        className="space-y-2"
      >
        <input
          type="file"
          name="csv"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          disabled={isBusy}
          className="block w-full text-[11px] leading-none text-slate-600 file:mr-2 file:inline-flex file:h-7 file:w-44 file:shrink-0 file:items-center file:justify-center file:rounded-md file:border file:border-slate-300 file:bg-slate-100 file:px-2.5 file:text-[11px] file:font-semibold file:text-slate-800 hover:file:bg-slate-200 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isBusy}
          className="inline-flex h-7 w-44 shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent bg-[#75C043] px-2.5 text-[11px] font-semibold text-slate-950 hover:brightness-110 transition disabled:opacity-50"
        >
          {isBusy ? (
            <>
              <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
              Uploading…
            </>
          ) : (
            "Submit Import"
          )}
        </button>
        {isBusy ? (
          <p className="text-sm text-slate-400">
            Processing file… this can take a few seconds. Please do not close the page.
          </p>
        ) : null}
      </form>

      {state.fatalError || state.meta || state.rows.length > 0 ? (
        <MentoringMenteeImportResults state={state} isPending={isPending} />
      ) : null}
    </div>
  );
}
