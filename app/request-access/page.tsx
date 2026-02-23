import Link from "next/link";

export default function RequestAccessPage() {
  return (
    <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
      <div className="max-w-xl w-full">
        <h1 className="text-4xl font-bold text-center">Request Access</h1>
        <p className="mt-4 text-slate-300 text-center">
          Join the CrewRules™ early access list. We'll reach out with next steps.
        </p>

        <div className="mt-10 space-y-4">
          <label className="block">
            <span className="text-sm text-slate-300">Email</span>
            <input
              type="email"
              placeholder="you@company.com"
              className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-300">Airline</span>
            <input
              type="text"
              placeholder="Frontier (for now)"
              className="mt-2 w-full rounded-xl bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </label>

          <button
            type="button"
            className="w-full mt-2 px-6 py-3 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition"
          >
            Request Access
          </button>

          <p className="text-xs text-slate-500 text-center">
            (This is a placeholder. Next step is wiring this to Supabase or email.)
          </p>
        </div>

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
