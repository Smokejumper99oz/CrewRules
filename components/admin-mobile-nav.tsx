"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useState } from "react";
import { createPortal } from "react-dom";

type NavItem = { label: string; href: string };

export function AdminMobileNav({
  base,
  nav,
  portalBase,
  hidePortalLink = false,
}: {
  base: string;
  nav: NavItem[];
  portalBase: string;
  hidePortalLink?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm ring-1 ring-slate-100 touch-manipulation"
        aria-label="Open menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {open && createPortal(
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <aside
            className="fixed left-0 top-0 z-50 h-screen w-72 border-r border-slate-200 bg-[#F4F7F9] shadow-xl"
            role="dialog"
            aria-label="Admin navigation"
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div className="text-lg font-semibold text-slate-900">
                  Crew<span className="text-[#75C043]">Rules</span>
                  <span className="align-super text-xs">™</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 touch-manipulation"
                  aria-label="Close menu"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-1">
                  {nav.map((item) => (
                    <Fragment key={item.label}>
                      {item.href === "settings" && (
                        <div className="mt-5 h-3 shrink-0" aria-hidden />
                      )}
                      <Link
                        href={item.href ? `${base}/${item.href}` : base}
                        onClick={() => setOpen(false)}
                        className="flex items-center rounded-xl px-3 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition touch-manipulation min-h-[44px]"
                      >
                        {item.label}
                      </Link>
                    </Fragment>
                  ))}
                </div>
                {!hidePortalLink && (
                  <div className="mt-6 border-t border-slate-200 pt-4">
                    <Link
                      href={portalBase}
                      onClick={() => setOpen(false)}
                      className="flex min-h-[44px] items-center rounded-xl px-3 py-3 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition touch-manipulation"
                    >
                      ← Back to Portal
                    </Link>
                  </div>
                )}
              </nav>
            </div>
          </aside>
        </>,
        document.body
      )}
    </>
  );
}
