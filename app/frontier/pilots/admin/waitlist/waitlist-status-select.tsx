"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateWaitlistStatus } from "./actions";
import { WAITLIST_STATUSES } from "./constants";

type Props = {
  id: string;
  currentStatus: string;
};

export function WaitlistStatusSelect({ id, currentStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const status = e.target.value;
    setError(null);
    startTransition(async () => {
      const result = await updateWaitlistStatus(id, status);
      if (result?.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={currentStatus}
        onChange={handleChange}
        disabled={isPending}
        className="rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-sm text-white outline-none focus:border-emerald-400/40 disabled:opacity-50"
      >
        {WAITLIST_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  );
}
