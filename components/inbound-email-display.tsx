"use client";

import { useState } from "react";

type Props = {
  email: string;
  /** When "schedule", renders label above + email pill + Copy. Optional suffix (e.g. status chip) rendered inline. */
  variant?: "default" | "schedule";
  /** Rendered on same row as email+Copy when variant=schedule. Wraps below on smaller screens. */
  suffix?: React.ReactNode;
};

export function InboundEmailDisplay({ email, variant = "default", suffix }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (variant === "schedule") {
    return (
      <div className="space-y-1.5">
        <span className="text-xs text-slate-500">Schedule Import Email</span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm font-mono text-slate-200">
            {email}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          {suffix}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-4">
      <div className="text-xs text-slate-500 flex-1 min-w-0">
        <span className="text-slate-400">Schedule Import:</span>{" "}
        <span className="text-slate-300 font-mono truncate block sm:inline">{email}</span>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 px-2 py-1 text-xs rounded border border-slate-600 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
