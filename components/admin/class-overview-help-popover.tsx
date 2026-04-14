"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const PANEL_MAX_W = 340;
const VIEW_MARGIN = 12;
const GAP_BELOW = 8;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function ClassOverviewHelpPopover() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelBox, setPanelBox] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const updatePosition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn || !open) return;

    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const wAvail = vw - 2 * VIEW_MARGIN;
    const width = Math.min(PANEL_MAX_W, Math.max(220, wAvail));
    let left = r.right - width;
    left = clamp(left, VIEW_MARGIN, vw - VIEW_MARGIN - width);

    const top = r.bottom + GAP_BELOW;
    const maxHeight = Math.max(200, vh - top - VIEW_MARGIN);

    setPanelBox({ top, left, width, maxHeight });
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelBox(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  const panelNode =
    open &&
    panelBox &&
    typeof document !== "undefined" ? (
      <div
        ref={panelRef}
        id="class-overview-help-panel"
        role="dialog"
        aria-labelledby="class-overview-help-title"
        style={{
          position: "fixed",
          top: panelBox.top,
          left: panelBox.left,
          width: panelBox.width,
          maxHeight: panelBox.maxHeight,
          zIndex: 9999,
        }}
        className="box-border overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 text-left shadow-lg ring-1 ring-slate-900/5"
      >
        <h3 id="class-overview-help-title" className="text-sm font-semibold text-slate-900">
          About the Class Overview
        </h3>
        <div className="mt-3 text-sm leading-relaxed text-slate-600">
          <p>
            Classes are generated from hire dates within ±12 months of today, matching the Mentee Roster cohort window.
            Uploading new roster data will add or update class cards for eligible dates, while older cohorts outside this
            window are automatically excluded.
          </p>
        </div>
      </div>
    ) : null;

  return (
    <div className="shrink-0">
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="class-overview-help-panel"
        aria-label="About the Class Overview"
        className="inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-semibold leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden>ⓘ</span>
      </button>
      {panelNode ? createPortal(panelNode, document.body) : null}
    </div>
  );
}
