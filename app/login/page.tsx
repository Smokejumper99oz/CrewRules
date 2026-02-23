import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-6">
      <div className="max-w-xl w-full text-center">
        <h1 className="text-4xl font-bold">Pilot Login</h1>
        <p className="mt-4 text-slate-300">
          CrewRules™ pilot access is coming soon.
        </p>

        <div className="mt-10 flex justify-center gap-4">
          <Link
            href="/"
            className="px-6 py-3 rounded-xl border border-slate-600 hover:border-white transition"
          >
            Back to Home
          </Link>
          <Link
            href="/request-access"
            className="px-6 py-3 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition"
          >
            Request Access
          </Link>
        </div>

        <p className="mt-10 text-xs text-slate-500">
          CrewRules™ is an independent pilot resource and is not affiliated with any airline, union, or
          regulatory authority.
        </p>
      </div>
    </main>
  );
}
