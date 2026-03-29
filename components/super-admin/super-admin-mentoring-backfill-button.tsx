"use client";

import { useState } from "react";
import { backfillPendingMentorMenteeLinks } from "@/lib/super-admin/actions";

export function SuperAdminMentoringBackfillButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    setMessage(null);
    const result = await backfillPendingMentorMenteeLinks();
    setPending(false);
    if (result.error) {
      setMessage(result.error);
    } else {
      setMessage(`Linked ${result.linked} pending assignment(s) to existing profiles.`);
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
        {pending ? "Linking…" : "Link pending mentees (by employee #)"}
      </button>
      {message ? (
        <p className={`text-xs leading-relaxed ${message.startsWith("Linked") ? "text-emerald-300/90" : "text-red-300"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
