"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitAccessRequest } from "./actions";

export default function RequestAccessPage() {
  const [state, formAction, isPending] = useActionState(submitAccessRequest, null);
  const v = state?.values;
  const formKey = state?.echoKey ?? "request-access-form";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-lg w-full px-6 py-16">
        <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20 p-8 shadow-lg shadow-black/30">
          <h1 className="text-3xl font-bold text-center tracking-tight">
          Crew<span className="text-[#75C043]">Rules</span><span className="align-super text-sm">™</span> Join Waitlist
        </h1>
        <p className="mt-4 text-slate-300 text-left">
          CrewRules™ is rolling out one airline at a time to ensure a high-quality experience for verified crew members.
          <br />
          Request access using your company email. If your airline is not live yet, you&apos;ll be added to the waitlist and notified when onboarding begins.
        </p>

        <div className="mt-2 text-sm text-emerald-400 font-medium">
          Currently Live: Frontier Airlines (Pilots)
        </div>

        <form key={formKey} action={formAction} className="mt-8 space-y-4">
          <label className="block">
            <span className="text-sm text-slate-300">Full Name</span>
            <input
              name="full_name"
              type="text"
              placeholder="Your full name"
              defaultValue={v?.full_name ?? ""}
              required
              disabled={isPending}
              className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-300">Email</span>
            <input
              name="email"
              type="email"
              placeholder="you@company.com"
              defaultValue={v?.email ?? ""}
              required
              disabled={isPending}
              className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-300">Role</span>
            <select
              name="role"
              defaultValue={v?.role ?? ""}
              required
              disabled={isPending}
              className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              <option value="">Select role</option>
              <option value="pilot">Pilot</option>
              <option value="fa">Flight Attendant</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm text-slate-300">Airline</span>
            <input
              name="airline"
              type="text"
              placeholder="Your Airline"
              defaultValue={v?.airline ?? ""}
              disabled={isPending}
              className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-300">Employee ID</span>
            <input
              name="employee_number"
              type="text"
              placeholder="Your Employee ID"
              defaultValue={v?.employee_number ?? ""}
              disabled={isPending}
              className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-slate-400">
              Used for secure account matching
            </p>
          </label>

          {state?.error && (
            <div className="space-y-2">
              <p className="text-sm text-red-400">{state.error}</p>
              {process.env.NODE_ENV === "development" && (
                <p className="text-xs text-slate-500">
                  Debug: Try{" "}
                  <a
                    href="/api/supabase-health"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#75C043] hover:underline"
                  >
                    /api/supabase-health
                  </a>{" "}
                  and{" "}
                  <a
                    href="/api/supabase-health?raw=1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#75C043] hover:underline"
                  >
                    /api/supabase-health?raw=1
                  </a>{" "}
                  (raw fetch). Check the terminal for logs.
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full mt-2 px-6 py-3 rounded-xl bg-[#75C043] text-slate-950 font-semibold hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Submitting…" : "Join Waitlist"}
          </button>

          <div className="mt-6 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs leading-relaxed">
            <span className="font-medium text-slate-200">Why we ask for this</span>
            <p className="mt-1 text-slate-400">
              CrewRules™ uses your company email and employee ID to verify your account and automatically match you to your airline&apos;s contract, rules, and tools.
            </p>
          </div>
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
      </div>
    </main>
  );
}
