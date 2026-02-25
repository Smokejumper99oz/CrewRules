"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
];

export default function DocumentsPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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

    setUploading(true);
    try {
      const supabase = createClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${category}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage.from("documents").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      setSuccess(`Uploaded "${file.name}" to ${category}`);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="mt-2 text-slate-300">
          Upload CBA (Collective Bargaining Agreement), LOAs, training docs, memos. Supported: PDF, Word, TXT, CSV. Files upload directly to Supabase (no size limit).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-slate-950/40 p-6 space-y-4">
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
            placeholder="e.g. CBA, LOA, Training"
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
    </div>
  );
}
