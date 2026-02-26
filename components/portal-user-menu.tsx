"use client";

import { useState, useRef, useEffect } from "react";

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
  role,
  signOut,
}: {
  email: string | null;
  role: "admin" | "member";
  signOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const displayName = emailToDisplayName(email);
  const roleLabel = role === "admin" ? "System Administrator" : "Member";

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
        className="flex items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-white/5 transition touch-manipulation min-h-[44px]"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="User menu"
      >
        <div className="h-9 w-9 shrink-0 rounded-xl bg-white/5 ring-1 ring-white/10 flex items-center justify-center text-sm font-semibold text-slate-300">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="hidden min-w-0 sm:block">
          <div className="truncate text-sm font-medium text-white">{displayName}</div>
          <div className="truncate text-xs text-slate-400">{roleLabel}</div>
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
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/10 bg-slate-900 shadow-xl"
          role="menu"
        >
          <div className="p-4">
            <div className="font-medium text-white">{displayName}</div>
            <div className="mt-0.5 text-sm text-slate-400">{roleLabel}</div>
          </div>
          <div className="border-t border-white/10 p-2">
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-white/5 transition touch-manipulation"
                role="menuitem"
              >
                <span className="flex-1">Sign Out</span>
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
