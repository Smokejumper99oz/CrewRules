"use client";

import { useState, useCallback } from "react";
import { formatLastImport } from "@/components/schedule-status-chip";
import { Copy, Check } from "lucide-react";

export function ConnectFlicaSection({
  inboundEmail,
  scheduleStatus,
}: {
  inboundEmail: string | null;
  scheduleStatus: { count: number; lastImportedAt: string | null };
}) {
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
  const steps = [
    "Copy your CrewRules import email",
    "Open FLICA or ELP settings",
    "Add this email to your schedule distribution list",
    "Your schedule will sync automatically when updates are sent",
  ];

  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6 dark:border-white/5 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-900/60 dark:to-slate-950/80 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="mb-6 border-b border-slate-200 pb-4 dark:border-white/10">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-snug text-slate-900 sm:text-lg dark:text-white flex flex-wrap items-center gap-2">
            <span>Connect FLICA (Auto Sync)</span>
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-fuchsia-500/20 text-fuchsia-700 border border-fuchsia-500/40 dark:text-fuchsia-400">
              BETA
            </span>
          </h2>
          <p className="mt-2 text-sm font-semibold leading-snug text-slate-800 dark:text-slate-200">
            Connect your schedule automatically
          </p>
          <p className="mt-1 text-pretty text-sm leading-relaxed text-slate-600 [overflow-wrap:anywhere] dark:text-slate-400">
            CrewRules syncs your schedule automatically by receiving updates from FLICA or ELP. Set this up once and your
            schedule will always stay up to date.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <section
          className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]"
          aria-labelledby="flica-status-heading"
        >
          <div className="border-b border-slate-200/80 pb-3 dark:border-white/10">
            <h3
              id="flica-status-heading"
              className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white"
            >
              Status
            </h3>
          </div>
          <div className="mt-4">
            <div className="rounded-lg border border-slate-200/80 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-slate-900/35">
              {hasSchedule ? (
                <p className="text-sm text-emerald-700 flex items-center gap-2 dark:text-emerald-300">
                  <span aria-hidden>✅</span>
                  <span>
                    Connected
                    {scheduleStatus.lastImportedAt && (
                      <> (Last updated: {formatLastImport(scheduleStatus.lastImportedAt)})</>
                    )}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-amber-700 flex items-center gap-2 dark:text-amber-400">
                  <span aria-hidden>⚠️</span>
                  <span>Not connected yet</span>
                </p>
              )}
            </div>
          </div>
        </section>

        {inboundEmail ? (
          <>
            <section
              className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]"
              aria-labelledby="flica-import-email-heading"
            >
              <div className="border-b border-slate-200/80 pb-3 dark:border-white/10">
                <h3
                  id="flica-import-email-heading"
                  className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white"
                >
                  Import email
                </h3>
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-3">
                  Your CrewRules import email
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
                  <div className="min-w-0 flex-1 rounded-lg border border-[#75C043]/50 bg-white px-4 py-3 shadow-sm dark:border-[#75C043]/40 dark:bg-slate-950/60">
                    <p className="text-base font-mono text-slate-900 break-all dark:text-white">{inboundEmail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#75C043] px-5 py-3 text-sm font-semibold text-slate-950 hover:opacity-95 active:opacity-90 transition min-h-11 touch-manipulation sm:self-center sm:px-6"
                  >
                    {copied ? (
                      <>
                        <Check className="size-5" aria-hidden />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-5" aria-hidden />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>

            <section
              className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]"
              aria-labelledby="flica-steps-heading"
            >
              <div className="border-b border-slate-200/80 pb-3 dark:border-white/10">
                <h3 id="flica-steps-heading" className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
                  Setup steps
                </h3>
              </div>
              <ol className="mt-4 list-decimal list-inside space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {steps.map((step, i) => (
                  <li key={i} className="pl-0.5 [overflow-wrap:anywhere]">
                    <span className="text-slate-700 dark:text-slate-300">{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        ) : (
          <section className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Your import email will be created after your profile is saved.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
