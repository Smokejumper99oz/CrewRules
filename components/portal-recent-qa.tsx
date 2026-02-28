"use client";

import { useState, useEffect } from "react";
import { getCitationDownloadUrl } from "@/app/frontier/pilots/portal/ask/actions";
import { listRecentQA } from "@/app/frontier/pilots/portal/ask/qa-actions";

const RECENT_KEY = "crewrules-ask-recent";

type RecentItem = { id?: string; q: string; a?: string | null; c?: string | null; p?: string | null };

export function PortalRecentQA({
  tenant,
  portal,
}: {
  tenant: string;
  portal: string;
}) {
  const [items, setItems] = useState<RecentItem[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { items: dbItems } = await listRecentQA();
      if (cancelled) return;
      if (dbItems.length > 0) {
        setItems(
          dbItems.map((r) => ({
            id: r.id,
            q: r.question,
            a: r.answer,
            c: r.citation,
            p: r.citation_path,
          }))
        );
        return;
      }
      try {
        const stored = localStorage.getItem(RECENT_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as RecentItem[];
          setItems(Array.isArray(parsed) ? parsed : []);
        }
      } catch {
        setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDownloadCitation(path: string) {
    const { url, error } = await getCitationDownloadUrl(path);
    if (!error && url) window.open(url, "_blank");
  }

  if (items.length === 0) {
    return (
      <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20 p-6">
        <h2 className="text-lg font-semibold">Recent Q&A</h2>
        <p className="mt-3 text-sm text-slate-500">Ask a question to see it here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20 p-6">
      <h2 className="text-lg font-semibold">Recent Q&A</h2>
      <ul className="mt-3 space-y-2 text-sm text-slate-300">
        {items.map((item, i) => (
          <li
            key={i}
            className="rounded-xl border border-white/5 bg-slate-950/40 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
              className="w-full text-left px-4 py-3 hover:bg-white/5 transition"
            >
              &quot;{item.q.length > 80 ? item.q.slice(0, 80) + "…" : item.q}&quot;
            </button>
            {expandedIndex === i && item.a && (
              <div className="border-t border-white/5 px-4 py-3 space-y-2">
                <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{item.a}</p>
                {item.c && (
                  <div className="rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 p-3">
                    <div className="text-xs text-emerald-200 whitespace-pre-wrap">{item.c}</div>
                    {item.p && (
                      <button
                        type="button"
                        onClick={() => handleDownloadCitation(item.p!)}
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
    </div>
  );
}
