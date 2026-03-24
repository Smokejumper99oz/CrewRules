"use client";

import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { format, getYear, setYear } from "date-fns";
import "react-day-picker/style.css";

const MIN_YEAR = 1985;
const MAX_YEAR = new Date().getFullYear();

type Props = {
  id: string;
  name: string;
  value?: string | null; // yyyy-mm-dd
  placeholder?: string;
  className?: string;
};

export function DatePickerInput({ id, name, value, placeholder = "mm/dd/yyyy", className }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Date | undefined>(() => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    const d = new Date(value + "T12:00:00");
    return isNaN(d.getTime()) ? undefined : d;
  });
  const [month, setMonthState] = useState<Date>(() => selected ?? new Date());
  const [yearInput, setYearInput] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const displayValue = selected ? format(selected, "MM/dd/yyyy") : "";
  const hiddenValue = selected ? format(selected, "yyyy-MM-dd") : "";
  const currentYear = getYear(month);

  useEffect(() => {
    if (open) {
      setYearInput(currentYear.toString());
    }
  }, [open, currentYear]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  function handleYearChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
    setYearInput(v);
    if (v.length === 4) {
      const y = parseInt(v, 10);
      if (!isNaN(y) && y >= MIN_YEAR && y <= MAX_YEAR) {
        setMonthState((m) => setYear(m, y));
      }
    }
  }

  function handleYearBlur() {
    const y = yearInput ? parseInt(yearInput, 10) : currentYear;
    const clamped = Math.min(MAX_YEAR, Math.max(MIN_YEAR, isNaN(y) ? currentYear : y));
    setMonthState((m) => setYear(m, clamped));
    setYearInput(clamped.toString());
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        readOnly
        value={displayValue}
        placeholder={placeholder}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        className={className}
        aria-haspopup="dialog"
        aria-expanded={open}
      />
      <input type="hidden" id={id} name={name} value={hiddenValue} />
      {open && (
        <div
          className="absolute left-0 top-full z-[100] mt-1 w-max rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
          role="dialog"
          aria-label="Choose date"
        >
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-white/10">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Jump to year</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={yearInput}
              onChange={handleYearChange}
              onBlur={handleYearBlur}
              className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-sm text-slate-900 focus:border-[#75C043]/50 focus:outline-none focus:ring-1 focus:ring-[#75C043]/30 dark:border-white/10 dark:bg-slate-800 dark:text-white"
              aria-label="Year"
            />
            <span className="text-xs text-slate-500">
              {MIN_YEAR}–{MAX_YEAR}
            </span>
          </div>
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(date) => {
              setSelected(date);
              setOpen(false);
            }}
            month={month}
            onMonthChange={(m) => setMonthState(m)}
            defaultMonth={selected ?? new Date()}
            startMonth={new Date(MIN_YEAR, 0)}
            endMonth={new Date()}
            className="rdp-profile-dark rdp-profile-light p-4"
          />
        </div>
      )}
    </div>
  );
}
