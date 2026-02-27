"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitSignUp } from "./actions";

const TENANT = "frontier";
const PORTAL = "pilots";

export default function SignUpPage() {
  const [state, formAction, isPending] = useActionState(submitSignUp, null);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20 p-8 shadow-lg shadow-black/30">
          <div className="text-xs uppercase tracking-widest text-slate-400">
            Frontier Airline Pilots
          </div>

          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Create account
          </h1>

          <p className="mt-3 text-slate-300">
            Create your CrewRules™ portal account. You must use your company email.
          </p>

          <form action={formAction} className="mt-8 space-y-4">
            <div>
              <label className="text-sm text-slate-200">Email</label>
              <input
                name="email"
                type="email"
                placeholder="name@flyfrontier.com"
                required
                disabled={isPending}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/40"
              />
            </div>

            <div>
              <label className="text-sm text-slate-200">Password</label>
              <input
                name="password"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
                disabled={isPending}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/40"
              />
              <p className="mt-1 text-xs text-slate-500">At least 6 characters</p>
            </div>

            {state?.error && (
              <p className="text-sm text-red-400">{state.error}</p>
            )}
            {state?.success && (
              <p className="text-sm text-emerald-400">
                Account created. Check your email to confirm, or go to login.
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="block w-full rounded-xl bg-[#75C043] px-4 py-3 font-semibold text-slate-950 hover:opacity-95 transition text-center disabled:opacity-50"
            >
              {isPending ? "Creating…" : "Create account"}
            </button>

            <Link
              href={`/${TENANT}/${PORTAL}/login`}
              className="block text-center text-sm text-slate-300 hover:text-white"
            >
              Already have an account? Log in
            </Link>
          </form>
        </div>
      </div>
    </main>
  );
}
