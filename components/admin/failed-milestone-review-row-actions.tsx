"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archiveFailedMilestoneReview,
  resolveFailedMilestoneReview,
} from "@/app/frontier/pilots/admin/mentoring/actions";

const btnClass =
  "inline-flex shrink-0 items-center justify-center rounded-md border px-2 py-1 text-[11px] font-semibold leading-none transition-colors disabled:opacity-50";

export function FailedMilestoneReviewRowActions({ attemptId }: { attemptId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok?: true; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="inline-flex flex-nowrap items-center justify-end gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => resolveFailedMilestoneReview({ attemptId }))}
          className={`${btnClass} border-emerald-600/40 bg-emerald-50 text-emerald-800 hover:border-emerald-500/60 hover:bg-emerald-100`}
        >
          Resolve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => archiveFailedMilestoneReview({ attemptId }))}
          className={`${btnClass} border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50`}
        >
          Archive
        </button>
      </div>
      {error ? <p className="max-w-[10rem] text-right text-[10px] leading-snug text-red-400">{error}</p> : null}
    </div>
  );
}
