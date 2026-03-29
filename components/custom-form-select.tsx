"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type CustomFormSelectOption = { value: string; label: string };

const PANEL_CLASS =
  "absolute left-0 right-0 z-[200] mt-1 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7),0_0_0_1px_rgba(15,23,42,0.8)] ring-1 ring-black/30";

const LIST_CLASS = "max-h-60 overflow-y-auto py-1";

/** Lighter, tighter listbox — use only where explicitly requested (e.g. Settings pilot fields). */
const SETTINGS_PANEL_CLASS =
  "absolute left-0 right-0 z-[200] mt-1 w-full overflow-hidden rounded-lg border border-slate-200/90 bg-white " +
  "shadow-[0_10px_38px_-12px_rgba(0,0,0,0.18),0_0_0_1px_rgba(15,23,42,0.04)] " +
  "dark:border-slate-700/55 dark:bg-slate-950 dark:shadow-[0_14px_42px_-14px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.06)]";

const SETTINGS_LIST_CLASS = "max-h-60 overflow-y-auto py-0.5";

const TRIGGER_LAYOUT = "flex cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-not-allowed";

export type CustomFormSelectMenuVariant = "default" | "settings";

type Props = {
  id: string;
  name: string;
  options: readonly CustomFormSelectOption[];
  placeholder: string;
  disabled?: boolean;
  required?: boolean;
  /** Uncontrolled initial value (e.g. onboarding). */
  defaultValue?: string;
  /** Controlled value (e.g. profile form). */
  value?: string;
  onValueChange?: (value: string) => void;
  triggerClassName: string;
  chevronClassName?: string;
  containerClassName?: string;
  /** Scopes menu panel styling without affecting other forms. */
  menuVariant?: CustomFormSelectMenuVariant;
};

function fireInputEvents(el: HTMLInputElement | null) {
  if (!el) return;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export function CustomFormSelect({
  id,
  name,
  options,
  placeholder,
  disabled = false,
  required = false,
  defaultValue = "",
  value: valueProp,
  onValueChange,
  triggerClassName,
  chevronClassName = "text-slate-400",
  containerClassName = "",
  menuVariant = "default",
}: Props) {
  const panelClass = menuVariant === "settings" ? SETTINGS_PANEL_CLASS : PANEL_CLASS;
  const listClass = menuVariant === "settings" ? SETTINGS_LIST_CLASS : LIST_CLASS;
  const controlled = valueProp !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlled ? valueProp! : uncontrolled;

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!controlled) {
      setUncontrolled(defaultValue);
    }
  }, [controlled, defaultValue]);

  const selectedLabel = value ? options.find((o) => o.value === value)?.label ?? value : null;

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
    if (!controlled) {
      setUncontrolled(next);
    }
    onValueChange?.(next);
    requestAnimationFrame(() => fireInputEvents(hiddenRef.current));
  }

  return (
    <div className={`relative ${containerClassName}`.trim()} ref={containerRef}>
      <input ref={hiddenRef} type="hidden" name={name} value={value} required={required} />
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`${triggerClassName} ${TRIGGER_LAYOUT}`.trim()}
      >
        <span className={value ? "" : "text-slate-400"}>{selectedLabel ?? placeholder}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${chevronClassName} ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && !disabled && (
        <div className={panelClass}>
          <ul role="listbox" className={listClass}>
            {options.map((opt) => {
              const isSelected = value === opt.value;
              const optionClassDefault =
                "flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm focus:outline-none " +
                (isSelected
                  ? "bg-slate-800 text-emerald-300"
                  : "text-slate-100 hover:bg-slate-800 focus:bg-slate-800");
              const optionClassSettings =
                "flex w-full min-h-10 items-center justify-between gap-2 px-3 py-2 text-left text-sm focus:outline-none " +
                (isSelected
                  ? "bg-slate-100 text-slate-900 dark:bg-white/[0.08] dark:text-white"
                  : "text-slate-700 hover:bg-slate-50 focus:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.06] dark:focus:bg-white/[0.06]");
              const optionClass =
                menuVariant === "settings" ? optionClassSettings : optionClassDefault;
              const checkClass =
                menuVariant === "settings"
                  ? "h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400/85"
                  : "h-4 w-4 shrink-0 text-emerald-400";
              const spacerClass = menuVariant === "settings" ? "w-3.5 shrink-0" : "w-4 shrink-0";

              return (
                <li key={opt.value} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={optionClass}
                    onClick={() => {
                      commit(opt.value);
                      setOpen(false);
                    }}
                  >
                    <span>{opt.label}</span>
                    {isSelected ? (
                      <Check className={checkClass} aria-hidden />
                    ) : (
                      <span className={`${spacerClass}`} aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
