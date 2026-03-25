"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { createProfile } from "./actions";
import { DatePickerInput } from "@/components/date-picker-input";
import { FRONTIER_CREW_BASE_OPTIONS } from "@/lib/frontier-crew-bases";

const INPUT_CLASS =
  "mt-2 w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50";

const SORTED_CREW_BASE_OPTIONS = [...FRONTIER_CREW_BASE_OPTIONS].sort((a, b) =>
  a.value.localeCompare(b.value)
);

const POSITION_OPTIONS = [
  { value: "captain", label: "Captain" },
  { value: "first_officer", label: "First Officer" },
  { value: "flight_attendant", label: "Flight Attendant" },
] as const;

/** Outer panel: clips corners; inner list scrolls. High z-index for iPad/Safari stacking. */
const DROPDOWN_PANEL_WRAPPER_CLASS =
  "absolute left-0 right-0 z-[200] mt-1 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7),0_0_0_1px_rgba(15,23,42,0.8)] ring-1 ring-black/30";

const DROPDOWN_LIST_CLASS = "max-h-60 overflow-y-auto py-1";

const TRIGGER_EXTRA_CLASS =
  "min-h-[3.25rem] flex cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-not-allowed";

type SelectOption = { value: string; label: string };

function CustomFormSelect({
  id,
  name,
  options,
  placeholder,
  disabled,
}: {
  id: string;
  name: string;
  options: readonly SelectOption[];
  placeholder: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = value
    ? options.find((o) => o.value === value)?.label ?? value
    : null;

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

  return (
    <div className="relative" ref={containerRef}>
      <input type="hidden" name={name} value={value} required />
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`${INPUT_CLASS} ${TRIGGER_EXTRA_CLASS}`}
      >
        <span className={value ? "text-white" : "text-slate-400"}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && !disabled && (
        <div className={DROPDOWN_PANEL_WRAPPER_CLASS}>
          <ul role="listbox" className={DROPDOWN_LIST_CLASS}>
            {options.map((opt) => {
              const isSelected = value === opt.value;
              return (
                <li key={opt.value} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={
                      "flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm focus:outline-none " +
                      (isSelected
                        ? "bg-slate-800 text-emerald-300"
                        : "text-slate-100 hover:bg-slate-800 focus:bg-slate-800")
                    }
                    onClick={() => {
                      setValue(opt.value);
                      setOpen(false);
                    }}
                  >
                    <span>{opt.label}</span>
                    {isSelected ? (
                      <Check className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                    ) : (
                      <span className="w-4 shrink-0" aria-hidden />
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

export function CompleteProfileForm() {
  const [state, formAction, isPending] = useActionState(createProfile, null);

  return (
    <form action={formAction} className="mt-8 space-y-4 text-left">
      <div>
        <label htmlFor="base_airport" className="block text-sm font-medium text-slate-300">
          Crew Base <span className="text-red-400" aria-hidden="true">*</span>
        </label>
        <CustomFormSelect
          id="base_airport"
          name="base_airport"
          options={SORTED_CREW_BASE_OPTIONS}
          placeholder="Select crew base"
          disabled={isPending}
        />
        <p className="mt-1 text-xs text-slate-500">Used for Commute Assist™, Report Times, and schedule-based features.</p>
      </div>

      <div>
        <label htmlFor="position" className="block text-sm font-medium text-slate-300">
          Position <span className="text-red-400" aria-hidden="true">*</span>
        </label>
        <CustomFormSelect
          id="position"
          name="position"
          options={POSITION_OPTIONS}
          placeholder="Select position"
          disabled={isPending}
        />
        <p className="mt-1 text-xs text-slate-500">Used for Pay Projection™, Duty Limits, and schedule-based features.</p>
      </div>

      <div>
        <label htmlFor="date_of_hire" className="block text-sm font-medium text-slate-300">
          Date of Hire (DOH) <span className="text-red-400" aria-hidden="true">*</span>
        </label>
        <DatePickerInput
          id="date_of_hire"
          name="date_of_hire"
          placeholder="mm/dd/yyyy"
          className="mt-2 w-full max-w-[12rem] rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#75C043]/50 focus:outline-none focus:ring-1 focus:ring-[#75C043]/30 cursor-pointer disabled:opacity-50"
        />
        <p className="mt-1 text-xs text-slate-500">Used for pay, seniority-based features, and schedule insights.</p>
      </div>

      <div>
        <label htmlFor="home_airport" className="block text-sm font-medium text-slate-300">
          Home Airport <span className="text-red-400" aria-hidden="true">*</span>
        </label>
        <input
          id="home_airport"
          name="home_airport"
          type="text"
          placeholder="e.g. TPA"
          required
          maxLength={3}
          disabled={isPending}
          className={`${INPUT_CLASS} uppercase placeholder:normal-case`}
          style={{ textTransform: "uppercase" }}
        />
        <p className="mt-1 text-xs text-slate-500">Used for Commute Assist™ to find your best commute options.</p>
      </div>

      <div>
        <label htmlFor="alternate_home_airport" className="block text-sm text-slate-400">
          Alternate Home Airport <span className="text-slate-500">(optional)</span>
        </label>
        <input
          id="alternate_home_airport"
          name="alternate_home_airport"
          type="text"
          placeholder="e.g. MCO"
          maxLength={3}
          disabled={isPending}
          className={`${INPUT_CLASS} uppercase placeholder:normal-case`}
          style={{ textTransform: "uppercase" }}
        />
        <p className="mt-1 text-xs text-slate-500">Optional backup for Commute Assist™ to expand commute options.</p>
      </div>

      {state?.error && (
        <p className="mb-4 text-sm text-rose-400">
          We couldn&apos;t create your profile: {state.error}. Please try again or contact an admin.
        </p>
      )}
      <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2">
        <p className="text-xs text-amber-200 leading-relaxed">
          Your information is private and used only to power CrewRules™ features.
          <br />
          It is NEVER shared.
        </p>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="inline-block rounded-xl bg-[#75C043] px-6 py-3 font-semibold text-slate-950 hover:bg-amber-500 transition disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create My Profile"}
      </button>
    </form>
  );
}
