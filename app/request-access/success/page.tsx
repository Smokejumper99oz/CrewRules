import Link from "next/link";

type PageProps = {
  searchParams: Promise<{
    airline?: string;
    live?: string;
    signupRoute?: string;
    /** Present when user joined waitlist as flight attendant (request-access flow). */
    role?: string;
  }>;
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
  const waitlistRoleSuffix = params.role === "fa" ? " Flight Attendant" : "";

  const cardClass =
    "rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] shadow-lg shadow-black/30 p-6 sm:p-8 md:p-10";

  const primaryCtaClass =
    "flex w-full items-center justify-center rounded-xl bg-[#75C043] px-5 py-3.5 sm:py-3 text-center text-base sm:text-[0.9375rem] font-semibold text-slate-950 hover:brightness-110 transition min-h-[48px] sm:min-h-0";

  return (
    <main className="min-h-screen bg-slate-950 text-white pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="mx-auto flex min-h-screen w-full max-w-lg sm:max-w-xl items-center justify-center px-4 sm:px-6 md:px-8 py-10 sm:py-14 md:py-16">
        <div className={`${cardClass} w-full`}>
          {isLive && signupRoute ? (
            <div className="mx-auto max-w-md text-center md:max-w-none">
              <h1 className="text-[1.625rem] font-bold leading-tight tracking-tight sm:text-3xl md:text-3xl">
                Thank You!
              </h1>
              <p className="mt-5 text-base leading-relaxed text-slate-300 sm:mt-6 sm:text-lg">
                Crew<span className="text-[#75C043]">Rules</span>™ is already live for{" "}
                <span className="font-semibold text-white">{airlineDisplay}</span>.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-slate-400 sm:text-[0.9375rem]">
                Create your account to get started.
              </p>
              <div className="mt-8 sm:mt-10">
                <Link href={signupRoute} className={primaryCtaClass}>
                  Create Account
                </Link>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-md text-center md:max-w-none">
              <h1 className="text-[1.625rem] font-bold leading-tight tracking-tight sm:text-3xl md:text-3xl">
                Thank You!
              </h1>
              <p className="mt-5 text-base leading-snug text-slate-200 sm:mt-6 sm:text-lg sm:leading-relaxed">
                We placed you on the waitlist for{" "}
                <span className="font-semibold text-white">
                  {airlineDisplay}
                  {waitlistRoleSuffix}
                </span>
                .
              </p>
              <p className="mx-auto mt-5 max-w-prose text-sm leading-relaxed text-slate-400 sm:mt-6 sm:text-[0.9375rem]">
                We review waitlist requests as we bring new airlines and crew roles onto CrewRules™.
                When it&apos;s your turn, we&apos;ll email you with a link to create your account—you
                won&apos;t need to join the waitlist again.
              </p>
              <p className="mt-4 text-xs leading-relaxed text-slate-400 sm:mt-5 sm:text-sm">
                Watch your inbox (and spam or promotions folders) so you don&apos;t miss that message.
              </p>
              <div className="mt-8 sm:mt-10">
                <Link href="/" className={primaryCtaClass}>
                  Back to Home
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
