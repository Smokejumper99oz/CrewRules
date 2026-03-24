"use client";

import { useState, useRef, useEffect } from "react";
import { SignOutButton } from "@/components/sign-out-button";

type SuperAdminUserMenuProps = {
  displayName: string;
  signOut: () => Promise<void>;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] ?? "").toUpperCase() + (parts[parts.length - 1][0] ?? "").toUpperCase();
  }
  if (parts[0]?.length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "?";
}

export function SuperAdminUserMenu({ displayName, signOut }: SuperAdminUserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const initials = getInitials(displayName);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-800/80 transition touch-manipulation min-h-[44px] border border-slate-600/50 bg-slate-800/50"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="User menu"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-700/80 text-sm font-medium text-slate-200 border border-slate-600/50">
          {initials}
        </div>
        <div className="hidden min-w-0 space-y-0.5 sm:block text-left">
          <div className="truncate text-sm font-medium text-slate-200">{displayName}</div>
          <div className="truncate text-xs text-slate-400">Platform Owner</div>
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
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-slate-600/50 bg-slate-800 shadow-xl"
          role="menu"
        >
          <div className="p-4 border-b border-slate-700/50">
            <div className="font-medium text-slate-200">{displayName}</div>
            <div className="mt-0.5 text-sm text-slate-400">Platform Owner</div>
          </div>
          <div className="p-2">
            <SignOutButton
              signOut={signOut}
              buttonClassName="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 transition touch-manipulation disabled:opacity-50"
              role="menuitem"
            >
              <span className="flex-1">Sign Out</span>
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </SignOutButton>
          </div>
        </div>
      )}
    </div>
  );
}
