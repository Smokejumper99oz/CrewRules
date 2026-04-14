"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const PANEL_MAX_W = 340;
const VIEW_MARGIN = 12;
const GAP_BELOW = 8;

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function ProgramHealthScoreMetricHelpPopover() {
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
        id="program-health-score-metric-help-panel"
        role="dialog"
        aria-labelledby="program-health-score-metric-help-title"
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
        <h3 id="program-health-score-metric-help-title" className="text-sm font-semibold text-slate-900">
          How this metric works
        </h3>
        <div className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-600">
          <p>
            The Program Health Score summarizes the overall state of the mentoring program based on key
            performance signals.
          </p>
          <p>It combines multiple metrics to give a quick view of program effectiveness.</p>
          <div className="space-y-2">
            <p className="font-medium text-slate-800">Factors include:</p>
            <p>Mentor coverage (mentees with assigned mentors)</p>
            <p>Engagement rate (recent mentoring activity)</p>
            <p>At-risk mentees (no recent check-in)</p>
            <p>Missing mentor contact information</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-slate-800">How it works:</p>
            <p>Each factor contributes to the overall score, which is graded from A to F.</p>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-slate-800">What it means:</p>
            <p>A / B: Program is healthy and functioning well</p>
            <p>C: Some areas need attention</p>
            <p>D / F: Significant issues requiring action</p>
          </div>
          <p className="border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-500">
            Note: This score is a high-level indicator and should be used alongside the detailed metrics above.
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
        aria-controls="program-health-score-metric-help-panel"
        aria-label="How this metric works"
        className="inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-semibold leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden>ⓘ</span>
      </button>
      {panelNode ? createPortal(panelNode, document.body) : null}
    </div>
  );
}
