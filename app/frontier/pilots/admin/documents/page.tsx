"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { indexDocuments } from "./index-actions";
import { checkDuplicateDocument, setDocumentAISetting, setDocumentDisplayName } from "./actions";
import { sanitizeDisplayNameForPath } from "@/lib/document-utils";

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
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
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
    const fileNameInput = form.querySelector<HTMLInputElement>('input[name="file_name"]');
    const categoryInput = form.querySelector<HTMLInputElement>('input[name="category"]');
    const aiCheckbox = form.querySelector<HTMLInputElement>('input[name="ai_enabled"]');
    const file = fileInput?.files?.[0];
    const fileDisplayName = (fileNameInput?.value ?? "").trim();
    const category = (categoryInput?.value?.trim() || "general").toLowerCase().replace(/\s+/g, "-") || "general";
    const makeAvailableForAI = aiCheckbox?.checked ?? false;

    if (!file || file.size === 0) {
      setError("Please select a file");
      return;
    }

    if (!fileDisplayName) {
      setError("File name is required");
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

    const { duplicate } = await checkDuplicateDocument(category, file.name, fileDisplayName);
    if (duplicate) {
      const displayCategory = category.split("-").map((p) => p.toUpperCase()).join(" ");
      setError(`A document named "${fileDisplayName}" already exists in ${displayCategory}. Use Replace in Library to update it.`);
      return;
    }

    setUploading(true);
    setUploadingFileName(fileDisplayName);
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
      const ext = file.name.includes(".") ? "." + file.name.split(".").pop() : "";
      const safeName = sanitizeDisplayNameForPath(fileDisplayName) + ext;
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

      await setDocumentAISetting(path, makeAvailableForAI);
      const { error: dnError } = await setDocumentDisplayName(path, fileDisplayName);
      if (dnError) console.warn("[Upload] Display name save:", dnError);

      const displayCategory = category.split("-").map((p) => p.toUpperCase()).join(" ");
      setSuccess(`${fileDisplayName} added to ${displayCategory}.`);
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
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight border-b border-slate-200 pb-2 text-[#1a2b4b]">Uploads</h1>
        <p className="mt-2 text-slate-600">
          Upload documents for pilot access. AI usage is optional.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        {uploading && (
          <div className="rounded-xl border border-[#75C043]/20 bg-[#75C043]/5 p-4 space-y-2">
            <LoaderBar percent={uploadPercent} />
            <p className="text-sm text-slate-600">
              Uploading {uploadingFileName}… {uploadPercent != null ? `${uploadPercent}%` : ""}
            </p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700">File</label>
          <input
            name="file"
            type="file"
            required
            accept=".pdf,.doc,.docx,.txt,.csv"
            disabled={uploading}
            className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 file:mr-4 file:rounded-lg file:border-0 file:bg-[#75C043] file:px-4 file:py-2 file:font-semibold file:text-slate-950 file:hover:opacity-90 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">File name</label>
          <input
            name="file_name"
            type="text"
            required
            placeholder="e.g. Frontier Airlines CBA"
            disabled={uploading}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none focus:border-[#75C043]/50 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Document category (optional)</label>
          <input
            name="category"
            type="text"
            placeholder="Used to organize documents in the Library (CBA, LOA, Training, Memo)"
            disabled={uploading}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-500 outline-none focus:border-[#75C043]/50 disabled:opacity-50"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-sm font-medium text-slate-800">AI Access</p>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
            <input
              name="ai_enabled"
              type="checkbox"
              defaultChecked={false}
              disabled={uploading}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 bg-white text-[#75C043] focus:ring-[#75C043]/50"
            />
            <span>
              Allow CrewRules AI to reference this document
            </span>
          </label>
          <p className="mt-2 text-xs text-slate-500">
            When enabled, this document may be used to answer pilot questions. When disabled, the document is download-only.
          </p>
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

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-3">
          {indexing && (
            <div className="space-y-2">
              <LoaderBar percent={indexPercent} />
              <p className="text-sm text-slate-600">
                Indexing documents for AI search… {indexPercent != null ? `${indexPercent}%` : ""}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={handleIndex}
            disabled={indexing}
            className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
          >
            {indexing ? "Enabling…" : "Enable AI Questions"}
          </button>
          {indexError && <p className="text-sm text-red-400">{indexError}</p>}
          {indexSuccess && <p className="text-sm text-emerald-400">{indexSuccess}</p>}
          <p className="mt-2 text-sm text-slate-600">
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
