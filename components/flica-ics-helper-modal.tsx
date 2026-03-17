"use client";

import { FlicaIcsHelper } from "@/components/flica-ics-helper";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function FlicaIcsHelperModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed left-4 right-4 top-4 bottom-4 z-50 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-xl sm:left-1/2 sm:right-auto sm:top-[10%] sm:bottom-[10%] sm:w-full sm:max-w-[900px] sm:-translate-x-1/2"
        role="dialog"
        aria-labelledby="flica-helper-modal-title"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 id="flica-helper-modal-title" className="text-lg font-semibold text-white">
            FLICA ICS Import Guide
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white transition"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <FlicaIcsHelper />
        </div>
      </div>
    </>
  );
}
