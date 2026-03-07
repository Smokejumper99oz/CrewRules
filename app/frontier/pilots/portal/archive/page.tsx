"use client";

import { useState, useEffect } from "react";
import { listArchiveQA, hasQAPersistencePlan } from "../ask/qa-actions";
import { getCitationDownloadUrl } from "../ask/actions";
import Link from "next/link";
import type { QAItem } from "../ask/qa-actions";

const TENANT = "frontier";
const PORTAL = "pilots";

export default function ArchivePage() {
  const [items, setItems] = useState<QAItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hasPlan, setHasPlan] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const planOk = await hasQAPersistencePlan();
      if (cancelled) return;
      setHasPlan(planOk);
      if (!planOk) {
        setLoading(false);
        return;
      }
      const { items: list, total: t, hasMore: hm } = await listArchiveQA(page);
      if (cancelled) return;
      setItems(list);
      setTotal(t);
      setHasMore(hm);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [page]);

  async function handleDownload(path: string) {
    const { url, error } = await getCitationDownloadUrl(path);
    if (!error && url) window.open(url, "_blank");
  }

  if (!hasPlan && !loading) {
    return (
      <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 p-6">
        <h1 className="text-xl font-semibold border-b border-white/5">Archive</h1>
        <p className="mt-4 text-slate-400">
          Q&A archive is available for PRO and Enterprise plans.{" "}
          <Link href="/" className="text-[#75C043] hover:underline">
            Upgrade
          </Link>{" "}
          to save your questions permanently.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-6">
      <h1 className="text-xl font-semibold border-b border-white/5">Archive</h1>
      <p className="mt-2 text-sm text-slate-400">
        Older questions and answers (beyond the most recent 30)
      </p>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-slate-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#75C043]/40 border-t-[#75C043]" />
          <span>Loading…</span>
        </div>
      ) : items.length === 0 ? (
        <p className="mt-6 text-slate-500">No archived questions yet.</p>
      ) : (
        <>
          <ul className="mt-6 space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-white/5 bg-slate-950/40 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="w-full text-left px-4 py-3 hover:bg-white/5 transition"
                >
                  &quot;{item.question.length > 80 ? item.question.slice(0, 80) + "…" : item.question}&quot;
                </button>
                {expandedId === item.id && item.answer && (
                  <div className="border-t border-white/5 px-4 py-3 space-y-2">
                    <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{item.answer}</p>
                    {item.citation && (
                      <div className="rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 p-3">
                        <div className="text-xs text-emerald-200 whitespace-pre-wrap">{item.citation}</div>
                        {item.citation_path && (
                          <button
                            type="button"
                            onClick={() => handleDownload(item.citation_path!)}
                            className="mt-2 text-xs font-medium text-[#75C043] hover:underline"
                          >
                            Download source document →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Page {page} · {total} total archived
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
