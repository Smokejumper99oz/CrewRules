"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { indexDocuments } from "@/app/frontier/pilots/admin/documents/index-actions";
import {
  listDocuments,
  deleteDocument,
  renameDocument,
  replaceDocument,
  getDocumentDownloadUrl,
  type LibraryDocument,
} from "@/app/frontier/pilots/portal/library/actions";
import { FileTypeIcon } from "@/components/file-type-icon";

export default function AdminLibraryPage() {
  const [docs, setDocs] = useState<LibraryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [indexResult, setIndexResult] = useState<{ success?: string; error?: string } | null>(null);
  const [action, setAction] = useState<{
    type: "rename" | "replace" | null;
    doc: LibraryDocument | null;
  }>({ type: null, doc: null });
  const [renameValue, setRenameValue] = useState("");
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function handleDelete(doc: LibraryDocument) {
    if (!confirm(`Delete "${doc.name}"?`)) return;
    setBusy(true);
    const { error: err } = await deleteDocument(doc.path);
    if (err) setError(err);
    else await load();
    setBusy(false);
  }

  async function handleRename() {
    if (!action.doc || !renameValue.trim()) return;
    setBusy(true);
    const { error: err } = await renameDocument(action.doc.path, renameValue.trim());
    if (err) setError(err);
    else {
      await load();
      setAction({ type: null, doc: null });
      setRenameValue("");
    }
    setBusy(false);
  }

  async function handleReplace() {
    if (!action.doc || !replaceFile) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("file", replaceFile);
    const { error: err } = await replaceDocument(action.doc.path, fd);
    if (err) setError(err);
    else {
      await load();
      setAction({ type: null, doc: null });
      setReplaceFile(null);
    }
    setBusy(false);
  }

  async function handleDownload(doc: LibraryDocument) {
    const { url, error: err } = await getDocumentDownloadUrl(doc.path);
    if (err) setError(err);
    else if (url) window.open(url, "_blank");
  }

  async function handleIndex() {
    setIndexing(true);
    setIndexResult(null);
    setError(null);
    const result = await indexDocuments();
    setIndexing(false);
    setIndexResult(result);
    if (result.error) setError(result.error);
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
        View and manage uploaded documents. Upload files in{" "}
        <Link href="/frontier/pilots/admin/documents" className="text-[#75C043] hover:underline">
          Admin → Uploads
        </Link>
        .
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

      {docs.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={handleIndex}
            disabled={indexing}
            className="rounded-xl border border-[#75C043]/50 bg-[#75C043]/10 px-4 py-2.5 text-sm font-semibold text-[#75C043] hover:bg-[#75C043]/20 disabled:opacity-50"
          >
            {indexing ? "Indexing…" : "Index for AI Search"}
          </button>
          {indexing && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#75C043]/40 border-t-[#75C043]" />
              <span>Making documents searchable…</span>
            </div>
          )}
          {indexResult?.success && (
            <span className="text-sm text-emerald-400">{indexResult.success}</span>
          )}
        </div>
      )}

      {!loading && docs.length === 0 && !error && (
        <p className="mt-6 text-slate-400">
          No documents yet. Upload files in{" "}
          <Link href="/frontier/pilots/admin/documents" className="text-[#75C043] hover:underline">
            Admin → Uploads
          </Link>
          .
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
              <div className="flex items-center gap-2">
                {action.type === "rename" && action.doc?.path === doc.path ? (
                  <>
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      placeholder="New name"
                      className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-1.5 text-sm text-white"
                    />
                    <button
                      onClick={handleRename}
                      disabled={busy}
                      className="rounded-lg bg-[#75C043] px-3 py-1.5 text-sm font-medium text-slate-950"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setAction({ type: null, doc: null });
                        setRenameValue("");
                      }}
                      className="text-sm text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </>
                ) : action.type === "replace" && action.doc?.path === doc.path ? (
                  <>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt,.csv"
                      onChange={(e) => setReplaceFile(e.target.files?.[0] ?? null)}
                      className="max-w-[140px] text-xs text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-[#75C043]/20 file:px-2 file:py-1 file:text-xs file:text-[#75C043]"
                    />
                    <button
                      onClick={handleReplace}
                      disabled={busy || !replaceFile}
                      className="rounded-lg bg-[#75C043] px-3 py-1.5 text-sm font-medium text-slate-950 disabled:opacity-50"
                    >
                      Replace
                    </button>
                    <button
                      onClick={() => {
                        setAction({ type: null, doc: null });
                        setReplaceFile(null);
                      }}
                      className="text-sm text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleDownload(doc)}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => {
                        setAction({ type: "rename", doc });
                        setRenameValue(displayName(doc));
                      }}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => setAction({ type: "replace", doc })}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5"
                    >
                      Replace
                    </button>
                    <button
                      onClick={() => handleDelete(doc)}
                      disabled={busy}
                      className="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
