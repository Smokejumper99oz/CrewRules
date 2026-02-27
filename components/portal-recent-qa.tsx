"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const RECENT_KEY = "crewrules-ask-recent";

type RecentItem = { q: string; a?: string | null; c?: string | null; p?: string | null };

export function PortalRecentQA({
  tenant,
  portal,
}: {
  tenant: string;
  portal: string;
}) {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(RECENT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentItem[];
        setItems(Array.isArray(parsed) ? parsed : []);
      }
    } catch {
      setItems([]);
    }
  }, []);

  function handleClick(item: RecentItem) {
    try {
      sessionStorage.setItem(
        "crewrules-ask-last",
        JSON.stringify({
          q: item.q,
          a: item.a ?? null,
          c: item.c ?? null,
          p: item.p ?? null,
        })
      );
    } catch (_) {}
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
          <li key={i}>
            <Link
              href={`/${tenant}/${portal}/portal/ask`}
              onClick={() => handleClick(item)}
              className="block rounded-lg px-3 py-2 hover:bg-white/5"
            >
              &quot;{item.q.length > 60 ? item.q.slice(0, 60) + "…" : item.q}&quot;
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
