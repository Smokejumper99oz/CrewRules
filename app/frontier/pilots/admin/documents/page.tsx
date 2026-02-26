"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { indexDocuments } from "./index-actions";
import { checkDuplicateDocument } from "./actions";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
];

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

export default function DocumentsPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [indexSuccess, setIndexSuccess] = useState<string | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [indexPercent, setIndexPercent] = useState<number | null>(null);

  async function handleIndex() {
    setIndexError(null);
    setIndexSuccess(null);
    setIndexing(true);
    setIndexPercent(0);
    // Simulated progress: advances to ~90% over ~12s to show activity
    const interval = setInterval(() => {
      setIndexPercent((p) => (p == null ? 5 : Math.min(90, p + 8)));
    }, 1500);
    const result = await indexDocuments();
    clearInterval(interval);
    setIndexPercent(100);
    await new Promise((r) => setTimeout(r, 300)); // brief 100% before hiding
    setIndexing(false);
    setIndexPercent(null);
    if (result.error) setIndexError(result.error);
    if (result.success) setIndexSuccess(result.success);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const form = e.currentTarget;
    const fileInput = form.querySelector<HTMLInputElement>('input[name="file"]');
    const categoryInput = form.querySelector<HTMLInputElement>('input[name="category"]');
    const file = fileInput?.files?.[0];
    const category = (categoryInput?.value?.trim() || "general").toLowerCase().replace(/\s+/g, "-") || "general";

    if (!file || file.size === 0) {
      setError("Please select a file");
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("File type not allowed. Use PDF, Word (.doc, .docx), TXT, or CSV.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError("File size must be under 50 MB");
      return;
    }

    const { duplicate } = await checkDuplicateDocument(category, file.name);
    if (duplicate) {
      const displayCategory = category.split("-").map((p) => p.toUpperCase()).join(" ");
      setError(`This file already exists in ${displayCategory}. Use Replace in Library to update it.`);
      return;
    }

    setUploading(true);
    setUploadingFileName(file.name);
    setUploadPercent(0);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Not signed in");
        return;
      }
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
      const projectId = new URL(url).hostname.split(".")[0];
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${category}/${Date.now()}_${category}_${safeName}`;

      const { Upload } = await import("tus-js-client");
      await new Promise<void>((resolve, reject) => {
        const upload = new Upload(file, {
          endpoint: `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`,
          retryDelays: [0, 3000, 5000],
          headers: {
            authorization: `Bearer ${session.access_token}`,
            "x-upsert": "false",
          },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          metadata: {
            bucketName: "documents",
            objectName: path,
            contentType: file.type,
            cacheControl: "3600",
          },
          chunkSize: 6 * 1024 * 1024,
          onError: (err) => reject(err),
          onProgress: (bytesUploaded, bytesTotal) => {
            const pct = bytesTotal > 0 ? (bytesUploaded / bytesTotal) * 100 : 0;
            setUploadPercent(Math.round(pct));
          },
          onSuccess: () => resolve(),
        });
        upload.findPreviousUploads().then((prev) => {
          if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
          upload.start();
        }).catch(reject);
      });

      const base = file.name.replace(/_/g, " ").replace(/\s+/g, " ").trim();
      const withoutExt = base.includes(".") ? base.replace(/\.[^.]+$/, "") : base;
      const displayCategory = category.split("-").map((p) => p.toUpperCase()).join(" ");
      setSuccess(`${withoutExt} added to ${displayCategory}.`);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadingFileName(null);
      setUploadPercent(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold">Uploads</h1>
        <p className="mt-2 text-slate-300">
          Upload CBA (Collective Bargaining Agreement), LOAs, training docs, memos. Supported: PDF, Word, TXT, CSV. Upload files, then click Index to make them searchable.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-slate-950/40 p-6 space-y-4">
        {uploading && (
          <div className="rounded-xl border border-[#75C043]/20 bg-[#75C043]/5 p-4 space-y-2">
            <LoaderBar percent={uploadPercent} />
            <p className="text-sm text-slate-300">
              Uploading {uploadingFileName}… {uploadPercent != null ? `${uploadPercent}%` : ""}
            </p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-200">File</label>
          <input
            name="file"
            type="file"
            required
            accept=".pdf,.doc,.docx,.txt,.csv"
            disabled={uploading}
            className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-[#75C043] file:px-4 file:py-2 file:font-semibold file:text-slate-950 file:hover:opacity-90 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-200">Category (optional)</label>
          <input
            name="category"
            type="text"
            placeholder="CBA"
            disabled={uploading}
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/40 disabled:opacity-50"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">{success}</p>}

        <button
          type="submit"
          disabled={uploading}
          className="rounded-xl bg-[#75C043] px-5 py-3 font-semibold text-slate-950 hover:opacity-95 transition disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </form>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="text-sm font-medium text-emerald-200">Try Ask AI with CBA</p>
          <ol className="mt-2 list-decimal list-inside space-y-1 text-sm text-slate-300">
            <li>Upload your CBA (PDF or Word) — use category <strong>CBA</strong></li>
            <li>Click <strong>Index Documents for AI Search</strong> below</li>
            <li>Go to Portal → Ask to search your contract</li>
          </ol>
        </div>
        <div className="mt-4 space-y-3">
          {indexing && (
            <div className="space-y-2">
              <LoaderBar percent={indexPercent} />
              <p className="text-sm text-slate-300">
                Indexing documents for AI search… {indexPercent != null ? `${indexPercent}%` : ""}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={handleIndex}
            disabled={indexing}
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {indexing ? "Indexing…" : "Index Documents for AI Search"}
          </button>
          {indexError && <p className="text-sm text-red-400">{indexError}</p>}
          {indexSuccess && <p className="text-sm text-emerald-400">{indexSuccess}</p>}
          <p className="mt-2 text-sm text-slate-400">
            View and manage documents in{" "}
            <Link href="/frontier/pilots/admin/library" className="text-[#75C043] hover:underline">
              Admin → Library
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
