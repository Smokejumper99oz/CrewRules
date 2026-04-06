"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { inferAirlineFromEmail } from "@/lib/supported-airlines";
import { submitSignUp, verifyOtp, resendOtp } from "./actions";
import { FRONTIER_PILOT_SIGNUP_USE_AIRLINE_EMAIL } from "./constants";

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

const INPUT_CLASS =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/40";

export default function SignUpPage() {
  const [state, formAction, isPending] = useActionState(submitSignUp, null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const submittedRef = useRef(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    const emailVal = emailInput?.value ?? "";

    if (!emailVal?.trim()) {
      e.preventDefault();
      return;
    }

    if (password !== confirmPassword) {
      e.preventDefault();
      setMatchError("Passwords do not match");
      return;
    }

    if (
      !isValidFrontierEmail(emailVal) &&
      inferAirlineFromEmail(emailVal) === "unknown"
    ) {
      e.preventDefault();
      setEmailError(FRONTIER_PILOT_SIGNUP_USE_AIRLINE_EMAIL);
      submittedRef.current = false;
      return;
    }

    setEmailError(null);
    setMatchError(null);
    submittedRef.current = true;
    setSubmitted(true);
  }

  const [otpState, otpAction, otpPending] = useActionState(verifyOtp, null);
  const [resendSent, setResendSent] = useState(false);
  const [resendPending, setResendPending] = useState(false);
  const [otpToken, setOtpToken] = useState("");
  const verifyStepEnteredRef = useRef(false);

  useEffect(() => {
    if (!showSignUpSuccess) {
      verifyStepEnteredRef.current = false;
      return;
    }
    if (verifyStepEnteredRef.current) return;
    verifyStepEnteredRef.current = true;
    setOtpToken("");
    setEmail("");
  }, [showSignUpSuccess]);

  if (showSignUpSuccess) {
    return (
      <main
        key="frontier-pilot-verify-email"
        className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-12 sm:px-6"
      >
        <div className="w-full max-w-lg">
          <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] hover:border-emerald-400/20 px-6 py-6 sm:px-8 sm:py-8 shadow-lg shadow-black/30">
            <div className="text-xs uppercase tracking-widest text-slate-400">
              Frontier Airline Pilots
            </div>

            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Crew<span className="text-[#75C043]">Rules</span><span className="align-super text-xs">™</span>
            </h1>

            <h2 className="mt-4 text-xl font-bold text-white">
              Verify your email
            </h2>

            <p className="mt-2 text-sm text-slate-300">
              Enter the 8-digit code sent to your email address.
            </p>

            <form action={otpAction} className="mt-6 space-y-4">
              <input type="hidden" name="email" value={state?.email ?? ""} />

              <div>
                <label className="text-sm text-slate-200">Verification Code</label>
                <input
                  name="token"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Enter code"
                  value={otpToken}
                  onChange={(e) => setOtpToken(e.target.value)}
                  required
                  disabled={otpPending}
                  className={INPUT_CLASS}
                />
              </div>

              {otpState?.error && (
                <p className="text-sm text-red-400">{otpState.error}</p>
              )}

              <button
                type="submit"
                disabled={otpPending}
                className="block w-full rounded-xl bg-[#75C043] px-4 py-3 font-semibold text-slate-950 hover:opacity-95 transition text-center disabled:opacity-50"
              >
                {otpPending ? "Verifying…" : "Verify Email"}
              </button>
            </form>

            <div className="mt-4 text-center space-y-2">
              <button
                type="button"
                disabled={resendPending}
                onClick={async () => {
                  setResendSent(false);
                  setResendPending(true);
                  await resendOtp(state?.email ?? "");
                  setResendPending(false);
                  setResendSent(true);
                }}
                className="text-sm text-slate-400 hover:text-slate-200 transition disabled:opacity-50"
              >
                {resendPending ? "Sending…" : "Resend code"}
              </button>
              {resendSent && (
                <p className="text-xs text-emerald-400">Code resent</p>
              )}
            </div>

            <div className="mt-3 text-center">
              <Link
                href="/frontier/pilots/login"
                className="text-sm text-slate-400 hover:text-slate-200 transition"
              >
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main key="frontier-pilot-sign-up" className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl border border-white/5 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] shadow-lg shadow-black/30 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400/20 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)]">
            <h1 className="text-3xl font-bold tracking-tight">
              Crew<span className="text-[#75C043]">Rules</span>
              <span className="align-super text-sm">™</span> Create account
            </h1>

            <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-100">
              <span className="text-[#75C043]">Currently Live:</span> Frontier Airlines (Pilots)
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              F9 Flight Attendants or other airlines:{" "}
              <Link
                href="/request-access"
                className="font-normal text-slate-300 underline decoration-slate-500/50 underline-offset-2 transition hover:text-slate-200 hover:decoration-slate-400"
              >
                Join the waitlist
              </Link>
            </p>

            <p className="mt-4 text-slate-300">
              Create your CrewRules™ portal account.
              <br />
              You must use your company email.
            </p>

          <form action={formAction} onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-sm text-slate-200">Full Name</label>
              <input
                name="full_name"
                type="text"
                placeholder="John Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={isPending}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className="text-sm text-slate-200">Email</label>
              <input
                name="email"
                type="email"
                placeholder="name@flyfrontier.com"
                value={email ?? ""}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isPending}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className="text-sm text-slate-200">Employee Number</label>
              <input
                name="employee_number"
                type="text"
                placeholder="Your Employee Number"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                required
                disabled={isPending}
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <label className="text-sm text-slate-200">Password</label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setMatchError(null);
                  }}
                  required
                  minLength={6}
                  disabled={isPending}
                  className={`${INPUT_CLASS} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 outline-none focus:text-slate-200"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">At least 6 characters</p>
            </div>

            <div>
              <label className="text-sm text-slate-200">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setMatchError(null);
                  }}
                  required
                  disabled={isPending}
                  className={`${INPUT_CLASS} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 outline-none focus:text-slate-200"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {(state?.error || emailError || matchError) && (
              <p className="text-sm text-red-400">{matchError ?? state?.error ?? emailError}</p>
            )}
            {showWaitlistSuccess && (
              <p className="text-sm text-emerald-400">{WAITLIST_SUCCESS_MESSAGE}</p>
            )}

            {!showSignUpSuccess && !showWaitlistSuccess && (
              <>
                <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
                  <span className="font-bold">Note:</span> You may see a security warning on the confirmation email.
                  <br />
                  This is normal — just confirm your email to continue.
                </div>
                <button
                  type="submit"
                  disabled={isPending || submitted}
                  className="block w-full rounded-xl bg-[#75C043] px-4 py-3 font-semibold text-slate-950 hover:opacity-95 transition text-center disabled:opacity-50"
                >
                {isPending || submitted ? "Creating…" : "Create Account"}
                </button>
              </>
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
