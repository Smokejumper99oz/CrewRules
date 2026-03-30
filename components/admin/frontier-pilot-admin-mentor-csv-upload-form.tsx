"use client";

import { useActionState } from "react";
import {
  importFrontierPilotAdminMentorCsv,
  type MentorPreloadCsvImportActionResult,
} from "@/app/frontier/pilots/admin/mentoring/actions";
import { MentoringMentorPreloadImportResults } from "@/components/mentoring/mentoring-mentor-preload-import-results";

const initial: MentorPreloadCsvImportActionResult = { total: 0, success: 0, failed: 0, rows: [] };

export function FrontierPilotAdminMentorCsvUploadForm() {
  const [state, formAction, isPending] = useActionState(importFrontierPilotAdminMentorCsv, initial);

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-2">
        <input
          type="file"
          name="csv"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          disabled={isPending}
          className="block w-full text-[11px] leading-none text-slate-400 file:mr-2 file:inline-flex file:h-7 file:w-44 file:shrink-0 file:items-center file:justify-center file:rounded-md file:border file:border-slate-600 file:bg-slate-800/80 file:px-2.5 file:text-[11px] file:font-semibold file:text-slate-200 hover:file:bg-slate-700/80 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-7 w-44 shrink-0 items-center justify-center rounded-md border border-transparent bg-[#75C043] px-2.5 text-[11px] font-semibold text-slate-950 hover:brightness-110 transition disabled:opacity-50"
        >
          {isPending ? "Importing…" : "Submit Import"}
        </button>
      </form>

      {state.fatalError || state.meta || state.rows.length > 0 ? (
        <MentoringMentorPreloadImportResults state={state} isPending={isPending} />
      ) : null}
    </div>
  );
}
