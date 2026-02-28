"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updatePassword } from "./actions";

const TENANT = "frontier";
const PORTAL = "pilots";

export default function ResetPasswordPage() {
  const [state, formAction, isPending] = useActionState(updatePassword, null);

  if (state?.success) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-lg px-6 py-16">
          <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 p-8 shadow-lg shadow-black/30">
            <h1 className="text-2xl font-bold tracking-tight text-[#75C043]">
              Password updated
            </h1>
            <p className="mt-3 text-slate-300">
              Your password has been reset successfully. You can now log in with
              your new password.
            </p>
            <Link
              href={`/${TENANT}/${PORTAL}/login`}
              className="mt-6 inline-block rounded-xl bg-[#75C043] px-4 py-3 font-semibold text-slate-950 hover:opacity-95 transition"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 p-8 shadow-lg shadow-black/30">
          <div className="text-xs uppercase tracking-widest text-slate-400">
            Frontier Airline Pilots
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Crew<span className="text-[#75C043]">Rules</span>
            <span className="align-super text-sm">™</span> Reset Password
          </h1>
          <p className="mt-3 text-slate-300">
            Enter your new password below.
          </p>

          <form action={formAction} className="mt-8 space-y-4">
            <div>
              <label className="text-sm text-slate-200">New password</label>
              <input
                name="password"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
                disabled={isPending}
                autoComplete="new-password"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/40"
              />
            </div>

            <div>
              <label className="text-sm text-slate-200">Confirm password</label>
              <input
                name="confirm"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
                disabled={isPending}
                autoComplete="new-password"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/40"
              />
            </div>

            {state?.error && (
              <p className="text-sm text-red-400">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="block w-full rounded-xl bg-[#75C043] px-4 py-3 font-semibold text-slate-950 hover:opacity-95 transition text-center disabled:opacity-50"
            >
              {isPending ? "Updating…" : "Update password"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href={`/${TENANT}/${PORTAL}/login`}
              className="text-sm text-slate-300 hover:text-white"
            >
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
