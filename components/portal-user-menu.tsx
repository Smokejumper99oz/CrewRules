"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { FOUNDING_PILOT_CAP } from "@/lib/founding-pilot-constants";

const DEFAULT_PROFILE_HREF = "/frontier/pilots/portal/settings/account";

function emailToDisplayName(email: string | null): string {
  if (!email) return "User";
  const local = email.split("@")[0] || "";
  return local
    .split(/[._-]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(" ") || email;
}

export function PortalUserMenu({
  email,
  roleLabel,
  signOut,
  profileHref = DEFAULT_PROFILE_HREF,
  isFoundingPilot = false,
  foundingPilotNumber = null,
}: {
  email: string | null;
  roleLabel: string;
  signOut: () => Promise<void>;
  /** Pilot portal account vs Frontier pilot admin profile. */
  profileHref?: string;
  isFoundingPilot?: boolean;
  foundingPilotNumber?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const displayName = emailToDisplayName(email);
  const foundingLine =
    foundingPilotNumber != null
      ? `Founding Pilot · #${foundingPilotNumber} of ${FOUNDING_PILOT_CAP}`
      : "Founding Pilot";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-start gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-100 transition touch-manipulation min-h-[44px] dark:hover:bg-white/5"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="User menu"
      >
        <div className="relative mt-0.5 h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-[0.2rem] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_0_25px_rgba(117,192,67,0.15)]">
          <Image
            src="/icons/f9-icon.png"
            alt="Frontier Airlines"
            width={28}
            height={28}
            className="rounded-lg object-contain"
          />
        </div>
        <div className="hidden min-w-0 space-y-0.5 sm:block">
          <div className="truncate text-sm font-medium text-white">{displayName}</div>
          <div className="truncate text-xs text-slate-400">{roleLabel}</div>
          {isFoundingPilot ? (
            <div className="flex min-w-0 items-center gap-1.5">
              <Image
                src="/icons/founding-pilot-badge.png"
                alt=""
                width={14}
                height={14}
                className="h-3.5 w-3.5 shrink-0 rounded object-cover opacity-90 ring-1 ring-amber-400/25 dark:ring-amber-400/20"
              />
              <span className="min-w-0 truncate text-[11px] font-medium tracking-wide text-amber-400/85">
                {foundingLine}
              </span>
            </div>
          ) : null}
        </div>
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
          role="menu"
        >
          <div className="p-4">
            <div className="font-medium text-slate-900 dark:text-white">{displayName}</div>
            <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{roleLabel}</div>
            {isFoundingPilot ? (
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <Image
                  src="/icons/founding-pilot-badge.png"
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 shrink-0 rounded-md object-cover opacity-95 ring-1 ring-amber-500/30 dark:ring-amber-400/25"
                />
                <span className="min-w-0 truncate text-xs font-medium tracking-wide text-amber-600/95 dark:text-amber-400/85">
                  {foundingLine}
                </span>
              </div>
            ) : null}
          </div>
          <div className="border-t border-slate-200 p-2 dark:border-white/10">
            <Link
              href={profileHref}
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-white/5 transition touch-manipulation"
              onClick={() => setOpen(false)}
            >
              <span className="flex-1">Profile</span>
            </Link>
            <SignOutButton signOut={signOut} buttonClassName="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-white/5 transition touch-manipulation disabled:opacity-50" role="menuitem">
              <span className="flex-1">Sign Out</span>
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </SignOutButton>
          </div>
        </div>
      )}
    </div>
  );
}
