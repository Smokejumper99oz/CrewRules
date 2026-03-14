"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { submitSignUp } from "./actions";

const TENANT = "frontier";
const PORTAL = "pilots";

const FRONTIER_EMAIL_ERROR = "Use your Frontier company email (@flyfrontier.com).";

const WAITLIST_SUCCESS_MESSAGE =
  "CrewRules™ is not live for your airline yet. You've been added to the waitlist.";

function isValidFrontierEmail(email: string): boolean {
  const trimmed = email.trim();
  const normalized = trimmed.toLowerCase();
  return normalized.endsWith("@flyfrontier.com");
}

export default function SignUpPage() {
  const [state, formAction, isPending] = useActionState(submitSignUp, null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const submittedRef = useRef(false);

  const showSignUpSuccess = state?.success && state?.email;
  const showWaitlistSuccess = state?.waitlist;

  useEffect(() => {
    if (state?.error) {
      submittedRef.current = false;
      setSubmitted(false);
    }
  }, [state?.error]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (submittedRef.current) {
      e.preventDefault();
      return;
    }
    const form = e.currentTarget;
    const emailInput = form.elements.namedItem("email") as HTMLInputElement;
    const email = emailInput?.value ?? "";

    if (!email?.trim()) {
      e.preventDefault();
      return;
    }
    setEmailError(null);
    submittedRef.current = true;
    setSubmitted(true);
  }

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

          <form action={formAction} onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-sm text-slate-200">Full name</label>
              <input
                name="full_name"
                type="text"
                placeholder="Your full name"
                required
                disabled={isPending}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/40"
              />
            </div>

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
              <label className="text-sm text-slate-200">Employee Number</label>
              <input
                name="employee_number"
                type="text"
                placeholder="Your Employee Number"
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

            {(state?.error || emailError) && (
              <p className="text-sm text-red-400">{state?.error ?? emailError}</p>
            )}
            {showSignUpSuccess && (
              <p className="text-sm text-emerald-400">
                Check your Frontier email and click the confirmation link to finish signing up.
              </p>
            )}
            {showWaitlistSuccess && (
              <p className="text-sm text-emerald-400">{WAITLIST_SUCCESS_MESSAGE}</p>
            )}

            {!showSignUpSuccess && !showWaitlistSuccess && (
              <button
                type="submit"
                disabled={isPending || submitted}
                className="block w-full rounded-xl bg-[#75C043] px-4 py-3 font-semibold text-slate-950 hover:opacity-95 transition text-center disabled:opacity-50"
              >
                {isPending || submitted ? "Creating…" : "Create account"}
              </button>
            )}
          </form>

          <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
            <Link href="/" className="text-slate-300 hover:text-white">
              Back to Home
            </Link>
            <span className="text-slate-500">•</span>
            <Link
              href={`/${TENANT}/${PORTAL}/login`}
              className="text-slate-300 hover:text-white"
            >
              Already have an account? Log in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
