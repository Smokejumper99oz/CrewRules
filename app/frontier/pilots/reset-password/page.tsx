"use client";

import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";

const TENANT = "frontier";
const PORTAL = "pilots";

type RecoveryStatus = "loading" | "ready" | "invalid";

/** Same merge rules as @supabase/auth-js parseParametersFromURL: hash + query, query wins. */
function parseAuthParamsFromHref(href: string): Record<string, string> {
  const result: Record<string, string> = {};
  const url = new URL(href);
  if (url.hash?.startsWith("#")) {
    try {
      new URLSearchParams(url.hash.slice(1)).forEach((value, key) => {
        result[key] = value;
      });
    } catch {
      /* hash is not query-style */
    }
  }
  url.searchParams.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function stripRecoveryParamsFromBrowserUrl(): void {
  const url = new URL(window.location.href);
  let changed = false;
  if (url.hash) {
    url.hash = "";
    changed = true;
  }
  if (url.searchParams.has("code")) {
    url.searchParams.delete("code");
    changed = true;
  }
  if (changed) {
    const next =
      url.pathname + (url.search ? url.search : "") + (url.hash ?? "");
    window.history.replaceState(window.history.state, "", next);
  }
}

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<RecoveryStatus>("loading");
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function establishRecoverySession() {
      const supabase = createClient();
      await supabase.auth.initialize();

      const params = parseAuthParamsFromHref(window.location.href);

      if (params.error || params.error_description) {
        if (!cancelled) setStatus("invalid");
        return;
      }

      async function applySessionIfPresent(): Promise<boolean> {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return true;
        if (session?.user) {
          stripRecoveryParamsFromBrowserUrl();
          setStatus("ready");
          return true;
        }
        return false;
      }

      if (await applySessionIfPresent()) return;

      if (params.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(params.code);
        if (!error && (await applySessionIfPresent())) return;
      }

      if (params.access_token && params.refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (!error && (await applySessionIfPresent())) return;
      }

      if (!cancelled) {
        if (params.access_token || params.code) {
          stripRecoveryParamsFromBrowserUrl();
        }
        setStatus("invalid");
      }
    }

    establishRecoverySession().catch(() => {
      if (!cancelled) setStatus("invalid");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);

    if (!password || password.length < 6) {
      setSubmitError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setSubmitError("Passwords do not match");
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setSubmitError(error.message);
        return;
      }
      await supabase.auth.signOut();
      setSuccess(true);
    } catch {
      setSubmitError("Failed to update password. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (success) {
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

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-lg px-6 py-16">
          <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 p-8 shadow-lg shadow-black/30">
            <p className="text-slate-300">Verifying reset link…</p>
          </div>
        </div>
      </main>
    );
  }

  if (status === "invalid") {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="mx-auto max-w-lg px-6 py-16">
          <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 p-8 shadow-lg shadow-black/30">
            <h1 className="text-2xl font-bold tracking-tight text-rose-200">
              Link invalid or expired
            </h1>
            <p className="mt-3 text-slate-300">
              This reset link is invalid or has expired. Request a new one from
              the forgot password page.
            </p>
            <Link
              href={`/${TENANT}/${PORTAL}/forgot-password`}
              className="mt-6 inline-block rounded-xl bg-[#75C043] px-4 py-3 font-semibold text-slate-950 hover:opacity-95 transition"
            >
              Forgot password
            </Link>
            <div className="mt-4 text-center">
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
          <p className="mt-3 text-slate-300">Enter your new password below.</p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm text-slate-200" htmlFor="reset-password">
                New password
              </label>
              <input
                id="reset-password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
                disabled={pending}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/40"
              />
            </div>

            <div>
              <label className="text-sm text-slate-200" htmlFor="reset-confirm">
                Confirm password
              </label>
              <input
                id="reset-confirm"
                name="confirm"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
                disabled={pending}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/40"
              />
            </div>

            {submitError && (
              <p className="text-sm text-red-400">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="block w-full rounded-xl bg-[#75C043] px-4 py-3 font-semibold text-slate-950 hover:opacity-95 transition text-center disabled:opacity-50"
            >
              {pending ? "Updating…" : "Update password"}
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
