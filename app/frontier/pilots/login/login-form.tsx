"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signOut } from "../portal/actions";
import { SignOutButton } from "@/components/sign-out-button";

const REMEMBERED_EMAIL_KEY = "crewrules-login-email";
const TENANT = "frontier";
const PORTAL = "pilots";

const GATE_ERROR_MESSAGES: Record<string, string> = {
  not_signed_in: "Your session expired. Please sign in again.",
  company_email_required: "Use your Frontier company email to sign in to this portal.",
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
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (stored && typeof stored === "string") setEmail(stored.trim());
    } catch {
      /* ignore */
    }
  }, []);

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

    let navigatedAfterSuccess = false;
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
        try {
          const emailToStore = (formData.get("email") as string)?.trim();
          if (emailToStore) localStorage.setItem(REMEMBERED_EMAIL_KEY, emailToStore);
        } catch {
          /* ignore */
        }
        navigatedAfterSuccess = true;
        window.location.href = data.redirect ?? "/frontier/pilots/portal";
        return;
      }

      setSubmitError(data.error ?? "Login failed");
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      if (!navigatedAfterSuccess) setIsPending(false);
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
          <h1 className="text-3xl font-bold tracking-tight">
            Crew<span className="text-[#75C043]">Rules</span><span className="align-super text-xs text-white">™</span> Login
          </h1>

          <p className="mt-3 text-slate-300">
            Secure access for verified airline crew members only.
          </p>

          <p className="mt-1 text-sm text-slate-400">
            Currently Live: Frontier Airlines
          </p>

          <div className="mt-6">
            <Link
              href={`/${TENANT}/${PORTAL}/sign-up`}
              className="block w-full rounded-lg border border-[#75C043]/60 bg-[#75C043]/10 px-4 py-2 text-sm font-medium text-[#75C043] hover:bg-[#75C043]/20 hover:border-[#75C043] transition text-center"
            >
              First-Time User - Create a Free Account
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm text-slate-200">Email</label>
              <input
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@yourairline.com"
                required
                disabled={isPending}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/40"
              />
            </div>

            <div>
              <label className="text-sm text-slate-200">Password</label>
              <div className="relative mt-2">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  disabled={isPending}
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-white/10 bg-slate-950/40 py-3 pl-4 pr-12 text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/40"
                />
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 disabled:opacity-40"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
                </button>
              </div>
            </div>

            <label className={`flex items-center gap-2 mt-3 ${isPending ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
              <input type="checkbox" name="remember" disabled={isPending} className="rounded border-slate-500 bg-slate-800 text-[#75C043] focus:ring-[#75C043]/50 disabled:opacity-50" />
              <span className="text-sm text-slate-300">Remember Me</span>
            </label>

            {formErrorMessage && (
              <p className="text-sm text-red-400">{formErrorMessage}</p>
            )}

            <div className="mt-3">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#75C043] px-4 py-3 font-semibold text-slate-950 hover:opacity-95 transition disabled:opacity-70 disabled:cursor-wait"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                    <span>Signing in…</span>
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </div>

            <div className="text-center mt-4 space-y-1.5">
              <p>
                <Link href="/request-access" className="text-sm text-slate-300 hover:text-slate-200 transition">
                  Join the Waitlist for your Airline
                </Link>
              </p>
              <p>
                <Link
                  href={`/${TENANT}/${PORTAL}/forgot-password`}
                  className="text-sm text-slate-500 hover:text-slate-300"
                >
                  Forgot User ID or Password?
                </Link>
              </p>
              <p>
                <Link href="/" className="text-sm text-slate-500 hover:text-slate-300">
                  Back to Home
                </Link>
              </p>
            </div>
          </form>

          <p className="mt-6 text-xs text-slate-500 leading-relaxed">
            CrewRules™ is an independent pilot/crew
            resource and is not affiliated with any airline, union, or regulator. Always consult
            official sources for authoritative guidance.
          </p>
        </div>
      </div>
    </main>
  );
}
