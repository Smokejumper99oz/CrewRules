"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveLoginSelection } from "@/lib/login-selection";

const AVAILABLE_AIRLINES = [
  { id: "frontier", name: "Frontier Airlines", available: true },
];

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<"pilot" | "flight-attendant" | null>(null);
  const [airline, setAirline] = useState("frontier");

  const loginPath =
    role === "pilot"
      ? "/frontier/pilots/login"
      : role === "flight-attendant"
        ? "/frontier/flight-attendants/login"
        : null;

  function handleContinue() {
    if (!role || !loginPath) return;
    saveLoginSelection({ role, airline });
    router.push(loginPath);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight">
            Crew<span className="text-[#75C043]">Rules</span>
            <span className="align-super text-sm">™</span> Login
          </h1>
          <p className="mt-2 text-slate-400">Choose your role and airline to continue</p>
        </div>

        <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] p-8 space-y-8">
          {/* Step 1: Role */}
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-400 mb-4">
              Step 1: Choose your role
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole("pilot")}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 px-8 py-10 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] ${
                  role === "pilot"
                    ? "border-[#75C043] bg-[#75C043]/10 shadow-[0_0_25px_rgba(117,192,67,0.15)]"
                    : "border-white/10 bg-white/5 hover:border-emerald-400/20"
                }`}
              >
                <span className="text-4xl mb-2" aria-hidden>✈️</span>
                <span className="text-xl font-semibold text-white">Pilot</span>
                <span className="mt-1 text-sm text-slate-400">Pilot Portal access</span>
              </button>

              <button
                type="button"
                onClick={() => setRole("flight-attendant")}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 px-8 py-10 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] ${
                  role === "flight-attendant"
                    ? "border-[#75C043] bg-[#75C043]/10 shadow-[0_0_25px_rgba(117,192,67,0.15)]"
                    : "border-white/10 bg-white/5 hover:border-emerald-400/20"
                }`}
              >
                <span className="text-4xl mb-2" aria-hidden>🛫</span>
                <span className="text-xl font-semibold text-white">Flight Attendant</span>
                <span className="mt-1 text-sm text-slate-400">Flight Attendant Portal</span>
              </button>
            </div>
          </div>

          {/* Step 2: Airline */}
          <div>
            <div className="text-xs uppercase tracking-widest text-slate-400 mb-4">
              Step 2: Airline
            </div>
            <div className="flex flex-col gap-2">
              <select
                value={airline}
                onChange={(e) => setAirline(e.target.value)}
                disabled
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white cursor-not-allowed opacity-90"
                aria-label="Airline selection"
              >
                {AVAILABLE_AIRLINES.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                More airlines will be available in the future.
              </p>
            </div>
          </div>

          {/* Continue */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleContinue}
              disabled={!role || !loginPath}
              className={`flex-1 inline-flex items-center justify-center rounded-xl px-5 py-3.5 text-sm font-semibold transition ${
                role && loginPath
                  ? "bg-[#75C043] text-slate-950 hover:brightness-110"
                  : "bg-white/10 text-slate-500 cursor-not-allowed"
              }`}
            >
              Continue to Login
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 px-5 py-3.5 text-sm font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition"
            >
              Back to Home
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500 leading-relaxed">
          Crew<span className="text-[#75C043]">Rules</span>™ is an independent pilot/crew resource
          and is not affiliated with any airline, union, or regulator.
        </p>
      </div>
    </main>
  );
}
