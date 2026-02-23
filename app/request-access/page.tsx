"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitAccessRequest } from "./actions";

export default function RequestAccessPage() {
  const [state, formAction, isPending] = useActionState(submitAccessRequest, null);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <div className="max-w-xl w-full">
        <h1 className="text-4xl font-bold text-center">Request Access</h1>
        <p className="mt-4 text-slate-300 text-center">
          Join the CrewRules™ early access list. We&apos;ll reach out with next steps.
        </p>

        <form action={formAction} className="mt-10 space-y-4">
          <label className="block">
            <span className="text-sm text-slate-300">Email</span>
            <input
              name="email"
              type="email"
              placeholder="you@company.com"
              required
              disabled={isPending}
              className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-300">Airline</span>
            <input
              name="airline"
              type="text"
              placeholder="Frontier Airlines"
              disabled={isPending}
              className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            />
          </label>

          {state?.error && (
            <p className="text-sm text-red-400">{state.error}</p>
          )}
          {state?.success && (
            <p className="text-sm text-emerald-400">
              Thanks! We&apos;ve received your request. We&apos;ll be in touch soon.
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full mt-2 px-6 py-3 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Submitting…" : "Request Access"}
          </button>
        </form>

        <div className="mt-10 text-center">
          <Link
            href="/"
            className="text-slate-300 hover:text-white underline underline-offset-4"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
