"use client";

import { useActionState } from "react";
import {
  importFrontierMentoringCsv,
  type MentoringCsvImportResult,
} from "@/app/super-admin/mentoring/upload/actions";
import { MentoringMenteeImportResults } from "@/components/mentoring/mentoring-mentee-import-results";

const initial: MentoringCsvImportResult = { rows: [] };

export function SuperAdminMentoringCsvUploadForm() {
  const [state, formAction, isPending] = useActionState(importFrontierMentoringCsv, initial);

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-2">
        <input
          type="file"
          name="csv"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          disabled={isPending}
          className="block w-full text-xs text-slate-300 file:mr-2 file:rounded-md file:border file:border-slate-600 file:bg-slate-800/80 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-slate-200 hover:file:bg-slate-700/80"
        />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-8 items-center justify-center rounded-md bg-[#75C043] px-3 text-xs font-semibold text-slate-950 hover:brightness-110 transition disabled:opacity-50"
        >
          {isPending ? "Importing…" : "Submit Import"}
        </button>
      </form>

      {state.fatalError || state.meta || state.rows.length > 0 ? (
        <MentoringMenteeImportResults state={state} isPending={isPending} />
      ) : null}
    </div>
  );
}
