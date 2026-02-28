"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitLogin } from "./actions";

const TENANT = "frontier";
const PORTAL = "pilots";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(submitLogin, null);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-lg px-6 py-16">
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

          <form action={formAction} className="mt-8 space-y-4">
            <div>
              <label className="text-sm text-slate-200">Email</label>
              <input
                name="email"
                type="email"
                placeholder="name@company.com"
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

            {state?.error && (
              <p className="text-sm text-red-400">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="block w-full rounded-xl bg-[#75C043] px-4 py-3 font-semibold text-slate-950 hover:opacity-95 transition text-center disabled:opacity-50"
            >
              {isPending ? "Logging in…" : "Login"}
            </button>

            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
              <Link href="/" className="text-slate-300 hover:text-white">
                Back to Home
              </Link>
              <span className="text-slate-500">•</span>
              <Link href="/login" className="text-slate-300 hover:text-white">
                Choose different role
              </Link>
              <span className="text-slate-500">•</span>
              <Link
                href={`/${TENANT}/${PORTAL}/sign-up`}
                className="text-slate-300 hover:text-white"
              >
                Create account
              </Link>
              <span className="text-slate-500">•</span>
              <Link
                href={`/${TENANT}/${PORTAL}/request-access`}
                className="text-slate-300 hover:text-white"
              >
                Request Access
              </Link>
            </div>
          </form>

          <p className="mt-8 text-xs text-slate-500 leading-relaxed">
            Crew<span className="text-[#75C043]">Rules</span>™ is an independent pilot/crew
            resource and is not affiliated with any airline, union, or regulator. Always consult
            official sources for authoritative guidance.
          </p>
        </div>
      </div>
    </main>
  );
}
