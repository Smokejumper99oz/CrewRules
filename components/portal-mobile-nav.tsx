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
        className="xl:hidden flex shrink-0 h-11 w-11 min-w-[44px] min-h-[44px] items-center justify-center rounded-xl bg-slate-100 ring-1 ring-slate-200 touch-manipulation dark:bg-white/5 dark:ring-white/10 dark:shadow-[0_0_25px_rgba(117,192,67,0.15)]"
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
              className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm md:hidden dark:bg-black/80"
              aria-hidden
              onClick={() => setOpen(false)}
            />
            <aside
              className="fixed left-0 top-0 z-[60] h-full w-[85vw] max-w-[340px] border-r border-white/10 bg-slate-900/95 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 md:hidden [html[data-theme=light]_&]:border-slate-200 [html[data-theme=light]_&]:bg-white [html[data-theme=light]_&]:ring-0"
              role="dialog"
              aria-label="Navigation menu"
            >
              <div className="flex h-full flex-col pt-[env(safe-area-inset-top,0px)]">
                <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-5 [html[data-theme=light]_&]:border-slate-200">
                  <div className="min-w-0 flex-1">
                    <div className="text-xl font-semibold leading-tight text-slate-900 dark:text-white">
                      Crew<span className="text-[#75C043]">Rules</span>
                      <span className="align-super text-xs">™</span>
                    </div>
                    <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{portalName}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex shrink-0 h-11 w-11 min-w-[44px] min-h-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 touch-manipulation dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
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
