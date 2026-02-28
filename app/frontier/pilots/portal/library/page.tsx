"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  listDocuments,
  getDocumentDownloadUrl,
  getDocumentAIStatus,
  type LibraryDocument,
} from "./actions";
import { FileTypeIcon } from "@/components/file-type-icon";
import { AIStatusBadge } from "@/components/ai-status-badge";
import { AccessBadge } from "@/components/access-badge";

const LOAD_TIMEOUT_MS = 45_000;
const SLOW_LOAD_MS = 15_000;

export default function LibraryPage() {
  const [docs, setDocs] = useState<LibraryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slowLoad, setSlowLoad] = useState(false);
  const [aiStatusByPath, setAiStatusByPath] = useState<Record<string, "active" | "not_enabled">>({});
  const [aiEnabledByPath, setAiEnabledByPath] = useState<Record<string, boolean>>({});

  const timeoutPromise = () =>
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Loading took too long. Check your connection.")), LOAD_TIMEOUT_MS)
    );

  async function load() {
    setLoading(true);
    setError(null);
    setSlowLoad(false);
    const slowTimer = setTimeout(() => setSlowLoad(true), SLOW_LOAD_MS);
    try {
      const { docs: list, error: err } = await Promise.race([
        listDocuments(),
        timeoutPromise(),
      ]);
      if (err) {
        setError(err);
        setDocs([]);
      } else {
        setDocs(list);
        if (list.length > 0) {
          const { statusByPath, aiEnabledByPath } = await Promise.race([
            getDocumentAIStatus(list.map((d) => d.path)),
            timeoutPromise(),
          ]);
          setAiStatusByPath(statusByPath);
          setAiEnabledByPath(aiEnabledByPath);
        } else {
          setAiStatusByPath({});
          setAiEnabledByPath({});
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
      setDocs([]);
      setAiStatusByPath({});
      setAiEnabledByPath({});
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setSlowLoad(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDownload(doc: LibraryDocument) {
    const { url, error: err } = await getDocumentDownloadUrl(doc.path);
    if (err) setError(err);
    else if (url) window.open(url, "_blank");
  }

  const displayName = (d: LibraryDocument) => {
    if (d.displayName) return d.displayName;
    const m = d.name.match(/^\d+_(?:[^_]+_)?(.+)$/);
    const raw = m ? m[1] : d.name;
    const withoutExt = raw.includes(".") ? raw.replace(/\.[^.]+$/, "") : raw;
    const readable = withoutExt.replace(/_/g, " ");
    const cat = d.category.split("-").map((p) => p.toUpperCase()).join(" ");
    return `${cat} - ${readable}`;
  };

  return (
    <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20 p-6">
      <h1 className="text-xl font-semibold tracking-tight border-b border-white/5">Library</h1>
      <p className="mt-2 text-slate-300">
        Documents available for Ask AI and download.
      </p>

      {loading && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-3 text-slate-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#75C043]/40 border-t-[#75C043]" />
            <span>Loading documents…</span>
          </div>
          {slowLoad && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-sm text-amber-200/90">
              <span>Taking longer than usual.</span>
              <button
                onClick={() => load()}
                className="rounded border border-amber-500/40 px-2 py-1 text-amber-400 hover:bg-amber-500/10"
              >
                Retry now
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => load()}
            disabled={loading}
            className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && docs.length === 0 && !error && (
        <p className="mt-6 text-slate-400">
          No documents yet. Contact an admin if you expect documents to be available.
        </p>
      )}

      {!loading && docs.length > 0 && (
        <div className="mt-6 space-y-3">
          {docs.map((doc) => (
            <div
              key={doc.path}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20 px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <FileTypeIcon fileName={doc.name} />
                <span className="font-medium text-white">{displayName(doc)}</span>
                <AccessBadge aiEnabled={aiEnabledByPath[doc.path] ?? false} />
                <AIStatusBadge status={aiStatusByPath[doc.path] ?? "not_enabled"} />
              </div>
              <button
                onClick={() => handleDownload(doc)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5"
              >
                Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
