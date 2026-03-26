"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

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
          <Link
            href="/frontier/pilots/login"
            className="ml-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
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
            <Link
              href="/frontier/pilots/login"
              className="mt-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-medium text-white hover:bg-white/10"
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
