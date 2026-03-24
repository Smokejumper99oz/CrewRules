"use client";

import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
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
    if (typeof window === "undefined") return;
    if (window.innerWidth >= 768 && window.innerWidth < 1280) {
      setTabletNavOpen(!tabletNavOpen);
    } else {
      setOpen((prev) => !prev);
    }
  };

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(max-width: 767px)");
    if (!mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const handle = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, [open]);

  const mobileDrawerOpen = open;
  const menuClosed = !tabletNavOpen && !mobileDrawerOpen;

  return (
    <>
      <button
        type="button"
        onClick={handleHamburgerClick}
        className="xl:hidden flex shrink-0 h-11 w-11 min-w-[44px] min-h-[44px] items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10 shadow-[0_0_25px_rgba(117,192,67,0.15)] touch-manipulation"
        aria-label={menuClosed ? "Open menu" : "Close menu"}
      >
        {menuClosed ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm md:hidden"
              aria-hidden
              onClick={() => setOpen(false)}
            />
            <aside
              className="fixed left-0 top-0 z-[60] h-full w-[85vw] max-w-[340px] bg-slate-900/95 backdrop-blur-xl border-r border-white/10 shadow-2xl ring-1 ring-white/10 md:hidden"
              role="dialog"
              aria-label="Navigation menu"
            >
              <div className="flex h-full flex-col pt-[env(safe-area-inset-top,0px)]">
                <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="text-xl font-semibold leading-tight">
                      Crew<span className="text-[#75C043]">Rules</span>
                      <span className="align-super text-xs">™</span>
                    </div>
                    <div className="mt-0.5 text-sm text-slate-400">{portalName}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex shrink-0 h-11 w-11 min-w-[44px] min-h-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white touch-manipulation"
                    aria-label="Close menu"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <nav className="flex-1 overflow-y-auto px-4 py-4 pb-[env(safe-area-inset-bottom)]">
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
          </>,
          document.body
        )}
    </>
  );
}
