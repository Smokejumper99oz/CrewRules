"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { markWelcomeModalSeen } from "@/app/frontier/pilots/portal/profile/actions";

type Props = {
  profileBase: string;
  onDismiss: () => void;
};

export function PortalWelcomeModal({ profileBase, onDismiss }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await markWelcomeModalSeen();
    setPending(false);
    if ("success" in result && result.success) {
      onDismiss();
    } else {
      setError("Could not save your welcome status. Please try again.");
    }
  }, [pending, onDismiss]);

  const handleCompleteProfile = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await markWelcomeModalSeen();
    setPending(false);
    if ("success" in result && result.success) {
      onDismiss();
      router.push(`${profileBase}/profile`);
    } else {
      setError("Could not save your welcome status. Please try again.");
    }
  };

  const handleExploreCrewRules = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await markWelcomeModalSeen();
    setPending(false);
    if ("success" in result && result.success) {
      onDismiss();
    } else {
      setError("Could not save your welcome status. Please try again.");
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending, handleClose]);

  const isDisabled = pending;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-modal-title"
    >
      {/* No onClick on backdrop - do not dismiss on outside click */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto sidebar-scrollbar-hide rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/95 to-slate-950/95 shadow-2xl shadow-black/40 ring-1 ring-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close X - top right */}
        <button
          type="button"
          onClick={handleClose}
          disabled={isDisabled}
          className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition touch-manipulation disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          aria-label="Close"
        >
          {pending ? <Loader2 size={20} className="animate-spin" /> : <X size={20} />}
        </button>

        <div className="p-6 sm:p-8 pt-14 sm:pt-14">
          {/* Title & Subtitle */}
          <h2 id="welcome-modal-title" className="text-2xl font-bold text-white">
            Welcome to Crew<span className="text-[#75C043]">Rules</span>
            <span className="align-super text-sm">™</span>
          </h2>
          <p className="mt-1 text-slate-400">Built by airline crew, for airline crew.</p>
          <p className="mt-1 text-sm text-slate-400">
            Now onboarding pilots at <span className="font-semibold text-[#75C043]">Frontier Airlines</span>.
          </p>

          {/* Section 1: Your CrewRules™ Setup */}
          <div className="mt-8">
            <h3 className="text-base font-semibold text-white">Your Crew<span className="text-[#75C043]">Rules</span>™ Setup</h3>
            <ul className="mt-2 space-y-2 text-sm text-slate-300">
              <li className="flex gap-2">
                <span className="text-[#75C043]">•</span>
                <span>Your Home Airport powers Commute Assist™</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#75C043]">•</span>
                <span>Your Crew Base aligns duty and report times</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#75C043]">•</span>
                <span>Family View™ controls what shared viewers can see</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#75C043]">•</span>
                <span>Pay &amp; Earnings drives credit, pay, and schedule insights</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#75C043]">•</span>
                <span>AI search for FAR 117 and your CBA with fast, reliable answers</span>
              </li>
              <li className="flex gap-2">
                <span className="text-[#75C043]">•</span>
                <span>Connect your FLICA account to automatically sync your schedule</span>
              </li>
            </ul>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Your profile powers how Crew<span className="text-[#75C043]">Rules</span>™ works behind the scenes.
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">
              Once your setup is complete, Crew<span className="text-[#75C043]">Rules</span>™ keeps your schedule and commute insights up to date automatically.
            </p>
          </div>

          {/* Section 2: Two cards */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/5 p-4">
              <h4 className="text-sm font-semibold text-white">What does BETA mean?</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                BETA features are usable now and still being refined with pilot feedback.
              </p>
            </div>
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-4">
              <h4 className="text-sm font-semibold text-white">What does IN DEVELOPMENT mean?</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                IN DEVELOPMENT features are visible previews and may not be fully live yet.
              </p>
            </div>
          </div>

          {/* Founder Card */}
          <div className="mt-4 border-t border-white/5 pt-6">
            <div className="rounded-xl border border-white/10 bg-slate-900/60 px-5 py-4 text-center">
            <p className="text-sm text-slate-300">
              You&apos;re part of the early pilot group shaping Crew<span className="text-[#75C043]">Rules</span>™.
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Thanks for helping build better tools for airline crew.
            </p>
            <p className="mt-4 text-base font-normal text-slate-200">Captain Sven Folmer, M.C.A.</p>
            <p className="mt-1 text-xs text-slate-400">Founder, CrewRules™</p>
            </div>
          </div>

          {/* Error feedback */}
          {error && (
            <p className="mt-3 text-center text-sm text-red-400">{error}</p>
          )}

          {/* Buttons */}
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
            <button
              type="button"
              onClick={handleExploreCrewRules}
              disabled={isDisabled}
              className="min-h-[44px] touch-manipulation rounded-xl border border-white/10 bg-slate-800/50 px-5 py-3 text-sm font-medium text-slate-200 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] hover:border-white/20 hover:bg-slate-700/60 hover:text-white transition disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-slate-800/50 disabled:hover:border-white/10"
            >
              Explore Crew<span className="text-[#75C043]">Rules</span>™
            </button>
            <button
              type="button"
              onClick={handleCompleteProfile}
              disabled={isDisabled}
              className="min-h-[44px] touch-manipulation rounded-xl bg-[#75C043] px-5 py-3 text-sm font-semibold text-slate-950 hover:opacity-95 transition disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:opacity-60"
            >
              Complete Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
