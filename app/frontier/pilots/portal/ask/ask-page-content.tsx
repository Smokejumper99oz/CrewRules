"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { askQuestion, getCitationDownloadUrl } from "./actions";
import { saveQARow } from "./qa-actions";
import { getRecentQAStorageKey, RECENT_QA_LEGACY_KEY } from "@/lib/recent-qa-storage";

const SAMPLE_QUESTION = "I'm on short call reserve on my last day — can scheduling extend me past midnight?";
const SAMPLE_REFERENCE = "Reference example: Section 25.X • Page ### (sample)";

const STORAGE_KEY = "crewrules-ask-last";
const RECENT_MAX = 5;

/** Reformats old path-style citations (from cache) into plain-English. */
function formatCitationForDisplay(citation: string | null, answer?: string | null): string {
  if (!citation) return "";
  // Already in new format (starts with "Source:" and has line breaks)
  if (citation.startsWith("Source:") && citation.includes("\n")) return citation;
  // Old format: "category: path" e.g. "fft-cba-loa-31: fft-cba-loa-31/..."
  const colonIdx = citation.indexOf(":");
  if (colonIdx === -1) return citation;
  const cat = citation.slice(0, colonIdx).trim().toLowerCase();
  let sourceLabel = "Source: Document";
  if (cat.includes("cba") && cat.includes("loa")) {
    const loaMatch = cat.match(/loa[-_]?(\d+)/i);
    const loaNum = loaMatch?.[1] ?? "";
    sourceLabel = `Source: Frontier Airlines CBA – LOA ${loaNum || "—"}`;
  } else if (cat) {
    const friendly = cat.split(/[-_]/).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
    sourceLabel = `Source: ${friendly}`;
  }
  const searchText = [answer, citation].filter(Boolean).join(" ");
  const sectionMatch = searchText?.match(/\b[Ss]ection\s+([0-9]+(?:\.[A-Za-z0-9]+)*)/i);
  const pageMatch = searchText?.match(/\b[Pp](?:age|\.)\s*(\d+)/i) ?? searchText?.match(/\b[Pp]age\s+(\d+)/i);
  const section = sectionMatch?.[1] ?? null;
  const page = pageMatch?.[1] ?? null;
  const lines: string[] = [sourceLabel];
  if (section) lines.push(`Section ${section}`);
  lines.push(page ? `Page ${page}` : "Page —");
  return lines.join("\n");
}

