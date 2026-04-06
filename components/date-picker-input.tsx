"use client";

import { useState, useEffect, useRef, type ChangeEvent, type FocusEvent } from "react";

const MIN_YEAR = 1985;
const PAUSE_BEFORE_INCOMPLETE_HINT_MS = 800;

/** Shown under the field when {@link DatePickerInputProps.strictFullDateEntry} is on and the value is incomplete. */
export const DATE_PICKER_FULL_DATE_HINT =
  "Enter a full date in MM/DD/YYYY or MM/DD/YY format.";

type Props = {
  id: string;
  name: string;
  value?: string | null; // yyyy-mm-dd
  placeholder?: string;
  className?: string;
  /**
   * When true (e.g. Pilot Settings autosave): do not call {@link onDisplayInput} while the typed value is
   * incomplete, show blur/idle hint text for partial dates, and only treat MM/DD/YYYY with a valid hidden ISO as complete.
   */
  strictFullDateEntry?: boolean;
  /** Fired while the user types in the display field (for debounced saves). */
  onDisplayInput?: () => void;
  /**
   * Fired when the hidden ISO value becomes a complete valid yyyy-mm-dd after user edits
   * (not on initial mount / external value sync).
   */
  onValidIsoCommit?: () => void;
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

/**
 * Hire dates since 1985: YY 85–99 → 19YY, else → 20YY (e.g. 26 → 2026).
 */
function expandTwoDigitHireYear(yy: number): number {
  if (!Number.isFinite(yy) || yy < 0 || yy > 99) return NaN;
  if (yy >= 85) return 1900 + yy;
  return 2000 + yy;
}

function computeHiddenFromDigits(digits: string): string {
  let mm: number;
  let dd: number;
  let yyyy: number;

  if (digits.length === 8) {
    mm = parseInt(digits.slice(0, 2), 10);
    dd = parseInt(digits.slice(2, 4), 10);
    yyyy = parseInt(digits.slice(4, 8), 10);
  } else if (digits.length === 6) {
    mm = parseInt(digits.slice(0, 2), 10);
    dd = parseInt(digits.slice(2, 4), 10);
    const yy = parseInt(digits.slice(4, 6), 10);
    yyyy = expandTwoDigitHireYear(yy);
  } else {
    return "";
  }

  if (!Number.isFinite(mm) || !Number.isFinite(dd) || !Number.isFinite(yyyy)) return "";
  if (yyyy < MIN_YEAR) return "";
  if (!isValidCalendarDate(yyyy, mm, dd)) return "";
  if (!isNotFutureDate(yyyy, mm, dd)) return "";
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function isDohCompleteValid(digits: string, hidden: string): boolean {
  const lenOk = digits.length === 8 || digits.length === 6;
  return lenOk && /^\d{4}-\d{2}-\d{2}$/.test(hidden);
}

function isDohPartial(digits: string, hidden: string): boolean {
  return digits.length > 0 && !isDohCompleteValid(digits, hidden);
}

export function DatePickerInput({
  id,
  name,
  value,
  placeholder = "mm/dd/yyyy",
  className,
  strictFullDateEntry = false,
  onDisplayInput,
  onValidIsoCommit,
}: Props) {
  const normalizedValue = value?.trim() ?? "";
  const [digits, setDigits] = useState(() => isoYmdToDigits(normalizedValue));
  const [formatHintVisible, setFormatHintVisible] = useState(false);
  const userEditedRef = useRef(false);
  const onValidIsoCommitRef = useRef(onValidIsoCommit);
  const pauseHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintId = `${id}-format-hint`;

  useEffect(() => {
    onValidIsoCommitRef.current = onValidIsoCommit;
  }, [onValidIsoCommit]);

  useEffect(() => {
    setDigits(isoYmdToDigits(value?.trim() ?? ""));
    userEditedRef.current = false;
    setFormatHintVisible(false);
    if (pauseHintTimerRef.current) {
      clearTimeout(pauseHintTimerRef.current);
      pauseHintTimerRef.current = null;
    }
  }, [value]);

  useEffect(
    () => () => {
      if (pauseHintTimerRef.current) {
        clearTimeout(pauseHintTimerRef.current);
        pauseHintTimerRef.current = null;
      }
    },
    [],
  );

  const displayValue = formatDigitsToDisplay(digits);
  const hiddenValue = computeHiddenFromDigits(digits);

  useEffect(() => {
    if (!userEditedRef.current || !onValidIsoCommitRef.current) return;
    if (/^\d{4}-\d{2}-\d{2}$/.test(hiddenValue)) {
      onValidIsoCommitRef.current();
    }
  }, [hiddenValue]);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    userEditedRef.current = true;
    const nextDigits = digitsOnly(e.target.value).slice(0, 8);
    const nextHidden = computeHiddenFromDigits(nextDigits);
    setDigits(nextDigits);

    if (strictFullDateEntry && isDohCompleteValid(nextDigits, nextHidden)) {
      setFormatHintVisible(false);
    }

    if (pauseHintTimerRef.current) {
      clearTimeout(pauseHintTimerRef.current);
      pauseHintTimerRef.current = null;
    }
    if (strictFullDateEntry && isDohPartial(nextDigits, nextHidden)) {
      pauseHintTimerRef.current = setTimeout(() => {
        pauseHintTimerRef.current = null;
        setFormatHintVisible(true);
      }, PAUSE_BEFORE_INCOMPLETE_HINT_MS);
    }

    const partialBlocked = strictFullDateEntry && isDohPartial(nextDigits, nextHidden);
    if (!partialBlocked) {
      onDisplayInput?.();
    }
  }

  function handleBlur(_e: FocusEvent<HTMLInputElement>) {
    if (!strictFullDateEntry) return;
    if (pauseHintTimerRef.current) {
      clearTimeout(pauseHintTimerRef.current);
      pauseHintTimerRef.current = null;
    }
    const h = computeHiddenFromDigits(digits);
    if (isDohPartial(digits, h)) {
      setFormatHintVisible(true);
    } else {
      setFormatHintVisible(false);
    }
  }

  const showFormatHint = strictFullDateEntry && formatHintVisible && isDohPartial(digits, hiddenValue);

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={displayValue}
        placeholder={placeholder}
        onChange={handleChange}
        onBlur={handleBlur}
        maxLength={10}
        className={className}
        aria-invalid={showFormatHint}
        aria-describedby={showFormatHint ? hintId : undefined}
      />
      <input type="hidden" id={id} name={name} value={hiddenValue} />
      {showFormatHint ? (
        <p id={hintId} className="mt-1 text-xs font-medium text-red-600 dark:text-red-400" role="alert">
          {DATE_PICKER_FULL_DATE_HINT}
        </p>
      ) : null}
    </div>
  );
}
