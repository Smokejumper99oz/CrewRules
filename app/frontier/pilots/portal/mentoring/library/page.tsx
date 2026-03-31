"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  listDocuments,
  getDocumentDownloadUrl,
  type LibraryDocument,
} from "@/app/frontier/pilots/portal/library/actions";

const guideLinkClass =
  "text-sm font-medium text-[#75C043] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75C043]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950";

const sectionEyebrowClass =
  "mb-1 text-[11px] uppercase tracking-wide text-slate-500";

const MENTORING_LIBRARY_CATEGORIES = new Set([
  "mentoring-all",
  "mentoring-mentors",
  "mentoring-mentees",
]);

function filterMentoringDocuments(docs: LibraryDocument[]): LibraryDocument[] {
  return docs.filter((d) => MENTORING_LIBRARY_CATEGORIES.has(d.category));
}

function documentTitle(d: LibraryDocument): string {
  if (d.displayName?.trim()) return d.displayName.trim();
  return d.name;
}

function formatCategoryLabel(category: string): string {
  return category.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function MentoringDocumentsSection() {
  const [docs, setDocs] = useState<LibraryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { docs: list, error: err } = await listDocuments();
      if (err) {
        setError(err);
        setDocs([]);
      } else {
        setDocs(filterMentoringDocuments(list));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load documents");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDownload(doc: LibraryDocument) {
    const { url, error: err } = await getDocumentDownloadUrl(doc.path);
    if (err) {
      window.alert(err);
      return;
    }
    if (url) window.open(url, "_blank");
  }

  return (
    <section className="rounded-2xl border border-white/5 bg-slate-950/40 p-5">
      <div>
        <p className={sectionEyebrowClass}>Mentoring documents</p>
        <h2 className="text-lg font-semibold text-white">Mentoring Documents</h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        Documents and resources provided for your mentoring program.
      </p>

      {loading && (
        <div className="mt-4 flex items-center gap-3 text-sm text-slate-400">
          <div
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#75C043]/40 border-t-[#75C043]"
            aria-hidden
          />
          <span>Loading documents…</span>
        </div>
      )}

      {error && !loading && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-red-400/90">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-400/90 hover:bg-red-500/10"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && docs.length === 0 && (
        <p className="mt-4 text-sm text-slate-400">No mentoring documents available yet.</p>
      )}

      {!loading && !error && docs.length > 0 && (
        <div className="mt-4 space-y-3">
          {docs.map((doc) => (
            <div
              key={doc.path}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-gradient-to-b from-slate-900/60 to-slate-950/80 px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white [overflow-wrap:anywhere]">{documentTitle(doc)}</p>
                <p className="mt-0.5 text-xs text-slate-500">{formatCategoryLabel(doc.category)}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleDownload(doc)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/5"
              >
                Download
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function PilotPortalMentoringLibraryPage() {
  return (
    <div className="rounded-3xl border border-white/5 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Mentor Library</h1>
        <p className="mt-2 text-sm text-slate-400">
          Resources and tools to support your mentoring experience in CrewRules.
        </p>
      </div>
      <div className="mt-6 space-y-5">
        <section className="rounded-2xl border border-white/5 bg-slate-950/40 p-5">
          <div>
            <p className={sectionEyebrowClass}>Program resources</p>
            <h2 className="text-lg font-semibold text-white">Program Resources</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Core tools and guidance to help you navigate mentoring in CrewRules.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-slate-400">
            <li>Mentor Profile (how mentees see you)</li>
            <li>CrewRules mentoring features overview</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
            <Link href="/frontier/pilots/portal/mentoring/profile" className={guideLinkClass}>
              View Mentor Profile
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-white/5 bg-slate-950/40 p-5">
          <div>
            <p className={sectionEyebrowClass}>CrewRules tools</p>
            <h2 className="text-lg font-semibold text-white">CrewRules Tools</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Access the main tools available to pilots within CrewRules.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-slate-400">
            <li>Pilot Library with documents and resources</li>
            <li>Weather Brief and operational tools</li>
            <li>Schedule and Family View features</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
            <Link href="/frontier/pilots/portal/library" className={guideLinkClass}>
              Open Pilot Library
            </Link>
          </div>
        </section>

        <MentoringDocumentsSection />

        <section className="rounded-2xl border border-white/5 bg-slate-950/40 p-5">
          <div>
            <p className={sectionEyebrowClass}>Additional resources</p>
            <h2 className="text-lg font-semibold text-white">Additional Resources</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            More resources and documents will be available here as the mentoring program expands.
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-slate-400">
            <li>Future mentoring PDFs and documents</li>
            <li>Admin-provided guidance and updates</li>
            <li>Role-specific mentoring resources</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
