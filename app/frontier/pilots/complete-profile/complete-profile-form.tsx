"use client";

import { useActionState } from "react";
import { createProfile } from "./actions";

type Props = { preFillEmployeeNumber?: string | null };

export function CompleteProfileForm({ preFillEmployeeNumber }: Props) {
  const [state, formAction, isPending] = useActionState(createProfile, null);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <label className="block">
        <span className="text-sm text-slate-300">Employee Number</span>
        <input
          name="employee_number"
          type="text"
          placeholder="Your Employee Number"
          defaultValue={preFillEmployeeNumber ?? ""}
          disabled={isPending}
          className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
        />
      </label>
      {state?.error && (
        <p className="mb-4 text-sm text-rose-400">
          We couldn&apos;t create your profile: {state.error}. Please request access or contact an
          admin.
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="inline-block rounded-xl bg-[#75C043] px-6 py-3 font-semibold text-slate-950 hover:opacity-95 transition disabled:opacity-50"
      >
        {isPending ? "Creating…" : "Create my profile"}
      </button>
    </form>
  );
}
