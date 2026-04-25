"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { demo135OpsSignOut } from "../actions";

const REMEMBERED_EMAIL_KEY = "crewrules-demo135-ops-login-email";

const GATE_ERROR_MESSAGES: Record<string, string> = {
  not_signed_in: "Your session expired. Please sign in again.",
  profile_missing: "Your account exists but your CrewRules profile is missing. Contact an admin.",
  tenant_mismatch: "This account is not authorized for the Ops demo.",
  portal_mismatch: "This account is not authorized for this portal.",
  role_not_allowed: "Your role does not allow access to the Ops demo admin. Contact an admin.",
};

export function Demo135OpsLoginForm() {
  const searchParams = useSearchParams();
  const redirectError = searchParams?.get("error");
  const gateMessage = redirectError ? GATE_ERROR_MESSAGES[redirectError] : null;

  const [isPending, setIsPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [email, setEmail] = useState("");

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
        window.location.href = data.redirect ?? "/demo135/ops/admin";
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
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[480px] w-[480px] rounded-full bg-emerald-500/8 blur-3xl" />
      </div>
      <div className="mx-auto max-w-lg px-6 py-16">
        {gateMessage && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3">
            <p className="text-sm text-rose-200">{gateMessage}</p>
            {redirectError !== "not_signed_in" && (
              <form action={demo135OpsSignOut}>
                <button
                  type="submit"
                  className="shrink-0 rounded-lg border border-rose-400/50 bg-rose-900/50 px-3 py-2 text-sm text-rose-100 hover:bg-rose-900/70"
                >
                  Sign out
                </button>
              </form>
            )}
          </div>
        )}
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-950/90 p-8 shadow-lg shadow-black/40">
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-400/90">
            Part 91 / 135 · Operations
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Crew<span className="text-[#75C043]">Rules</span>
            <span className="align-super text-xs text-white/80">™</span>{" "}
            <span className="text-slate-200">Ops</span>
          </h1>
          <p className="mt-3 text-slate-300">Management portal preview — demo sign-in.</p>
          <p className="mt-1 text-sm text-slate-500">
            Authorized demo administrators only. Same CrewRules account as production sign-in.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-sm text-slate-200">Email</label>
              <input
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={isPending}
                autoComplete="email"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-sky-400/40"
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
                autoComplete="current-password"
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-sky-400/40"
              />
            </div>

            <label
              className={`mt-3 flex items-center gap-2 ${isPending ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                name="remember"
                disabled={isPending}
                className="rounded border-slate-500 bg-slate-800 text-[#75C043] focus:ring-[#75C043]/50 disabled:opacity-50"
              />
              <span className="text-sm text-slate-300">Remember me</span>
            </label>

            {formErrorMessage && <p className="text-sm text-red-400">{formErrorMessage}</p>}

            <button
              type="submit"
              disabled={isPending}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#75C043] px-4 py-3 font-semibold text-slate-950 transition hover:opacity-95 disabled:cursor-wait disabled:opacity-70"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                  <span>Signing in…</span>
                </>
              ) : (
                "Sign in"
              )}
            </button>

            <div className="space-y-1.5 pt-2 text-center text-sm">
              <p>
                <Link
                  href="/frontier/pilots/forgot-password"
                  className="text-slate-500 hover:text-slate-300"
                >
                  Forgot password?
                </Link>
              </p>
              <p>
                <Link href="/cr135" className="text-slate-500 hover:text-slate-300">
                  CrewRules 135 overview
                </Link>
              </p>
              <p>
                <Link href="/" className="text-slate-500 hover:text-slate-300">
                  Back to home
                </Link>
              </p>
            </div>
          </form>

          <p className="mt-8 text-xs leading-relaxed text-slate-500">
            CrewRules™ is an independent operations and crew resource tool and is not affiliated with any
            operator, union, or regulator. Always consult official sources for authoritative guidance.
          </p>
        </div>
      </div>
    </main>
  );
}
