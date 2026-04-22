"use client";

import { useRef } from "react";

export type PairingReviewMentorContactHealthDialogProps = {
  mentorContactOk: boolean;
  mentorName: string | null;
  mentorContactEmail: string | null;
  mentorPhone: string | null;
  mentorProfilePhone: string | null;
};

/** Same display or same digits (handles formatting differences). */
function phonesAreEquivalent(a: string | null, b: string | null): boolean {
  const at = a?.trim() ?? "";
  const bt = b?.trim() ?? "";
  if (!at || !bt) return false;
  if (at === bt) return true;
  const digitsA = at.replace(/\D/g, "");
  const digitsB = bt.replace(/\D/g, "");
  return digitsA.length > 0 && digitsA === digitsB;
}

export function PairingReviewMentorContactHealthDialog({
  mentorContactOk,
  mentorName,
  mentorContactEmail,
  mentorPhone,
  mentorProfilePhone,
}: PairingReviewMentorContactHealthDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const pillClass = `inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${
    mentorContactOk
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : "border-amber-300 bg-amber-50 text-amber-900"
  }`;

  const profilePhoneTrimmed = mentorProfilePhone?.trim() || null;
  const mentorEmailTrimmed = mentorContactEmail?.trim() || null;
  const mentorPhoneTrimmed = mentorPhone?.trim() || null;
  const hasContactEmail = Boolean(mentorEmailTrimmed);
  const hasMentorPhone = Boolean(mentorPhoneTrimmed);
  /** Both mentoring contact fields empty — distinct from partial (exactly one set). */
  const contactNothingMissing = !hasContactEmail && !hasMentorPhone;
  const showProfilePhoneRow =
    Boolean(profilePhoneTrimmed) && !phonesAreEquivalent(mentorPhoneTrimmed, profilePhoneTrimmed);

  return (
    <>
      <button
        type="button"
        className={`${pillClass} cursor-pointer`}
        aria-label="View mentor contact details"
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
      >
        {mentorContactOk ? "OK" : "Missing"}
      </button>
      <dialog
        ref={dialogRef}
        className="max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white p-0 text-sm text-slate-700 shadow-lg open:backdrop:bg-slate-900/40 [&::backdrop]:bg-slate-900/40"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <header className="border-b border-slate-200 bg-slate-100 px-5 py-3.5">
          <h2 className="text-base font-semibold tracking-tight text-[#1a2b4b]">Mentor Contact</h2>
        </header>
        <div className="space-y-2.5 px-5 pb-1 pt-4">
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="shrink-0 font-medium text-slate-800">Mentor:</span>
            <span className="min-w-0 text-right font-normal text-slate-700">{mentorName?.trim() || "—"}</span>
          </div>
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="shrink-0 font-medium text-slate-800">Email:</span>
            <span
              className={
                hasContactEmail
                  ? "min-w-0 max-w-[14rem] break-all text-right font-normal text-slate-700 sm:max-w-[16rem]"
                  : "text-right font-normal text-slate-500"
              }
            >
              {hasContactEmail ? mentorEmailTrimmed : "Missing"}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="shrink-0 font-medium text-slate-800">Phone:</span>
            <span
              className={
                hasMentorPhone
                  ? "min-w-0 text-right font-normal text-slate-700"
                  : "text-right font-normal text-slate-500"
              }
            >
              {hasMentorPhone ? mentorPhoneTrimmed : "Missing"}
            </span>
          </div>
          {showProfilePhoneRow ? (
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="shrink-0 font-medium text-slate-800">Profile Phone No.:</span>
              <span className="min-w-0 text-right font-normal text-slate-700">{profilePhoneTrimmed}</span>
            </div>
          ) : null}
          <div className="pt-2 border-t border-slate-100 mt-3">
            {mentorContactOk ? (
              <span className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900">
                Mentor can be contacted.
              </span>
            ) : contactNothingMissing ? (
              <span className="inline-flex rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-900">
                Mentor cannot be contacted yet.
              </span>
            ) : (
              <span className="inline-flex rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900">
                Mentor contact is incomplete.
              </span>
            )}
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
