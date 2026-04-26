"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Copy, Check } from "lucide-react";
import { formatLastImport } from "@/components/schedule-status-chip";

type Props = {
  inboundEmail: string | null;
  scheduleStatus: { count: number; lastImportedAt: string | null };
  portalPath: string;
};

const STEPS = [
  "Copy your CrewRules™ email",
  "Add it in FLICA or ELP schedule email settings",
  "You're done — CrewRules™ will sync automatically",
];

export function ConnectFlicaOnboarding({ inboundEmail, scheduleStatus, portalPath }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!inboundEmail) return;
    try {
      await navigator.clipboard.writeText(inboundEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [inboundEmail]);

  const hasSchedule = scheduleStatus.count > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Status indicator */}
      <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
        {hasSchedule ? (
          <p className="text-sm text-emerald-300">
            Connected • Last updated {scheduleStatus.lastImportedAt ? formatLastImport(scheduleStatus.lastImportedAt) : "—"}
          </p>
        ) : (
          <p className="text-sm text-amber-400">Not connected yet</p>
        )}
      </div>

      {inboundEmail ? (
        <>
          {/* Email display */}
          <div className="rounded-xl border border-[#75C043]/40 bg-slate-950/60 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
              Your CrewRules™ import email
            </p>
            <p className="text-base font-mono text-white break-all">{inboundEmail}</p>
          </div>

          {/* Instructions */}
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-400">
            {STEPS.map((step, i) => (
              <li key={i}>
                <span className="text-slate-300">{step}</span>
              </li>
            ))}
          </ol>

          {/* Buttons */}
          <div className="flex flex-col gap-3 pt-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#75C043] px-6 py-4 text-base font-semibold text-slate-950 hover:opacity-95 active:opacity-90 transition min-h-[48px] touch-manipulation"
            >
              {copied ? (
                <>
                  <Check className="size-5" aria-hidden />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-5" aria-hidden />
                  <span>Copy Email</span>
                </>
              )}
            </button>
            <Link
              href={portalPath}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-4 text-base font-medium text-slate-300 hover:bg-white/10 hover:text-white transition min-h-[48px] touch-manipulation"
            >
              Continue to Dashboard
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            Your import email is being created. You can set this up later from Profile → Connect FLICA.
          </p>
          <Link
            href={portalPath}
            className="flex items-center justify-center rounded-xl bg-[#75C043] px-6 py-4 text-base font-semibold text-slate-950 hover:opacity-95 transition min-h-[48px] touch-manipulation"
          >
            Continue to Dashboard
          </Link>
        </>
      )}
    </div>
  );
}
