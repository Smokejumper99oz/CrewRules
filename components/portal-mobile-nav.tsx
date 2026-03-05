"use client";

import Link from "next/link";
import { useState } from "react";
import { PortalSidebarContent } from "@/components/portal-sidebar-content";

type NavItem = { label: string; href: string };
type NavGroup = { title: string; items: readonly NavItem[] };

type PortalMobileNavProps = {
  base: string;
  navGroups: readonly NavGroup[];
  admin: boolean;
  signOut: () => Promise<void>;
  portalName: string;
  displayName: string;
  roleLabel: string;
  tabletNavOpen: boolean;
  setTabletNavOpen: (open: boolean) => void;
};

export function PortalMobileNav({
  base,
  navGroups,
  admin,
  signOut,
  portalName,
  displayName,
  roleLabel,
  tabletNavOpen,
  setTabletNavOpen,
}: PortalMobileNavProps) {
  const [open, setOpen] = useState(false);

  const handleHamburgerClick = () => {
    if (window.innerWidth >= 768 && window.innerWidth < 1280) {
      setTabletNavOpen(!tabletNavOpen);
    } else {
      setOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleHamburgerClick}
        className="xl:hidden flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 shadow-[0_0_25px_rgba(117,192,67,0.15)] touch-manipulation"
        aria-label={tabletNavOpen ? "Close menu" : "Open menu"}
      >
        {tabletNavOpen ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm xl:hidden"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <aside
            className="fixed left-0 top-0 z-50 h-full w-72 bg-slate-900/85 backdrop-blur-xl border-r border-white/10 shadow-2xl ring-1 ring-white/10 xl:hidden"
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
                <PortalSidebarContent
                  base={base}
                  navGroups={navGroups}
                  admin={admin}
                  displayName={displayName}
                  roleLabel={roleLabel}
                  signOut={signOut}
                  variant="drawer"
                  onLinkClick={() => setOpen(false)}
                />
              </nav>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
