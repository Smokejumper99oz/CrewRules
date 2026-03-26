"use client";

import Link from "next/link";

export default function FlightAttendantLoginPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-lg px-6 py-16">
        <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 p-8 shadow-lg shadow-black/30">
          <div className="text-xs uppercase tracking-widest text-slate-400">
            Frontier Airlines Flight Attendants
          </div>

          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            Crew<span className="text-[#75C043]">Rules</span>
            <span className="align-super text-sm">™</span> Login
          </h1>

          <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-4">
            <p className="text-amber-200 font-medium">Coming soon</p>
            <p className="mt-2 text-sm text-slate-300">
              The Flight Attendant portal is under development. Check back soon, or{" "}
              <Link href="/request-access" className="text-[#75C043] hover:underline">
                join the waitlist
              </Link>{" "}
              to be notified when it launches.
            </p>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition"
            >
              Choose different role
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl bg-[#75C043] px-5 py-3 text-sm font-semibold text-slate-950 hover:brightness-110 transition"
            >
              Back to Home
            </Link>
          </div>

          <p className="mt-8 text-xs text-slate-500 leading-relaxed">
            Crew<span className="text-[#75C043]">Rules</span>™ is an independent pilot/crew
            resource and is not affiliated with any airline, union, or regulator.
          </p>
        </div>
      </div>
    </main>
  );
}