export function AskPageContent({
  tenant,
  portal,
  userId,
}: {
  tenant: string;
  portal: string;
  userId: string | null;
}) {
  const searchParams = useSearchParams();
  const qFromUrl = searchParams?.get("q") ?? null;
  const processedUrlRef = useRef(false);

  const storageKey = getRecentQAStorageKey(tenant, portal, userId);

  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [retrievedSources, setRetrievedSources] = useState<string | null>(null);
  const [citation, setCitation] = useState<string | null>(null);
  const [citationPath, setCitationPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof localStorage !== "undefined" && localStorage.getItem(RECENT_QA_LEGACY_KEY)) {
      localStorage.removeItem(RECENT_QA_LEGACY_KEY);
    }
  }, []);

  useEffect(() => {
    if (qFromUrl && !processedUrlRef.current) {
      processedUrlRef.current = true;
      const q = qFromUrl.trim();
      if (!q) return;
      (async () => {
        setSubmittedQuestion(q);
        setAnswer(null);
        setRetrievedSources(null);
        setCitation(null);
        setCitationPath(null);
        setError(null);
        setLoading(true);
        const result = await askQuestion(q);
        setLoading(false);
        if (result.error) {
          setError(result.error);
          return;
        }
        setAnswer(result.answer ?? null);
        setRetrievedSources(result.retrievedSources ?? null);
        setCitation(result.citation ?? null);
        setCitationPath(result.citationPath ?? null);
        await saveQARow(q, result.answer ?? null, result.citation ?? null, result.citationPath ?? null);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ q, a: result.answer ?? null, r: result.retrievedSources ?? null, c: result.citation ?? null, p: result.citationPath ?? null }));
          const recent: { q: string; a?: string | null; r?: string | null; c?: string | null; p?: string | null }[] = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
          const updated = [{ q, a: result.answer ?? null, r: result.retrievedSources ?? null, c: result.citation ?? null, p: result.citationPath ?? null }, ...recent.filter((r) => r.q !== q)].slice(0, RECENT_MAX);
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch (_) {}
        window.history.replaceState({}, "", window.location.pathname);
      })();
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { q, a, r, c, p } = JSON.parse(stored);
        if (q) setSubmittedQuestion(q);
        if (a) setAnswer(a);
        if (r) setRetrievedSources(r);
        if (c) setCitation(c);
        if (p) setCitationPath(p);
      }
    } catch (_) {}
  }, [qFromUrl, storageKey]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.querySelector<HTMLInputElement>('input[name="q"]');
    const q = input?.value?.trim();
    if (!q || loading) return;

    setSubmittedQuestion(q);
    setQuestion("");
    setAnswer(null);
    setRetrievedSources(null);
    setCitation(null);
    setCitationPath(null);
    setError(null);
    setLoading(true);

    const result = await askQuestion(q);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setAnswer(result.answer ?? null);
    setRetrievedSources(result.retrievedSources ?? null);
    setCitation(result.citation ?? null);
    setCitationPath(result.citationPath ?? null);
    await saveQARow(q, result.answer ?? null, result.citation ?? null, result.citationPath ?? null);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          q,
          a: result.answer ?? null,
          r: result.retrievedSources ?? null,
          c: result.citation ?? null,
          p: result.citationPath ?? null,
        })
      );
      const recent: { q: string; a?: string | null; r?: string | null; c?: string | null; p?: string | null }[] = JSON.parse(
        localStorage.getItem(storageKey) ?? "[]"
      );
      const updated = [
        { q, a: result.answer ?? null, r: result.retrievedSources ?? null, c: result.citation ?? null, p: result.citationPath ?? null },
        ...recent.filter((r) => r.q !== q),
      ].slice(0, RECENT_MAX);
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (_) {}
  }

  async function handleDownloadCitation() {
    if (!citationPath) return;
    const { url, error: err } = await getCitationDownloadUrl(citationPath);
    if (err) return;
    if (url) window.open(url, "_blank");
  }

  const displayQuestion = submittedQuestion || SAMPLE_QUESTION;
  const displayAnswer = loading
    ? "Searching library and generating answer…"
    : answer ??
      (submittedQuestion ? "AI search over your CBA and documents is coming next." : "Submit a question to search your CBA and documents.");
  const rawCitation = citation ?? (submittedQuestion && !loading ? "Citation will appear here once documents are indexed." : SAMPLE_REFERENCE);
  const displayCitation =
    rawCitation && rawCitation !== "Citation will appear here once documents are indexed." && rawCitation !== SAMPLE_REFERENCE
      ? formatCitationForDisplay(rawCitation, answer)
      : rawCitation;
  const displayRetrieved =
    retrievedSources && retrievedSources !== "Citation will appear here once documents are indexed."
      ? formatCitationForDisplay(retrievedSources, answer)
      : retrievedSources;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20 p-4 sm:p-6">
        <label className="block text-sm font-medium text-slate-200">
          Ask
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

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20 sm:rounded-[28px]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-300/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
          </div>
          <div className="hidden text-xs text-slate-400 sm:block">
            Contract AI
          </div>
          <div className="text-xs text-slate-400">Secure</div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="rounded-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20 p-4">
            <div className="text-xs text-slate-400">Pilot question</div>
            <div className="mt-2 text-sm text-white">&quot;{displayQuestion}&quot;</div>
          </div>

          <div className="mt-4 rounded-2xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Answer</div>
              <div className="text-xs text-emerald-300">Citations included</div>
            </div>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            <p className="mt-2 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{displayAnswer}</p>

            <p className="mt-3 text-xs font-medium text-emerald-300/90">
              Answer generated from official contract documents.
            </p>
            <div className="mt-2 space-y-3">
              {loading && submittedQuestion && (
                <div className="rounded-xl bg-slate-800/40 ring-1 ring-slate-600/30 p-3">
                  <div className="text-xs text-slate-400">Searching library…</div>
                </div>
              )}
              {!loading && displayRetrieved && (
                <div className="rounded-xl bg-slate-800/40 ring-1 ring-slate-600/30 p-3">
                  <div className="text-xs font-medium text-slate-400 mb-1.5">Retrieved sources</div>
                  <div className="text-xs text-slate-300 whitespace-pre-wrap">{displayRetrieved}</div>
                </div>
              )}
              {!loading && displayCitation && displayCitation !== SAMPLE_REFERENCE && displayCitation !== "Citation will appear here once documents are indexed." && (
                <div className="rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 p-3">
                  <div className="text-xs font-medium text-emerald-400/90 mb-1.5">Cited sources</div>
                  <div className="text-xs text-emerald-200 whitespace-pre-wrap">{displayCitation}</div>
                  {citationPath && (
                    <button
                      type="button"
                      onClick={handleDownloadCitation}
                      className="mt-2 text-xs font-medium text-[#75C043] hover:underline"
                    >
                      Download source document →
                    </button>
                  )}
                </div>
              )}
              {!loading && !displayRetrieved && !displayCitation && submittedQuestion && (
                <div className="rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 p-3">
                  <div className="text-xs text-emerald-200">Citation will appear here once documents are indexed.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
