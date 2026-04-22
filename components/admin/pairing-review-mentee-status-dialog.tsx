"use client";

import { useRef } from "react";

export type PairingReviewMenteeStatusDialogProps = {
  statusText: string;
  warn: boolean;
  isMatched: boolean;
  menteeName: string | null;
  stagedMenteeName: string | null;
  employeeNumber: string | null;
};

function statusBadgePillClass(statusText: string, warn: boolean): string {
  return `inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${
    warn
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : statusText === "Active"
        ? "border-emerald-300 bg-emerald-50 text-emerald-900"
        : "border-slate-200 bg-slate-100 text-slate-700"
  }`;
}

function statusExplanation(statusText: string): string {
  switch (statusText) {
    case "Active":
      return "This mentee is linked to a CrewRules™ account and is active.";
    case "Awaiting Sign-Up":
      return "This mentee is assigned to an active CrewRules™ mentor but has not signed up for CrewRules™ yet.";
    case "Inactive":
      return "This mentee is linked but currently inactive.";
    case "Unmatched":
      return "This assignment does not yet have a complete mentee record.";
    default:
      return "Status details for this assignment are not available.";
  }
}

export function PairingReviewMenteeStatusDialog({
  statusText,
  warn,
  isMatched,
  menteeName,
  stagedMenteeName,
  employeeNumber,
}: PairingReviewMenteeStatusDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pillClass = statusBadgePillClass(statusText, warn);
  const menteeVisible =
    (isMatched ? menteeName : stagedMenteeName)?.trim() || "—";
  const empTrimmed = employeeNumber?.trim() || null;
  const showEmployeeRow = Boolean(empTrimmed);

  return (
    <>
      <button
        type="button"
        className={`${pillClass} cursor-pointer`}
        aria-label={`Mentee status: ${statusText}. Open details.`}
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        {statusText}
      </button>
      <dialog
        ref={dialogRef}
        className="max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-sm text-slate-700 shadow-lg open:backdrop:bg-slate-900/40 [&::backdrop]:bg-slate-900/40"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <header className="border-b border-slate-200 bg-slate-100 px-5 py-3.5">
          <h2 className="text-base font-semibold tracking-tight text-[#1a2b4b]">Mentee Status</h2>
        </header>
        <div className="space-y-3 px-5 pb-1 pt-4">
          <p className="text-sm leading-relaxed text-slate-700">{statusExplanation(statusText)}</p>
          <div className="space-y-2.5 border-t border-slate-100 pt-3">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="shrink-0 font-medium text-slate-800">Mentee Name:</span>
              <span className="min-w-0 text-right font-normal text-slate-700">{menteeVisible}</span>
            </div>
            {showEmployeeRow ? (
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <span className="shrink-0 font-medium text-slate-800">Mentee Employee #:</span>
                <span className="min-w-0 text-right font-normal text-slate-700">{empTrimmed}</span>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex justify-end px-5 pb-5 pt-3">
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => dialogRef.current?.close()}
          >
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
