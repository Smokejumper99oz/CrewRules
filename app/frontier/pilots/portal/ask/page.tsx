"use client";

import { useState } from "react";
import { askQuestion } from "./actions";

const SAMPLE_QUESTION = "I'm on short call reserve on my last day — can scheduling extend me past midnight?";
const SAMPLE_REFERENCE = "Reference example: Section 25.X • Page ### (sample)";

const CARDS = [
  { t: "Reserve", s: "Rules + buckets" },
  { t: "Pay", s: "Credits explained" },
  { t: "Mentor", s: "Notes & tracking" },
];

export default function AskPage() {
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citation, setCitation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.querySelector<HTMLInputElement>('input[name="q"]');
    const q = input?.value?.trim();
    if (!q || loading) return;

    setSubmittedQuestion(q);
    setAnswer(null);
    setCitation(null);
    setError(null);
    setLoading(true);

    const result = await askQuestion(q);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setAnswer(result.answer ?? null);
    setCitation(result.citation ?? null);
  }

  const displayQuestion = submittedQuestion || SAMPLE_QUESTION;
  const displayAnswer = loading
    ? "Searching library and generating answer…"
    : answer ??
      (submittedQuestion ? "AI search over your CBA and documents is coming next." : "Submit a question to search your CBA and documents.");
  const displayCitation = citation ?? (submittedQuestion && !loading ? "Citation will appear here once documents are indexed." : SAMPLE_REFERENCE);

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <label className="block text-sm font-medium text-slate-200">
          Ask Crew<span className="text-[#75C043]">Rules</span>™
        </label>
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
            {loading ? "Searching…" : "Ask"}
          </button>
        </div>
      </form>

      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-2xl sm:rounded-[28px]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-300/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
          </div>
          <div className="hidden text-xs text-slate-400 sm:block">
            Crew<span className="text-[#75C043]">Rules</span>™ • Contract AI
          </div>
          <div className="text-xs text-slate-400">Secure</div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <div className="text-xs text-slate-400">Pilot question</div>
            <div className="mt-2 text-sm text-white">&quot;{displayQuestion}&quot;</div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Answer</div>
              <div className="text-xs text-emerald-300">Citations included</div>
            </div>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            <p className="mt-2 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{displayAnswer}</p>

            <div className="mt-3 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 p-3">
              <div className="text-xs text-emerald-200">{displayCitation}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {CARDS.map((x) => (
              <div key={x.t} className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                <div className="text-xs font-semibold text-white">{x.t}</div>
                <div className="mt-1 text-[11px] text-slate-400">{x.s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
