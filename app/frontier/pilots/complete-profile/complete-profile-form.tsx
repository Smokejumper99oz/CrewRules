"use client";

import { useActionState } from "react";
import { createProfile } from "./actions";
import { DatePickerInput } from "@/components/date-picker-input";

const FRONTIER_CREW_BASES = [
  { value: "ATL", label: "ATL" },
  { value: "CLE", label: "CLE" },
  { value: "CVG", label: "CVG" },
  { value: "DEN", label: "DEN" },
  { value: "DFW", label: "DFW" },
  { value: "LAS", label: "LAS" },
  { value: "MIA", label: "MIA" },
  { value: "MCO", label: "MCO" },
  { value: "ORD", label: "MDW/ORD" },
  { value: "PHL", label: "PHL" },
  { value: "PHX", label: "PHX" },
  { value: "SJU", label: "SJU" },
];

const INPUT_CLASS =
  "mt-2 w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50";

export function CompleteProfileForm() {
  const [state, formAction, isPending] = useActionState(createProfile, null);

  return (
    <form action={formAction} className="mt-8 space-y-4 text-left">
      <div>
        <label htmlFor="base_airport" className="block text-sm font-medium text-slate-300">
          Crew Base <span className="text-red-400" aria-hidden="true">*</span>
        </label>
        <select
          id="base_airport"
          name="base_airport"
          required
          disabled={isPending}
          className={`${INPUT_CLASS} cursor-pointer`}
        >
          <option value="">Select crew base</option>
          {FRONTIER_CREW_BASES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">Used for Commute Assist™, Report Times, and schedule-based features.</p>
      </div>

      <div>
        <label htmlFor="position" className="block text-sm font-medium text-slate-300">
          Position <span className="text-red-400" aria-hidden="true">*</span>
        </label>
        <select
          id="position"
          name="position"
          required
          disabled={isPending}
          className={`${INPUT_CLASS} cursor-pointer`}
        >
          <option value="">Select position</option>
          <option value="captain">Captain</option>
          <option value="first_officer">First Officer</option>
          <option value="flight_attendant">Flight Attendant</option>
        </select>
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
