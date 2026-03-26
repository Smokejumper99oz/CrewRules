import Link from "next/link";

export default function RequestAccessPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6">
      <div className="max-w-xl w-full text-center">
        <h1 className="text-4xl font-bold">Join Waitlist</h1>
        <p className="mt-4 text-slate-300">
          F9 Pilots — Join the waitlist for the Crew<span className="text-[#75C043]">Rules</span>™ portal.
        </p>
        <div className="mt-10">
          <Link
            href="/request-access"
            className="inline-block rounded-xl bg-[#75C043] px-6 py-3 font-semibold text-slate-950 hover:opacity-95 transition"
          >
            Go to Join Waitlist
          </Link>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
          <Link
            href="/"
            className="text-slate-300 hover:text-white underline underline-offset-4"
          >
            Back to Home
          </Link>
          <span className="text-slate-500">•</span>
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
