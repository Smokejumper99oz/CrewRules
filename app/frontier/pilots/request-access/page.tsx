import Link from "next/link";

export default function RequestAccessPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <div className="max-w-xl w-full text-center">
        <h1 className="text-4xl font-bold">Request Access</h1>
        <p className="mt-4 text-slate-300">
          F9 Pilots — Request access to the Crew<span className="text-[#75C043]">Rules</span>™ portal.
        </p>
        <div className="mt-10">
          <Link
            href="/request-access"
            className="inline-block rounded-xl bg-[#75C043] px-6 py-3 font-semibold text-slate-950 hover:opacity-95 transition"
          >
            Go to Request Access Form
          </Link>
        </div>
        <div className="mt-8">
          <Link
            href="/frontier/pilots/login"
            className="text-slate-300 hover:text-white underline underline-offset-4"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </main>
  );
}
