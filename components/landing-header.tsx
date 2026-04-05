"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { PortalFeedbackModal } from "@/components/portal-feedback-modal";

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const closeMobile = () => {
    setMenuOpen(false);
  };

  const linkMuted = "text-sm text-slate-300 hover:text-white transition-colors";

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/30 backdrop-blur-md">
      <PortalFeedbackModal
        open={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        onSubmitted={() => {}}
        optionalPublicContactEmail
      />
      <div className="relative mx-auto flex max-w-6xl items-center justify-between px-6 pt-4 pb-6">
        <div className="flex items-center gap-3">
          <div className="leading-tight">
            <div className="text-lg font-semibold tracking-tight">
              Crew<span className="text-[#75C043]">Rules</span>
              <span className="align-super text-xs">™</span>
            </div>
            <div className="text-xs text-slate-400">For Airline Pilots & Flight Attendants</div>
          </div>
        </div>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 md:flex">
          <Link href="/contact" className={`rounded-xl px-3 py-2 ${linkMuted}`}>
            Contact Us
          </Link>
          <button
            type="button"
            onClick={() => setFeedbackModalOpen(true)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 ${linkMuted}`}
            aria-label="Send feedback"
          >
            <MessageSquare className="h-4 w-4 shrink-0 text-[#75C043]" aria-hidden />
            Feedback
          </button>
          <Link
            href="/frontier/pilots/sign-up"
            className="ml-1 inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-normal leading-tight text-white hover:bg-white/10"
          >
            Create Account
          </Link>
          <Link
            href="/frontier/pilots/login"
            className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium leading-tight text-white hover:bg-white/10"
          >
            Login
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span className="text-lg leading-none">{menuOpen ? "×" : "☰"}</span>
          </button>
        </div>
      </div>

      {/* Mobile slide-down */}
      {menuOpen ? (
        <div className="border-t border-white/5 bg-slate-950/95 px-6 py-4 backdrop-blur-md md:hidden">
          <nav className="flex flex-col gap-1">
            <Link
              href="/contact"
              className="rounded-xl px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
              onClick={closeMobile}
            >
              Contact Us
            </Link>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-white"
              aria-label="Send feedback"
              onClick={() => {
                closeMobile();
                setFeedbackModalOpen(true);
              }}
            >
              <MessageSquare className="h-4 w-4 shrink-0 text-[#75C043]" aria-hidden />
              Feedback
            </button>
            <Link
              href="/frontier/pilots/sign-up"
              className="mt-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-normal text-white hover:bg-white/10"
              onClick={closeMobile}
            >
              Create Account
            </Link>
            <Link
              href="/frontier/pilots/login"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-medium text-white hover:bg-white/10"
              onClick={closeMobile}
            >
              Login
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
