import Link from "next/link";

type PageProps = {
  searchParams: Promise<{ airline?: string; live?: string; signupRoute?: string }>;
};

function formatAirline(airline: string | undefined): string {
  if (!airline?.trim()) return "your airline";
  return airline
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export default async function RequestAccessSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const airline = params.airline;
  const isLive = params.live === "1";
  const signupRoute = params.signupRoute;
  const airlineDisplay = formatAirline(airline);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-lg w-full px-6 py-16">
        <div className="rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20 p-8 shadow-lg shadow-black/30">
          {isLive && signupRoute ? (
            <>
              <h1 className="text-3xl font-bold text-center tracking-tight">Thank You!</h1>
              <p className="mt-4 text-slate-300 text-center">
                Crew<span className="text-[#75C043]">Rules</span>™ is already live for {airlineDisplay}.
              </p>
              <p className="mt-2 text-sm text-slate-400 text-center">
                Create your account to get started.
              </p>
              <div className="mt-8">
                <Link
                  href={signupRoute}
                  className="block w-full text-center rounded-xl bg-[#75C043] px-6 py-3 font-semibold text-slate-950 hover:brightness-110 transition"
                >
                  Create Account
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-center tracking-tight">Thank You!</h1>
              <p className="mt-4 text-slate-300 text-center">
                We placed you on the Waitlist for {airlineDisplay}.
              </p>
              <p className="mt-4 text-sm text-slate-400 text-center">
                We&apos;ll review your request and notify you when access is available for your airline.
              </p>
              <p className="mt-2 text-xs text-slate-500 text-center">
                Please keep an eye on your email.
              </p>
              <div className="mt-8">
                <Link
                  href="/"
                  className="block w-full text-center rounded-xl bg-[#75C043] px-6 py-3 font-semibold text-slate-950 hover:brightness-110 transition"
                >
                  Back to Home
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
