"use client";

import { useActionState } from "react";
import { createProfile } from "./actions";
import { DatePickerInput } from "@/components/date-picker-input";

const FRONTIER_CREW_BASES = [
  "ATL",
  "MDW",
  "ORD",
  "CVG",
  "CLE",
  "DFW",
  "DEN",
  "LAS",
  "MIA",
  "MCO",
  "PHL",
  "PHX",
  "SJU",
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
          {FRONTIER_CREW_BASES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">Your crew base</p>
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
        <p className="mt-1 text-xs text-slate-500">Required for pay projection.</p>
      </div>

      <div>
        <label htmlFor="date_of_hire" className="block text-sm font-medium text-slate-300">
          Date of Hire (DOH) <span className="text-red-400" aria-hidden="true">*</span>
        </label>
        <DatePickerInput
          id="date_of_hire"
          name="date_of_hire"
          placeholder="mm/dd/yyyy"
          className={INPUT_CLASS}
        />
        <p className="mt-1 text-xs text-slate-500">Required for pay projection.</p>
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
          className={`${INPUT_CLASS} uppercase`}
          style={{ textTransform: "uppercase" }}
        />
        <p className="mt-1 text-xs text-slate-500">Your usual commute origin airport</p>
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
          className={`${INPUT_CLASS} uppercase`}
          style={{ textTransform: "uppercase" }}
        />
        <p className="mt-1 text-xs text-slate-500">Optional backup airport</p>
      </div>

      {state?.error && (
        <p className="mb-4 text-sm text-rose-400">
          We couldn&apos;t create your profile: {state.error}. Please try again or contact an admin.
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="inline-block rounded-xl bg-[#75C043] px-6 py-3 font-semibold text-slate-950 hover:bg-amber-500 transition disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create my profile"}
      </button>
    </form>
  );
}
