"use client";

import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { AdminSidebarNav } from "@/components/admin-sidebar-nav";

type NavItem = { label: string; href: string };

export function AdminMobileNav({
  base,
  nav,
  portalBase,
  hidePortalLink = false,
  isSuperAdmin,
  tabletNavOpen,
  setTabletNavOpen,
}: {
  base: string;
  nav: NavItem[];
  portalBase: string;
  hidePortalLink?: boolean;
  isSuperAdmin: boolean;
  tabletNavOpen: boolean;
  setTabletNavOpen: (open: boolean) => void;
}) {
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
        className="xl:hidden flex h-11 w-11 shrink-0 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm ring-1 ring-slate-100 touch-manipulation"
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
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
              aria-hidden
              onClick={() => setOpen(false)}
            />
            <aside
              className="fixed left-0 top-0 z-[60] flex h-full w-[85vw] max-w-[340px] flex-col border-r border-slate-200 bg-[#F4F7F9] shadow-xl"
              role="dialog"
              aria-label="Admin navigation"
            >
              <div className="flex h-full flex-col pt-[env(safe-area-inset-top,0px)]">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">
                      Crew<span className="text-[#75C043]">Rules</span>
                      <span className="align-super text-xs">™</span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600">Admin Portal</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 touch-manipulation"
                    aria-label="Close menu"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="sidebar-scrollbar-hide flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
                  <AdminSidebarNav
                    base={base}
                    nav={nav}
                    portalBase={portalBase}
                    isSuperAdmin={isSuperAdmin}
                    hidePortalLink={hidePortalLink}
                    onLinkClick={() => setOpen(false)}
                  />
                </div>
              </div>
            </aside>
          </>,
          document.body
        )}
    </>
  );
}
