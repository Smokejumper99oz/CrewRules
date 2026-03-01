"use client";

import Link from "next/link";
import { useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";

type NavItem = { label: string; href: string };
type NavGroup = { title: string; items: readonly NavItem[] };

export function PortalMobileNav({
  base,
  navGroups,
  admin,
  signOut,
  portalName,
  displayName,
  roleLabel,
}: {
  base: string;
  navGroups: readonly NavGroup[];
  admin: boolean;
  signOut: () => Promise<void>;
  portalName: string;
  displayName: string;
  roleLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 shadow-[0_0_25px_rgba(117,192,67,0.15)] touch-manipulation"
        aria-label="Open menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <aside
            className="fixed left-0 top-0 z-50 h-full w-72 bg-slate-900/85 backdrop-blur-xl border-r border-white/10 shadow-2xl ring-1 ring-white/10 md:hidden"
            role="dialog"
            aria-label="Navigation menu"
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <div className="text-lg font-semibold">
                  Crew<span className="text-[#75C043]">Rules</span>
                  <span className="align-super text-xs">™</span> · {portalName}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white touch-manipulation"
                  aria-label="Close menu"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="mx-4 h-px bg-white/10" />
              <nav className="flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-6">
                  {navGroups.map((group) => (
                    <div key={group.title}>
                      <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-300/90">
                        {group.title}
                      </h3>
                      <ul className="space-y-0.5 list-disc pl-5 marker:text-slate-400">
                        {group.items.map((item) => (
                          <li key={item.label}>
                            <Link
                              href={item.href ? `${base}/${item.href}` : base}
                              onClick={() => setOpen(false)}
                              className="block rounded-xl px-3 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition touch-manipulation min-h-[44px] flex items-center"
                            >
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="mt-6 border-t border-white/10 pt-4">
                  {admin && (
                    <Link
                      href={`${base.replace("/portal", "/admin")}`}
                      onClick={() => setOpen(false)}
                      className="mb-2 flex min-h-[44px] items-center rounded-xl px-3 py-3 text-sm text-amber-400/90 hover:bg-white/5 hover:text-amber-300 transition touch-manipulation"
                    >
                      Admin →
                    </Link>
                  )}
                  <div className="rounded-xl px-3 py-2">
                    <div className="font-medium text-white">{displayName}</div>
                    <div className="text-xs text-slate-400">{roleLabel}</div>
                  </div>
                  <SignOutButton signOut={signOut} className="mt-2">
                    <span className="flex-1">Sign Out</span>
                    <svg className="ml-auto h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </SignOutButton>
                </div>
              </nav>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
