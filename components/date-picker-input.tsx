"use client";

import { useState, useEffect, type ChangeEvent } from "react";

const MIN_YEAR = 1985;

type Props = {
  id: string;
  name: string;
  value?: string | null; // yyyy-mm-dd
  placeholder?: string;
  className?: string;
};

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** MMDDYYYY from yyyy-mm-dd for internal state. */
function isoYmdToDigits(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  return `${iso.slice(5, 7)}${iso.slice(8, 10)}${iso.slice(0, 4)}`;
}

function formatDigitsToDisplay(digits: string): string {
  const d = digits.slice(0, 8);
  if (d.length === 0) return "";
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function isValidCalendarDate(y: number, m: number, day: number): boolean {
  if (m < 1 || m > 12 || day < 1 || day > 31) return false;
  const dt = new Date(y, m - 1, day);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === day;
}

function isNotFutureDate(y: number, m: number, day: number): boolean {
  const now = new Date();
  const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const cand = new Date(y, m - 1, day, 0, 0, 0, 0);
  return cand <= endToday;
}

function computeHiddenFromDigits(digits: string): string {
  if (digits.length !== 8) return "";
  const mm = parseInt(digits.slice(0, 2), 10);
  const dd = parseInt(digits.slice(2, 4), 10);
  const yyyy = parseInt(digits.slice(4, 8), 10);
  if (!Number.isFinite(mm) || !Number.isFinite(dd) || !Number.isFinite(yyyy)) return "";
  if (yyyy < MIN_YEAR) return "";
  if (!isValidCalendarDate(yyyy, mm, dd)) return "";
  if (!isNotFutureDate(yyyy, mm, dd)) return "";
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

export function DatePickerInput({ id, name, value, placeholder = "mm/dd/yyyy", className }: Props) {
  const normalizedValue = value?.trim() ?? "";
  const [digits, setDigits] = useState(() => isoYmdToDigits(normalizedValue));

  useEffect(() => {
    setDigits(isoYmdToDigits(value?.trim() ?? ""));
  }, [value]);

  const displayValue = formatDigitsToDisplay(digits);
  const hiddenValue = computeHiddenFromDigits(digits);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    setDigits(digitsOnly(e.target.value).slice(0, 8));
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={displayValue}
        placeholder={placeholder}
        onChange={handleChange}
        maxLength={10}
        className={className}
      />
      <input type="hidden" id={id} name={name} value={hiddenValue} />
    </div>
  );
}
