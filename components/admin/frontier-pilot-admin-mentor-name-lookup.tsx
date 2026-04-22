"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import {
  runFrontierPilotAdminMentorNameLookup,
  type MentorNameLookupFormState,
} from "@/app/frontier/pilots/admin/mentoring/actions";
import {
  formatMentorNameLookupEmployeeNumbersCopy,
  formatMentorNameLookupNameAndNumberCopy,
} from "@/lib/mentoring/mentor-name-lookup";

const initial: MentorNameLookupFormState = { error: null, rows: [] };

const COPY_FEEDBACK_MS = 2000;

/** Must stay in sync with `runMentorNameLookup` duplicate suffix in `lib/mentoring/mentor-name-lookup.ts`. */
const LOOKUP_STATUS_DUPLICATE_SUFFIX = " · Duplicate input";

type CopyButtonFeedback = "idle" | "success" | "error";

function lookupStatusBadgeClassName(baseLabel: string): string {
  switch (baseLabel) {
    case "Matched":
      return "border border-emerald-400 bg-emerald-100 text-emerald-900";
    case "Possible match":
      return "border border-amber-400 bg-amber-100 text-amber-950";
    case "Review":
      return "border border-slate-300 bg-amber-50 text-amber-950";
    case "Unknown":
      return "border border-slate-200 bg-slate-100 text-slate-600";
    default:
      return "border border-slate-200 bg-slate-100 text-slate-700";
  }
}

function MentorLookupStatusCell({ status }: { status: string }) {
  const hasDuplicateNote = status.endsWith(LOOKUP_STATUS_DUPLICATE_SUFFIX);
  const baseLabel = hasDuplicateNote
    ? status.slice(0, -LOOKUP_STATUS_DUPLICATE_SUFFIX.length)
    : status;
  /** Mirrors server `runMentorNameLookup` duplicate suffix; UI-only, no logic change. */
  const showDuplicateBadge = status.includes("Duplicate input");

  /** Shared width for Matched / Possible match / Unknown so the status column aligns. */
  const uniformStatusPillW =
    baseLabel === "Matched" ||
    baseLabel === "Possible match" ||
    baseLabel === "Unknown"
      ? "w-[7.375rem] shrink-0 justify-center"
      : "";

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span
        className={[
          "inline-flex max-w-full items-center rounded-md px-2.5 py-1 text-xs font-semibold leading-tight",
          uniformStatusPillW,
          lookupStatusBadgeClassName(baseLabel),
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {baseLabel}
      </span>
      {showDuplicateBadge ? (
        <span
          title="This name appears more than once in your input"
          className="inline-flex shrink-0 items-center gap-0.5 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-normal text-amber-700"
        >
          <span aria-hidden>⚠</span>
          Duplicate
        </span>
      ) : null}
    </div>
  );
}

export function FrontierPilotAdminMentorNameLookup() {
  const [state, formAction, isPending] = useActionState(runFrontierPilotAdminMentorNameLookup, initial);

  const [copyEmployeeNumbersFeedback, setCopyEmployeeNumbersFeedback] = useState<CopyButtonFeedback>("idle");
  const [copyNamePlusNumberFeedback, setCopyNamePlusNumberFeedback] = useState<CopyButtonFeedback>("idle");

  const copyEmployeeNumbersTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyNamePlusNumberTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyEmployeeNumbersTimerRef.current) clearTimeout(copyEmployeeNumbersTimerRef.current);
      if (copyNamePlusNumberTimerRef.current) clearTimeout(copyNamePlusNumberTimerRef.current);
    };
  }, []);

  const copyNumbers = useCallback(async () => {
    if (state.rows.length === 0) return;
    if (copyEmployeeNumbersTimerRef.current) {
      clearTimeout(copyEmployeeNumbersTimerRef.current);
      copyEmployeeNumbersTimerRef.current = null;
    }
    try {
      const text = formatMentorNameLookupEmployeeNumbersCopy(state.rows);
      await navigator.clipboard.writeText(text);
      setCopyEmployeeNumbersFeedback("success");
    } catch {
      setCopyEmployeeNumbersFeedback("error");
    }
    copyEmployeeNumbersTimerRef.current = setTimeout(() => {
      setCopyEmployeeNumbersFeedback("idle");
      copyEmployeeNumbersTimerRef.current = null;
    }, COPY_FEEDBACK_MS);
  }, [state.rows]);

  const copyNameAndNumber = useCallback(async () => {
    if (state.rows.length === 0) return;
    if (copyNamePlusNumberTimerRef.current) {
      clearTimeout(copyNamePlusNumberTimerRef.current);
      copyNamePlusNumberTimerRef.current = null;
    }
    try {
      const text = formatMentorNameLookupNameAndNumberCopy(state.rows);
      await navigator.clipboard.writeText(text);
      setCopyNamePlusNumberFeedback("success");
    } catch {
      setCopyNamePlusNumberFeedback("error");
    }
    copyNamePlusNumberTimerRef.current = setTimeout(() => {
      setCopyNamePlusNumberFeedback("idle");
      copyNamePlusNumberTimerRef.current = null;
    }, COPY_FEEDBACK_MS);
  }, [state.rows]);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-3">
        <div>
          <label htmlFor="mentor-name-lookup-names" className="mb-1.5 block text-sm font-medium text-slate-800">
            First and Last Name (One per line)
          </label>
          <textarea
            id="mentor-name-lookup-names"
            name="names"
            rows={12}
            disabled={isPending}
            placeholder="Paste names here…"
            className="block w-full max-w-3xl rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-[#75C043] focus:outline-none focus:ring-2 focus:ring-[#75C043]/30 disabled:opacity-50"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            {isPending ? "Looking up…" : "Run Lookup"}
          </button>
          <button
            type="button"
            disabled={isPending || state.rows.length === 0}
            onClick={() => void copyNumbers()}
            className="inline-flex h-9 min-w-[14.5rem] items-center justify-center rounded-md border border-transparent bg-[#75C043] px-4 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:opacity-50"
          >
            {copyEmployeeNumbersFeedback === "success"
              ? "Copied Employee Numbers"
              : copyEmployeeNumbersFeedback === "error"
                ? "Copy failed"
                : "Copy Employee Numbers"}
          </button>
          <button
            type="button"
            disabled={isPending || state.rows.length === 0}
            onClick={() => void copyNameAndNumber()}
            className="inline-flex h-9 min-w-[14.5rem] items-center justify-center rounded-md border border-sky-200 bg-sky-50 px-4 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-sky-100 disabled:opacity-50"
          >
            {copyNamePlusNumberFeedback === "success"
              ? "Copied Name & Employee Numbers"
              : copyNamePlusNumberFeedback === "error"
                ? "Copy failed"
                : "Copy Name & Employee Numbers"}
          </button>
        </div>
      </form>

      {state.error ? (
        <p className="text-sm font-medium text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}

      {state.rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-3 py-2.5 font-semibold text-slate-800">
                  Entered Name
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold text-slate-800">
                  Matched Name
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold text-slate-800">
                  Employee #
                </th>
                <th scope="col" className="px-3 py-2.5 font-semibold text-slate-800">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.rows.map((r, i) => (
                <tr key={i} className="bg-white">
                  <td className="whitespace-pre-wrap px-3 py-2 text-slate-900">{r.enteredName || "—"}</td>
                  <td className="whitespace-pre-wrap px-3 py-2 text-slate-900">{r.matchedName ?? "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-900">{r.employeeNumber}</td>
                  <td className="px-3 py-2 align-middle text-slate-800">
                    <MentorLookupStatusCell status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
