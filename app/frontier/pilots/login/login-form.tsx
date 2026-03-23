"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { signOut } from "../portal/actions";
import { SignOutButton } from "@/components/sign-out-button";

const TENANT = "frontier";
const PORTAL = "pilots";

const GATE_ERROR_MESSAGES: Record<string, string> = {
  not_signed_in: "Your session expired. Please sign in again.",
  company_email_required: "CrewRules Frontier portal requires a @flyfrontier.com email.",
  profile_missing: "Your account exists but your CrewRules profile is missing. Contact an admin.",
  profile_missing_contact_admin: "Your account exists but your CrewRules profile is missing. Contact an admin.",
  tenant_mismatch: "This account is not authorized for this airline portal.",
  portal_mismatch: "This account is not authorized for this portal.",
  role_not_allowed: "Your role does not allow access. Contact an admin.",
  account_disabled: "Your account has been disabled. Contact an admin.",
};

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirectError = searchParams?.get("error");
  const gateMessage = redirectError ? GATE_ERROR_MESSAGES[redirectError] : null;

  const [isPending, setIsPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const formErrorMessage =
    submitError ??
    (redirectError === "invalid_link"
      ? "Reset link is invalid or expired. Please request a new one."
      : !gateMessage && redirectError
        ? redirectError
        : null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setIsPending(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: formData,
      });
      let data: { ok?: boolean; error?: string; redirect?: string } = {};
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        setSubmitError("Invalid response from server. Please try again.");
        return;
      }

      if (data.ok) {
        window.location.href = data.redirect ?? "/frontier/pilots/portal";
        return;
      }

      setSubmitError(data.error ?? "Login failed");
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-lg px-6 py-16">
        {gateMessage && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3">
            <p className="text-sm text-rose-200">{gateMessage}</p>
            {redirectError !== "not_signed_in" && (
              <SignOutButton signOut={signOut} buttonClassName="shrink-0 rounded-lg border border-rose-400/50 bg-rose-900/50 px-3 py-2 text-sm text-rose-100 hover:bg-rose-900/70">
                Sign out
              </SignOutButton>
            )}
          </div>
        )}
        <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20 p-8 shadow-lg shadow-black/30">
          <div className="text-xs uppercase tracking-widest text-slate-400">
            Frontier Airline Pilots
          </div>

          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Crew<span className="text-[#75C043]">Rules</span>
            <span className="align-super text-sm">™</span> Login
          </h1>

          <p className="mt-3 text-slate-300">
            Secure access for verified crew members of this airline.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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
                disabled={isPending}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/40"
              />
            </div>

            {formErrorMessage && (
              <p className="text-sm text-red-400">{formErrorMessage}</p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="block w-full rounded-xl bg-[#75C043] px-4 py-3 font-semibold text-slate-950 hover:opacity-95 transition text-center disabled:opacity-50"
            >
              {isPending ? "Logging in…" : "Login"}
            </button>

            <div className="text-center">
              <Link
                href={`/${TENANT}/${PORTAL}/forgot-password`}
                className="text-sm text-slate-300 hover:text-white"
              >
                Forgot User ID or Password?
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
              <Link href="/" className="text-slate-300 hover:text-white">
                Back to Home
              </Link>
              <span className="text-slate-500">•</span>
              <Link
                href={`/${TENANT}/${PORTAL}/sign-up`}
                className="text-slate-300 hover:text-white"
              >
                Create account
              </Link>
            </div>
          </form>

          <p className="mt-8 text-xs text-slate-500 leading-relaxed">
            CrewRules™ is an independent pilot/crew
            resource and is not affiliated with any airline, union, or regulator. Always consult
            official sources for authoritative guidance.
          </p>
        </div>
      </div>
    </main>
  );
}
