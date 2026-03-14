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
          Crew<span className="text-[#75C043]">Rules</span>™ is launching airline by airline. Request access with your company email and we&apos;ll let you know whether your airline is live or add you to the waitlist.
        </p>

        <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-[#75C043]/10 to-white/[0.03] p-6">
          <div className="text-xs uppercase tracking-widest text-slate-400">
            FRONTIER AIRLINES
          </div>
          <h2 className="mt-3 text-xl font-bold tracking-tight">
            Pilot Access — Now Live
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            CrewRules™ is now available for Frontier Airline pilots.
            <br />
            Create your account or log in to get started.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link
              href="/frontier/pilots/sign-up"
              className="inline-flex justify-center rounded-xl bg-[#75C043] px-6 py-3 font-semibold text-slate-950 hover:brightness-110 transition"
            >
              Create Account
            </Link>
            <Link
              href="/frontier/pilots/login"
              className="text-sm text-slate-300 hover:text-white underline underline-offset-4"
            >
              Already have an account? Log in
            </Link>
          </div>
        </div>

        <form action={formAction} className="mt-10 space-y-4">
          <label className="block">
            <span className="text-sm text-slate-300">Full Name</span>
            <input
              name="full_name"
              type="text"
              placeholder="Your full name"
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
              required
              disabled={isPending}
              className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-300">Role</span>
            <select
              name="role"
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
              disabled={isPending}
              className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-300">Employee Number</span>
            <input
              name="employee_number"
              type="text"
              placeholder="Your Employee ID"
              disabled={isPending}
              className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            />
          </label>

          {state?.error && (
            <div className="space-y-2">
              <p className="text-sm text-red-400">{state.error}</p>
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
            </div>
          )}
          {state?.success && state?.airlineLive && (
            <div className="space-y-3 pt-2">
              <p className="text-sm font-medium text-emerald-400">
                Your airline is already live on CrewRules™. Please create your account to get started.
              </p>
              {state?.signupRoute && (
                <Link
                  href={state.signupRoute}
                  className="inline-flex w-full justify-center rounded-xl bg-[#75C043] px-6 py-3 font-semibold text-slate-950 hover:brightness-110 transition"
                >
                  Create Account
                </Link>
              )}
            </div>
          )}
          {state?.success && !state?.airlineLive && (
            <div className="space-y-2 pt-2">
              <p className="text-sm font-medium text-emerald-400">
                You&apos;ve been added to the CrewRules™ waitlist.
              </p>
              <p className="text-sm text-slate-300">
                Crew<span className="text-[#75C043]">Rules</span>™ is not live for your airline yet. We&apos;re expanding in phases and will reach out when access becomes available.
              </p>
              <p className="text-xs text-slate-500">
                Launch timing may vary by airline and rollout priority.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full mt-2 px-6 py-3 rounded-xl bg-[#75C043] text-slate-950 font-semibold hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
