"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  listDocuments,
  getDocumentDownloadUrl,
  type LibraryDocument,
} from "./actions";
import { FileTypeIcon } from "@/components/file-type-icon";

export default function LibraryPage() {
  const [docs, setDocs] = useState<LibraryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { docs: list, error: err } = await listDocuments();
    setDocs(list);
    if (err) setError(err);
    setLoading(false);
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
    const m = d.name.match(/^\d+_(?:[^_]+_)?(.+)$/);
    const raw = m ? m[1] : d.name;
    const withoutExt = raw.includes(".") ? raw.replace(/\.[^.]+$/, "") : raw;
    const readable = withoutExt.replace(/_/g, " ");
    const cat = d.category.split("-").map((p) => p.toUpperCase()).join(" ");
    return `${cat} - ${readable}`;
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h1 className="text-2xl font-bold">Library</h1>
      <p className="mt-2 text-slate-300">
        Documents available for Ask AI and download.
      </p>

      {loading && (
        <div className="mt-6 flex items-center gap-3 text-slate-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#75C043]/40 border-t-[#75C043]" />
          <span>Loading documents…</span>
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-400">{error}</p>
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
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <FileTypeIcon fileName={doc.name} />
                <span className="font-medium text-white">{displayName(doc)}</span>
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
