import Image from "next/image";
import Link from "next/link";
import { LandingHeader } from "@/components/landing-header";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const levelsFlightCrewFeatures = [
    "Decoded schedule with trips, duty & timelines",
    "Current trip, next duty & upcoming trips",
    "Commute insights from your schedule",
    "Month Credit Projection",
    "Mentoring access",
    "Family View™ (1 member)",
    "Basic Weather Brief (Pilots only)",
    "Basic AI search",
  ];
  const levelsProFeatures = [
    "Full Commute Assist™ — smarter routes & planning",
    "Full Family View™ — complete schedule visibility",
    "Advanced Weather Brief™ — powered by PlaneWX",
    "Full Pay & Month Credit Projection",
    "Full Mentorship tools & connections",
    "Full AI search with deeper contract insights",
  ];
  const levelsEnterpriseFeatures = [
    "Everything in Pro — full CrewRules™ experience",
    "Custom features & workflow development",
    "Airline-specific rules, policies & integrations",
    "Admin dashboard & user management controls",
    "Base-specific tools & shared crew insights",
    "Dedicated support & onboarding",
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-emerald-500/12 blur-3xl" />
        <div className="absolute top-24 right-[-220px] h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-[-220px] left-[-220px] h-[520px] w-[520px] rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_55%)]" />
      </div>

      <LandingHeader />

      {/* Hero */}
      <section className="relative w-full overflow-hidden min-h-[60vh] lg:min-h-[65vh] xl:min-h-[60vh] 2xl:min-h-[55vh]">
        <div className="absolute inset-0 z-0">
          <Image
            src="/hero/crewrules-bg.png"
            alt="CrewRules background"
            fill
            priority
            className="object-cover object-center opacity-90"
          />
          <div className="absolute inset-0 bg-slate-950/40" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(2,6,23,0.4)_70%,rgba(2,6,23,0.75)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-6 pt-16 pb-12 lg:pt-20 lg:pb-14 xl:pt-16 xl:pb-10 2xl:pt-14 2xl:pb-8">
          <div className="grid gap-10 md:grid-cols-2 md:items-start">
            <div className="max-w-xl">
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                <span className="md:whitespace-nowrap">
                  Crew<span className="text-[#75C043]">Rules</span>
                  <span className="align-super text-base">™</span> —
                </span>
                <br className="hidden md:block" />
                <span className="md:whitespace-nowrap">The Smart Platform</span>
                <br className="hidden md:block" />
                <span className="text-slate-300 md:whitespace-nowrap">for Airline Crew</span>
              </h1>

              <p className="mt-5 text-lg text-slate-300">
                Developed by airline pilots for real Part 121 operations — delivering operational clarity with tools that extend to Part 135 and Part 91 flying.
              </p>
              <p className="mt-2 text-lg text-slate-400">
                From FAR 117 compliance to contract interpretation and commute planning — built for how crews actually operate.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/frontier/pilots/login"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100"
                >
                  Login
                </Link>
                <Link
                  href="/request-access"
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Join Waitlist
                </Link>
              </div>
            </div>

            {/* Hero "product" mock */}
            <div className="flex w-full justify-end min-w-0">
              <div className="relative w-full max-w-[520px]">
                <div className="absolute -inset-6 rounded-[28px] bg-gradient-to-br from-emerald-500/20 via-cyan-500/10 to-indigo-500/10 blur-2xl" />
                <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/60 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-300/80" />
                    <div className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
                  </div>
                  <div className="text-xs text-slate-400">CrewRules™ • Contract AI</div>
                  <div className="text-xs text-slate-400">Secure</div>
                </div>

                <div className="p-5">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                    <div className="text-xs text-slate-400">Pilot question</div>
                    <div className="mt-2 text-sm text-white">
                      &quot;I&apos;m on short call reserve on my last day — can scheduling extend me past midnight?&quot;
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Answer</div>
                      <div className="text-xs text-emerald-300">Citations included</div>
                    </div>
                    <p className="mt-2 text-sm text-slate-200 leading-relaxed">
                      Crew<span className="text-[#75C043]">Rules</span>™ returns a plain-English answer and links it back to the specific
                      contract paragraph(s) so you can verify instantly.
                    </p>

                    <div className="mt-3 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 p-3">
                      <div className="text-xs text-emerald-200">
                        Reference example: Section 25.X • Page ### (sample)
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {[
                      { t: "Reserve", s: "Rules + buckets" },
                      { t: "Pay", s: "Credits explained" },
                      { t: "Mentor", s: "Notes & tracking" },
                    ].map((x) => (
                      <div
                        key={x.t}
                        className="rounded-2xl border border-white/10 bg-slate-950/30 p-3"
                      >
                        <div className="text-xs font-semibold text-white">{x.t}</div>
                        <div className="mt-1 text-[11px] text-slate-400">{x.s}</div>
                      </div>
                    ))}
                  </div>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="my-16">
        <div className="relative h-px w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute inset-0 blur-sm bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
        </div>
      </div>

      <section id="current-trip" className="scroll-mt-24 mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 items-start lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Current <span className="text-[#75C043]">Trip</span>™ — Know exactly where you stand
            </h2>

            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
              See your current trip, delays, duty limits, and next steps in one place.
              From FAR 117 alerts to commute planning — everything is connected.
            </p>

            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-[#75C043]" />
                <span>Live trip status with delay awareness</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-[#75C043]" />
                <span>FAR 117 tracking and duty limits</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-[#75C043]" />
                <span>Timeline view with remaining duty time</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-[#75C043]" />
                <span>Direct connection to Commute Assist™</span>
              </div>
            </div>
          </div>

          <div className="relative flex justify-end min-w-0">
            <div className="relative w-[90%]">
              <div className="relative">
                <div className="pointer-events-none absolute -inset-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 blur-2xl opacity-70" />

                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-md shadow-[0_0_60px_-20px_rgba(16,185,129,0.25)]">
                  <img
                    src="/hero/crewrules-current-trip-feature.png"
                    alt="CrewRules Current Trip and Commute Assist preview"
                    className="block w-full h-auto"
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="my-16">
        <div className="relative h-px w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute inset-0 blur-sm bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
        </div>
      </div>

      <section id="commute-assist" className="scroll-mt-24 mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 items-start lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Commute <span className="text-[#75C043]">Assist</span>™ — Real commuting decisions, not guesswork
            </h2>

            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
              See real flight options from your home airport with timing, buffers, and risk clearly laid out.
              Evaluate commute options before it matters.
            </p>

            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-[#75C043]" />
                <span>Home → Base commute planning</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-[#75C043]" />
                <span>Built around report time and buffers</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-[#75C043]" />
                <span>Clear risk visibility, not just schedules</span>
              </div>
            </div>
          </div>

          <div className="relative flex justify-end min-w-0">
            <div className="relative w-[90%]">
              <div className="relative">
                <div className="pointer-events-none absolute -inset-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 blur-2xl opacity-70" />

                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-md shadow-[0_0_60px_-20px_rgba(16,185,129,0.25)]">
                  <img
                    src="/hero/commute-assist-feature.png"
                    alt="CrewRules Commute Assist preview"
                    className="block w-full h-auto"
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="my-16">
        <div className="relative h-px w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute inset-0 blur-sm bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
        </div>
      </div>

      <section id="pay" className="scroll-mt-24 mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 items-start lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Pay <span className="text-[#75C043]">Projections</span>™ — Credits, trips, and estimates in one view
            </h2>

            <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
              Track trips, reserve, days off, and credited time with a clear month snapshot. Pay estimates help you
              anticipate payouts — with privacy controls when you need to hide numbers on screen.
            </p>

            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-[#75C043]" />
                <span>Monthly stats: trips, reserve, days off, and credit</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-[#75C043]" />
                <span>Pay estimate cards with show / hide for sensitive totals</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-[#75C043]" />
                <span>Estimates for planning — not a substitute for official payroll</span>
              </div>
            </div>
          </div>

          <div className="relative flex justify-end min-w-0">
            <div className="relative w-[90%]">
              <div className="relative">
                <div className="pointer-events-none absolute -inset-6 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 blur-2xl opacity-70" />

                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-md shadow-[0_0_60px_-20px_rgba(16,185,129,0.25)]">
                  <img
                    src="/hero/pay-month-overview-feature.png"
                    alt="CrewRules Month Overview and pay estimate preview"
                    className="block w-full h-auto"
                  />
                  <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="my-16">
        <div className="relative h-px w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute inset-0 blur-sm bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
        </div>
      </div>

      {/* Features */}
      <section id="features" className="scroll-mt-24 mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-3xl font-bold tracking-tight">More Tools for Airline Crew</h2>
          <p className="mt-3 max-w-2xl text-slate-300">
            CrewRules™ brings together the tools that support contract clarity, mentoring, family coordination, weather awareness, and day-to-day operations.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {[
            {
              title: "AI Contract Insights",
              desc: "Ask contract questions in plain English and get cited answers back to the source text.",
              icon: "/icons/contract-ai.png",
            },
            {
              title: "Mentoring",
              desc: "Support new hires, upgrades, and career progression with structured mentoring tools and notes.",
              icon: "/icons/mentor.png",
              sectionId: "mentoring",
            },
            {
              title: "Family View™",
              desc: "Give your family a clearer view of your schedule so home and work stay better connected.",
              icon: "/icons/family-view.png",
              sectionId: "family-view",
            },
            {
              title: "Weather Brief",
              desc: "Get operational weather visibility with tools that support smarter day-of-flight awareness.",
              icon: "/icons/weather.png",
              sectionId: "weather-brief",
            },
          ].map((c) => (
            <div
              key={c.title}
              id={"sectionId" in c ? c.sectionId : undefined}
              className="group scroll-mt-24 rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-white/[0.03] p-6 shadow-lg shadow-black/20 transition-all duration-200 hover:-translate-y-1 hover:border-[#75C043]/20 hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-white">{c.title}</h3>
                  <p className="mt-2 text-sm text-slate-300 leading-relaxed">{c.desc}</p>
                </div>
                {c.icon ? (
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur transition-all duration-200 group-hover:border-[#75C043]/30 group-hover:bg-white/10">
                    <div className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-hover:shadow-[0_0_28px_rgba(117,192,67,0.18)]" />
                    <Image
                      src={c.icon}
                      alt=""
                      fill
                      className="rounded-2xl object-cover opacity-95"
                      sizes="80px"
                    />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/25 group-hover:bg-emerald-500/20 shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="my-16">
        <div className="relative h-px w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute inset-0 blur-sm bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
        </div>
      </div>

      {/* Levels */}
      <section id="levels" className="scroll-mt-24 mx-auto max-w-6xl px-6 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">Crew<span className="text-[#75C043]">Rules</span>™ Access Levels</h2>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex h-full min-h-0 flex-col rounded-3xl border border-white/10 bg-white/5 p-7">
            {/* Eyebrow Label */}
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              FLIGHT CREW
            </p>
            <div className="mt-2 text-2xl font-bold">Crew<span className="text-[#75C043]">Rules</span>™</div>
            <div className="mt-3 text-slate-300 text-sm">
              Built for Airline Crew — Your schedule, trips, and basics in one place.
            </div>

            <ul className="mt-6 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              {levelsFlightCrewFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  {/* Icon */}
                  <span className="mt-[3px] text-green-500 flex-shrink-0">
                    ✓
                  </span>
                  {/* Text */}
                  <span className="leading-snug">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <Button
              href="/login"
              variant="default"
              className="mt-auto inline-flex w-full items-center justify-center rounded-xl bg-[#75C043] py-3 text-sm font-medium text-slate-950 transition hover:brightness-110 hover:shadow-lg active:scale-[0.98]"
            >
              Start Free
            </Button>
          </div>

          <div className="relative flex h-full min-h-0 flex-col scale-[1.03] transform rounded-3xl border border-emerald-400/60 bg-gradient-to-b from-[#75C043]/16 via-[#75C043]/8 to-white/[0.04] p-7 shadow-[0_0_25px_rgba(117,192,67,0.25)] ring-1 ring-emerald-500/30 transition-all duration-300">
            <div className="absolute right-6 top-6 flex flex-col items-center rounded-full bg-emerald-500/20 px-3 py-1.5 text-xs leading-tight text-white ring-1 ring-emerald-500/30">
              <span>SAVE 31%</span>
              <span className="mt-0.5 font-normal">(Annual)</span>
            </div>
            {/* Eyebrow Label */}
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              FLIGHT CREW
            </p>
            <div className="mt-2 text-2xl font-bold">Crew<span className="text-[#75C043]">Rules</span>™ Pro</div>
            <div className="mt-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-3xl font-bold text-white">$11.99</span>
                <span className="text-sm text-slate-300">/ month</span>
                <span className="text-slate-500">or</span>
                <span className="text-2xl font-semibold text-white">$99</span>
                <span className="text-sm text-slate-300">/ year</span>
              </div>
              <div className="mt-3 text-xs text-[#75C043]">
                <div className="font-bold">Founding Pilot — Lock in $59/year for life</div>
                <div className="mt-1.5 font-normal">(100 spots per airline)</div>
              </div>
            </div>
            <div className="mt-5 text-slate-200 text-sm">
              Everything in Free — plus the full CrewRules™ experience.
            </div>

            <ul className="mt-7 space-y-2.5 text-sm text-slate-700 dark:text-slate-200">
              {levelsProFeatures.map((feature) => {
                const planeWxParts = feature.split("PlaneWX");
                return (
                  <li key={feature} className="flex items-start gap-2">
                    {/* Icon */}
                    <span className="mt-[3px] text-green-500 flex-shrink-0">
                      ✓
                    </span>
                    {/* Text */}
                    <span className="leading-snug">
                      {planeWxParts.length === 2 ? (
                        <>
                          {planeWxParts[0]}
                          <a
                            href="https://www.planewx.ai/?ref=46AC7263"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#2EC2F2] underline-offset-2 hover:underline"
                          >
                            PlaneWX
                          </a>
                          {planeWxParts[1]}
                        </>
                      ) : (
                        feature
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-8 min-h-0 flex-1 basis-0" aria-hidden />
            <Link
              href="/login"
              className="shrink-0 inline-flex w-full items-center justify-center rounded-xl bg-amber-500/90 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-500"
            >
              Start Pro Trial — 14 Days
            </Link>
          </div>

          <div className="flex h-full min-h-0 flex-col rounded-3xl border border-white/10 bg-gradient-to-b from-slate-950 to-slate-900/80 p-7 shadow-[0_0_20px_rgba(255,255,255,0.06)]">
            {/* Eyebrow Label */}
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Airlines • Unions • Flight Departments
            </p>
            <div className="mt-2 text-2xl font-bold">Crew<span className="text-[#75C043]">Rules</span>™ Enterprise</div>
            <div className="mt-3 text-slate-300 text-sm">
              Built for airlines — customize CrewRules™ to your operation.
            </div>

            <ul className="mt-6 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              {levelsEnterpriseFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  {/* Icon */}
                  <span className="mt-[3px] text-green-500 flex-shrink-0">
                    ✓
                  </span>
                  {/* Text */}
                  <span className="leading-snug">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <Button
              href="/contact"
              className="mt-auto inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.07] px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Contact Sales
            </Button>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          CrewRules™ is an independent pilot resource and is not affiliated with any airline, union, or regulatory authority.
          Always consult official documents for authoritative guidance.
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">
                Crew<span className="text-[#75C043]">Rules</span><span className="align-super text-xs">™</span>
              </div>
              <div className="mt-1 text-sm text-slate-400">
                The Smart Knowledge Platform for Airline Crew
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-slate-400">
              <Link className="hover:text-white" href="/contact">Contact Us</Link>
              <Link className="hover:text-white" href="/frontier/pilots/login">Login</Link>
            </div>
          </div>

          <div className="mt-8 text-xs text-slate-500 leading-relaxed">
            © {new Date().getFullYear()} CrewRules™. All rights reserved. <br />
            CrewRules™ is an independent pilot resource and is not affiliated with any airline, union, or regulatory authority.
            Information provided is for reference only.<br />
            Always consult official documents for authoritative guidance.
          </div>
        </div>
      </footer>
    </main>
  );
}
