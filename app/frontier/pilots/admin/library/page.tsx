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
  getDocumentAIStatus,
  type LibraryDocument,
} from "@/app/frontier/pilots/portal/library/actions";
import { setDocumentAISetting } from "@/app/frontier/pilots/admin/documents/actions";
import { FileTypeIcon } from "@/components/file-type-icon";
import { AIStatusBadge } from "@/components/ai-status-badge";
import { AccessBadge } from "@/components/access-badge";

function LoaderBar({ percent }: { percent?: number | null }) {
  const pct = percent == null ? 0 : Math.min(100, Math.max(0, percent));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-[#75C043]/70 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function formatTime(seconds: number) {
  if (seconds <= 0) return "finishing…";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
}

export default function AdminLibraryPage() {
  const [docs, setDocs] = useState<LibraryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [indexPercent, setIndexPercent] = useState<number | null>(null);
  const [indexSecondsRemaining, setIndexSecondsRemaining] = useState<number | null>(null);
  const [indexResult, setIndexResult] = useState<{ success?: string; error?: string } | null>(null);
  const [action, setAction] = useState<{
    type: "rename" | "replace" | null;
    doc: LibraryDocument | null;
  }>({ type: null, doc: null });
  const [renameValue, setRenameValue] = useState("");
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiStatusByPath, setAiStatusByPath] = useState<Record<string, "active" | "not_enabled">>({});
  const [aiEnabledByPath, setAiEnabledByPath] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    setError(null);
    const { docs: list, error: err } = await listDocuments();
    setDocs(list);
    if (err) setError(err);
    if (list.length > 0) {
      const { statusByPath, aiEnabledByPath } = await getDocumentAIStatus(list.map((d) => d.path));
      setAiStatusByPath(statusByPath);
      setAiEnabledByPath(aiEnabledByPath);
    } else {
      setAiStatusByPath({});
      setAiEnabledByPath({});
    }
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

  async function handleToggleAI(doc: LibraryDocument, enabled: boolean) {
    setBusy(true);
    const { error: err } = await setDocumentAISetting(doc.path, enabled);
    if (err) setError(err);
    else setAiEnabledByPath((prev) => ({ ...prev, [doc.path]: enabled }));
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
    setIndexPercent(0);
    const estimatedSec = Math.max(60, Math.min(180, docs.length * 45));
    setIndexSecondsRemaining(estimatedSec);

    const progressInterval = setInterval(() => {
      setIndexPercent((p) => {
        if (p == null) return 5;
        if (p < 90) return Math.min(90, p + 4);
        return Math.min(98, p + 1);
      });
    }, 1200);
    const timeInterval = setInterval(() => {
      setIndexSecondsRemaining((s) => (s == null ? 0 : Math.max(0, s - 1)));
    }, 1000);

    const result = await indexDocuments();
    clearInterval(progressInterval);
    clearInterval(timeInterval);
    setIndexPercent(100);
    setIndexSecondsRemaining(0);
    await new Promise((r) => setTimeout(r, 400));
    setIndexing(false);
    setIndexPercent(null);
    setIndexSecondsRemaining(null);
    setIndexResult(result);
    if (result.error) setError(result.error);
    if (result.success) await load();
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
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleIndex}
              disabled={indexing}
              className="rounded-xl border border-[#75C043]/50 bg-[#75C043]/10 px-4 py-2.5 text-sm font-semibold text-[#75C043] hover:bg-[#75C043]/20 disabled:opacity-50"
            >
              {indexing ? "Enabling…" : "Enable AI Questions"}
            </button>
            {indexResult?.success && (
              <span className="text-sm text-emerald-400">{indexResult.success}</span>
            )}
          </div>
          {indexing && (
            <div className="rounded-xl border border-[#75C043]/20 bg-[#75C043]/5 p-4 space-y-2">
              <LoaderBar percent={indexPercent} />
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Making documents searchable…</span>
                <span>
                  {indexPercent != null ? `${indexPercent}%` : ""}
                  {indexSecondsRemaining != null && (
                    <span className="ml-2 text-slate-400">
                      {indexPercent === 100
                        ? "Complete"
                        : indexSecondsRemaining > 0
                          ? `~${formatTime(indexSecondsRemaining)} left`
                          : "still processing…"}
                    </span>
                  )}
                </span>
              </div>
            </div>
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
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20 px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <FileTypeIcon fileName={doc.name} />
                <span className="font-medium text-white">{displayName(doc)}</span>
                <AccessBadge aiEnabled={aiEnabledByPath[doc.path] ?? false} />
                <AIStatusBadge status={aiStatusByPath[doc.path] ?? "not_enabled"} indexing={indexing} />
                <label className="flex items-center gap-1.5 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={aiEnabledByPath[doc.path] ?? false}
                    onChange={(e) => handleToggleAI(doc, e.target.checked)}
                    disabled={busy}
                    className="h-3.5 w-3.5 rounded border-white/20 text-[#75C043]"
                  />
                  AI
                </label>
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
