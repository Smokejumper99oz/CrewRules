"use client";

import { useState } from "react";

type Props = {
  email: string;
};

export function InboundEmailDisplay({ email }: Props) {
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
