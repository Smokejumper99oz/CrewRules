"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export type SearchableFormSelectOption = {
  value: string;
  label: string;
  keywords?: string;
};

/** Shared chrome for the dropdown panel (position comes from inline styles when portaled). */
const PANEL_SURFACE_CLASS =
  "overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7),0_0_0_1px_rgba(15,23,42,0.8)] ring-1 ring-black/30";

const LIST_CLASS = "max-h-72 overflow-y-auto py-1";

const TRIGGER_LAYOUT =
  "flex w-full cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-not-allowed";

const PANEL_MIN_WIDTH_PX = 288; // 18rem — readable mentor names
const PANEL_MAX_WIDTH_PX = 448; // 28rem
const PANEL_VIEWPORT_MARGIN = 8;
const PANEL_GAP_PX = 6;

function fireInputEvents(el: HTMLInputElement | null) {
  if (!el) return;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function optionMatches(queryNorm: string, opt: SearchableFormSelectOption): boolean {
  if (!queryNorm) return true;
  const parts = [opt.label, opt.keywords ?? "", opt.value];
  for (const p of parts) {
    if (p.toLowerCase().includes(queryNorm)) return true;
  }
  return false;
}

type PanelBox = { top: number; left: number; width: number };

function computePanelBox(trigger: DOMRect): PanelBox {
  const vw = typeof window !== "undefined" ? window.innerWidth : PANEL_MAX_WIDTH_PX;
  const maxW = Math.min(
    PANEL_MAX_WIDTH_PX,
    vw - PANEL_VIEWPORT_MARGIN * 2
  );
  const width = Math.min(
    maxW,
    Math.max(PANEL_MIN_WIDTH_PX, trigger.width)
  );
  let left = trigger.left;
  if (left + width > vw - PANEL_VIEWPORT_MARGIN) {
    left = Math.max(
      PANEL_VIEWPORT_MARGIN,
      vw - PANEL_VIEWPORT_MARGIN - width
    );
  }
  const top = trigger.bottom + PANEL_GAP_PX;
  return { top, left, width };
}

type Props = {
  name: string;
  value: string;
  onValueChange?: (value: string) => void;
  options: SearchableFormSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
};

export function SearchableFormSelect({
  name,
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyLabel = "No matches",
  disabled = false,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [panelBox, setPanelBox] = useState<PanelBox | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const queryNorm = search.trim().toLowerCase();

  const filteredOptions = useMemo(
    () => options.filter((o) => optionMatches(queryNorm, o)),
    [options, queryNorm]
  );

  const selectedLabel = useMemo(
    () => (value ? options.find((o) => o.value === value)?.label ?? value : null),
    [options, value]
  );

  const updatePanelBox = useCallback(() => {
    const trig = triggerRef.current;
    if (!trig) return;
    setPanelBox(computePanelBox(trig.getBoundingClientRect()));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelBox(null);
      return;
    }
    updatePanelBox();
  }, [open, updatePanelBox]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", updatePanelBox, true);
    window.addEventListener("resize", updatePanelBox);
    return () => {
      window.removeEventListener("scroll", updatePanelBox, true);
      window.removeEventListener("resize", updatePanelBox);
    };
  }, [open, updatePanelBox]);

  useEffect(() => {
    if (!open) return;
    setSearch("");
  }, [open]);

  useEffect(() => {
    if (!open || !panelBox) return;
    const t = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open, panelBox]);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (containerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    if (open) {
      document.addEventListener("pointerdown", handlePointerDown);
      return () => document.removeEventListener("pointerdown", handlePointerDown);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [open]);

  function commit(next: string) {
    onValueChange?.(next);
    requestAnimationFrame(() => fireInputEvents(hiddenRef.current));
  }

  const rootClass = `relative min-w-0 ${className}`.trim();

  const triggerClass =
    "w-full max-w-full rounded-md border border-white/10 bg-slate-950/50 px-2 py-1.5 text-xs font-normal leading-snug text-slate-200 " +
    "focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-50 [color-scheme:dark]";

  return (
    <div className={rootClass} ref={containerRef}>
      <input ref={hiddenRef} type="hidden" name={name} value={value} />
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={selectedLabel ?? undefined}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`${triggerClass} ${TRIGGER_LAYOUT}`.trim()}
      >
        <span
          className={`line-clamp-2 min-w-0 text-left ${value ? "" : "text-slate-400"}`}
        >
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {typeof document !== "undefined" &&
        open &&
        !disabled &&
        panelBox &&
        createPortal(
          <div
            ref={panelRef}
            className={`fixed z-[500] ${PANEL_SURFACE_CLASS}`}
            style={{
              top: panelBox.top,
              left: panelBox.left,
              width: panelBox.width,
            }}
          >
            <div className="border-b border-white/10 p-2">
              <input
                ref={searchInputRef}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                placeholder={searchPlaceholder}
                autoComplete="off"
                className="w-full rounded-md border border-white/10 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/40 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 [color-scheme:dark]"
              />
            </div>
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500">{emptyLabel}</div>
            ) : (
              <ul role="listbox" className={LIST_CLASS}>
                {filteredOptions.map((opt) => {
                  const isSelected = value === opt.value;
                  const optionClass =
                    "flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-xs leading-snug focus:outline-none " +
                    (isSelected
                      ? "bg-slate-800 text-emerald-300"
                      : "text-slate-100 hover:bg-slate-800 focus:bg-slate-800");
                  return (
                    <li key={opt.value} role="none">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        title={opt.label}
                        className={optionClass}
                        onClick={() => {
                          commit(opt.value);
                          setOpen(false);
                        }}
                      >
                        <span className="min-w-0 flex-1 whitespace-normal break-words text-left">
                          {opt.label}
                        </span>
                        {isSelected ? (
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                        ) : (
                          <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
