"use client";

import { useActionState } from "react";
import { createProfile } from "./actions";
import { DatePickerInput } from "@/components/date-picker-input";
import { CustomFormSelect } from "@/components/custom-form-select";
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

const COMPLETE_PROFILE_TRIGGER = `${INPUT_CLASS} min-h-[3.25rem] text-white`;

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
          required
          triggerClassName={COMPLETE_PROFILE_TRIGGER}
          chevronClassName="text-slate-400"
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
          required
          triggerClassName={COMPLETE_PROFILE_TRIGGER}
          chevronClassName="text-slate-400"
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
          Your information is private and used to power CrewRules™ features.
          <br />
          You control what is shared (e.g., Family View™ or Mentoring).
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
