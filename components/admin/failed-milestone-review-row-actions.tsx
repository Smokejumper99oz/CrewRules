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
    <div className="flex min-w-[7rem] flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => resolveFailedMilestoneReview({ attemptId }))}
          className={`${btnClass} border-emerald-500/35 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400/45 hover:bg-emerald-500/15`}
        >
          Resolve
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => archiveFailedMilestoneReview({ attemptId }))}
          className={`${btnClass} border-slate-500/35 bg-slate-800/50 text-slate-300 hover:border-slate-400/45 hover:bg-slate-800/80`}
        >
          Archive
        </button>
      </div>
      {error ? <p className="max-w-[10rem] text-right text-[10px] leading-snug text-red-400">{error}</p> : null}
    </div>
  );
}
