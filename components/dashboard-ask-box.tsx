"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  askHref: string;
};

export function DashboardAskBox({ askHref }: Props) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    router.push(`${askHref}?q=${encodeURIComponent(q)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow transition-colors duration-200 hover:shadow-md hover:border-emerald-400/30 sm:p-6 dark:border-white/5 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-900/60 dark:to-slate-950/80 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)] dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] dark:hover:border-emerald-400/20"
    >
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Ask</label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-2">
        <input
          name="q"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a contract, training, or union question…"
          disabled={loading}
          className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-400/40 touch-manipulation disabled:opacity-50 dark:border-white/10 dark:bg-slate-950/40 dark:text-white dark:placeholder:text-slate-600"
        />
        <button
          type="submit"
          disabled={loading}
          className="min-h-[44px] shrink-0 rounded-xl bg-[#75C043] px-5 py-3 font-semibold text-slate-950 hover:opacity-95 transition touch-manipulation disabled:opacity-50"
        >
          {loading ? "Opening…" : "Ask"}
        </button>
      </div>
    </form>
  );
}
