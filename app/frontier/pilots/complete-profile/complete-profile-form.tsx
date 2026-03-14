"use client";

import { useActionState } from "react";
import { createProfile } from "./actions";

type Props = { preFillEmployeeNumber?: string | null };

export function CompleteProfileForm({ preFillEmployeeNumber }: Props) {
  const [state, formAction, isPending] = useActionState(createProfile, null);

  return (
    <form action={formAction} className="mt-8">
      <input
        type="hidden"
        name="employee_number"
        defaultValue={preFillEmployeeNumber ?? ""}
      />
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
