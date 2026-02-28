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
      className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20 p-4 sm:p-6"
    >
      <label className="block text-sm font-medium text-slate-200">Ask</label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-2">
        <input
          name="q"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a contract, training, or union question…"
          disabled={loading}
          className="min-h-[44px] flex-1 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder:text-slate-600 outline-none focus:border-emerald-400/40 touch-manipulation disabled:opacity-50"
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
