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
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-emerald-700 transition-all duration-500"
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
  const [slowLoad, setSlowLoad] = useState(false);

  const LOAD_TIMEOUT_MS = 45_000;
  const SLOW_LOAD_MS = 15_000;

  async function load() {
    setLoading(true);
    setError(null);
    setSlowLoad(false);

    const slowTimer = setTimeout(() => setSlowLoad(true), SLOW_LOAD_MS);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Loading took too long. Check your connection or Supabase status (dashboard.supabase.com).")), LOAD_TIMEOUT_MS)
    );

    try {
      const { docs: list, error: err } = await Promise.race([
        listDocuments(),
        timeoutPromise,
      ]);
      if (err) {
        setError(err);
        setDocs([]);
      } else {
        setDocs(list);
        if (list.length > 0) {
          const { statusByPath, aiEnabledByPath } = await Promise.race([
            getDocumentAIStatus(list.map((d) => d.path)),
            timeoutPromise,
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
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300">
      <h1 className="text-xl font-semibold tracking-tight border-b border-slate-200 pb-2 text-[#1a2b4b]">Library</h1>
      <p className="mt-2 text-slate-600">
        View and manage uploaded documents. Upload files in{" "}
        <Link
          href="/frontier/pilots/admin/documents"
          className="font-medium text-emerald-800 underline-offset-2 hover:text-emerald-950 hover:underline"
        >
          Admin → Uploads
        </Link>
        .
      </p>

      {loading && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-3 text-slate-600">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-700" />
            <span>Loading documents…</span>
          </div>
          {slowLoad && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
              <span>Taking longer than usual.</span>
              <button
                type="button"
                onClick={() => load()}
                className="rounded border border-amber-300 bg-white px-2 py-1 text-amber-900 hover:bg-amber-100"
              >
                Retry now
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm text-red-800 hover:bg-red-50 disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      )}

      {docs.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleIndex}
              disabled={indexing}
              className="rounded-xl border border-emerald-700/35 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 shadow-sm hover:bg-emerald-100 disabled:opacity-50"
            >
              {indexing ? "Enabling…" : "Enable AI Questions"}
            </button>
            {indexResult?.success && (
              <span className="text-sm font-medium text-emerald-800">{indexResult.success}</span>
            )}
          </div>
          {indexing && (
            <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
              <LoaderBar percent={indexPercent} />
              <div className="flex items-center justify-between text-sm text-slate-600">
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
              {indexSecondsRemaining != null && indexSecondsRemaining <= 0 && indexPercent !== 100 && (
                <p className="text-xs font-medium text-amber-900">
                  Embedding documents — may take 1–2 min to finish
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {!loading && docs.length === 0 && !error && (
        <p className="mt-6 text-slate-600">
          No documents yet. Upload files in{" "}
          <Link
            href="/frontier/pilots/admin/documents"
            className="font-medium text-emerald-800 underline-offset-2 hover:text-emerald-950 hover:underline"
          >
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
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300"
            >
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <FileTypeIcon fileName={doc.name} />
                <span className="font-medium text-slate-900">{displayName(doc)}</span>
                <AccessBadge aiEnabled={aiEnabledByPath[doc.path] ?? false} surface="light" />
                <AIStatusBadge
                  status={aiStatusByPath[doc.path] ?? "not_enabled"}
                  indexing={indexing}
                  surface="light"
                />
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={aiEnabledByPath[doc.path] ?? false}
                    onChange={(e) => handleToggleAI(doc, e.target.checked)}
                    disabled={busy}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600/30"
                  />
                  AI
                </label>
                {aiEnabledByPath[doc.path] && aiStatusByPath[doc.path] === "not_enabled" && !indexing && (
                  <span className="text-xs font-medium text-amber-900">
                    Click &quot;Enable AI Questions&quot; above to make searchable
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {action.type === "rename" && action.doc?.path === doc.path ? (
                  <>
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      placeholder="New name"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={handleRename}
                      disabled={busy}
                      className="rounded-lg bg-emerald-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-900"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAction({ type: null, doc: null });
                        setRenameValue("");
                      }}
                      className="text-sm text-slate-600 hover:text-slate-900"
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
                      className="max-w-[140px] text-xs text-slate-700 file:mr-2 file:rounded file:border-0 file:bg-emerald-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-emerald-900"
                    />
                    <button
                      type="button"
                      onClick={handleReplace}
                      disabled={busy || !replaceFile}
                      className="rounded-lg bg-emerald-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-900 disabled:opacity-50"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAction({ type: null, doc: null });
                        setReplaceFile(null);
                      }}
                      className="text-sm text-slate-600 hover:text-slate-900"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDownload(doc)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAction({ type: "rename", doc });
                        setRenameValue(displayName(doc));
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => setAction({ type: "replace", doc })}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(doc)}
                      disabled={busy}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
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
