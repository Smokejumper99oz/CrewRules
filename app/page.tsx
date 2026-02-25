import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-emerald-500/12 blur-3xl" />
        <div className="absolute top-24 right-[-220px] h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-[-220px] left-[-220px] h-[520px] w-[520px] rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_55%)]" />
      </div>

      {/* Top Nav */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/30 backdrop-blur-md">
        <div className="relative mx-auto flex max-w-6xl items-center justify-between px-6 pt-4 pb-6">
          <div className="flex items-center gap-3">
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">
                Crew<span className="text-[#75C043]">Rules</span><span className="align-super text-xs">™</span>
              </div>
              <div className="text-xs text-slate-400">
                For Airline Pilots
              </div>
            </div>
          </div>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-6 text-sm text-slate-300 md:flex">
            <a className="hover:text-white" href="#features">Features</a>
            <a className="hover:text-white" href="#how">How it Works</a>
            <a className="hover:text-white" href="#levels">Levels</a>
            <a className="hover:text-white" href="#faq">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 md:inline-flex"
            >
              Pilot Login
            </Link>
            <Link
              href="/request-access"
              className="inline-flex rounded-xl bg-[#75C043] px-4 py-2 text-sm font-semibold text-slate-950 hover:brightness-110 transition"
            >
              Request Access
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative w-full overflow-hidden min-h-[85vh]">
        {/* HERO BACKGROUND IMAGE - clearly visible like the example */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/hero/crewrules-bg.png"
            alt="CrewRules background"
            fill
            priority
            className="object-cover object-center opacity-90"
          />
          {/* Lighter overlay for text readability - allows image to show through */}
          <div className="absolute inset-0 bg-slate-950/40" />
          {/* Softer vignette - darker at edges, transparent in center */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(2,6,23,0.4)_70%,rgba(2,6,23,0.75)_100%)]" />
          {/* Bottom fade into next section */}
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-6 pb-10 pt-8 md:pb-16 md:pt-10">
          <div className="grid gap-10 md:grid-cols-2 md:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300">
              <span className="h-2 w-2 rounded-full bg-[#75C043]" />
              Answers with contract references • Built by airline pilots
            </div>

            <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-5xl">
              Crew<span className="text-[#75C043]">Rules</span><span className="align-super text-base">™</span> — The Smart Knowledge Platform{" "}
              <span className="text-slate-300">for Airline Pilots</span>
            </h1>

            <p className="mt-5 text-lg text-slate-300">
              Contract clarity, mentoring support, and trusted answers — all in one place.
              Ask questions in plain English and get citations back to the source.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100"
              >
                Pilot Login
              </Link>
              <Link
                href="/request-access"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Request Access
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-slate-300 hover:text-white"
              >
                Explore Features →
              </a>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-white font-semibold">Cited Answers</div>
                <div className="mt-1 text-slate-400">Section + page references</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-white font-semibold">Mentor Ready</div>
                <div className="mt-1 text-slate-400">Notes + mentoring workflows</div>
              </div>
            </div>
          </div>

          {/* Hero "product" mock */}
          <div className="relative">
            <div className="absolute -inset-6 rounded-[28px] bg-gradient-to-br from-emerald-500/20 via-cyan-500/10 to-indigo-500/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/60 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-300/80" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-400/80" />
                </div>
                <div className="text-xs text-slate-400">Crew<span className="text-[#75C043]">Rules</span>™ • Contract AI</div>
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
      </section>

      {/* Logos / trust strip */}
      <section className="mx-auto max-w-6xl px-6 pb-10">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              "Contract answers with references",
              "Pilot mentoring tools",
              "Always up-to-date documents",
              "Built by airline pilots",
            ].map((t) => (
              <div key={t} className="flex items-center gap-3 text-sm text-slate-200">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/25">
                  ✓
                </span>
                <span className="text-slate-300">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16 mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-3xl font-bold tracking-tight">Designed for Real Airline Operations</h2>
          <p className="mt-3 max-w-2xl text-slate-300">
            Fast answers, clear references, and tools that support day-to-day decisions — from reserve
            questions to mentoring and notes.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {[
            {
              title: "Contract AI Search",
              desc: "Ask questions in plain English and get cited answers back to the source text.",
              icon: "/icons/contract-ai.png",
            },
            {
              title: "Mentor Workflows",
              desc: "Mentor/mentee notes, progress tracking, and structured guidance for new hires and upgrades.",
              icon: "/icons/mentor.png",
            },
            {
              title: "Knowledge & Notes Hub",
              desc: "Bookmark sections, save personal notes, and keep your own references organized.",
              icon: "/icons/knowledge.png",
            },
            {
              title: "Continuous Updates",
              desc: "Upload updated documents and re-index instantly so the system stays current.",
              icon: "/icons/updates.png",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="group rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-white/[0.03] p-6 shadow-lg shadow-black/20 transition-all duration-200 hover:-translate-y-1 hover:border-[#75C043]/20 hover:bg-white/[0.06]"
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

      {/* How it works */}
      <section id="how" className="scroll-mt-16 relative border-y border-white/5 bg-white/[0.03]">
        {/* subtle background glow */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-64 w-[900px] -translate-x-1/2 rounded-full bg-[#75C043]/10 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_55%)]" />
        </div>

        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">How it Works</h2>
            <p className="mt-3 text-slate-300">
              Simple flow — fast answers — always referenced.
            </p>
          </div>

          {/* flow line (desktop) */}
          <div className="relative mt-12">
            <div className="pointer-events-none absolute left-1/2 top-1/2 hidden h-px w-[92%] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-white/8 to-transparent md:block" aria-hidden />
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Login",
                  desc: "Secure access for verified pilots and admins.",
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                      <path
                        d="M10 7V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-1"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M3 12h10m0 0-3-3m3 3-3 3"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ),
                },
                {
                  step: "2",
                  title: "Ask or Explore",
                  desc: "Search the contract, browse topics, or use mentoring tools.",
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                      <path
                        d="M10.5 6.5h-4A2.5 2.5 0 0 0 4 9v8a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 17v-4"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M14 10l6-6"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M15.5 4h4.5v4.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ),
                },
                {
                  step: "3",
                  title: "Get Trusted Answers",
                  desc: "Plain-English responses with the source citations attached.",
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                      <path
                        d="M7 12l3 3 7-7"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeOpacity="0.6"
                      />
                    </svg>
                  ),
                },
              ].map((s) => (
                <div
                  key={s.step}
                  className="group relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/40 p-7 shadow-lg shadow-black/20 transition-all duration-200 hover:-translate-y-1 hover:border-[#75C043]/20 hover:bg-white/[0.05]"
                >
                  {/* top highlight */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#75C043]/35 to-transparent" />

                  {/* corner glow */}
                  <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-[#75C043]/10 blur-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

                  <div className="flex min-h-[44px] items-center justify-between gap-4">
                    <div className="inline-flex min-w-0 flex-1 items-center gap-2 text-xs text-slate-400">
                      <span className="font-semibold text-[#75C043]">Step {s.step}</span>
                      <span className="h-1 w-1 shrink-0 rounded-full bg-white/20" />
                      <span className="truncate">{s.title}</span>
                    </div>

                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-[#75C043] transition-all duration-200 group-hover:border-[#75C043]/30 group-hover:bg-white/[0.08]">
                      {s.icon}
                    </div>
                  </div>

                  <h3 className="mt-6 text-xl font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-slate-300 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Levels */}
      <section id="levels" className="scroll-mt-16 mx-auto max-w-6xl px-6 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">Crew<span className="text-[#75C043]">Rules</span>™ Access Levels</h2>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
            <div className="text-sm text-slate-400">Pilot</div>
            <div className="mt-2 text-2xl font-bold">Crew<span className="text-[#75C043]">Rules</span>™ Access</div>
            <div className="mt-3 text-slate-300 text-sm">
              Get clear contract answers with direct citations — built specifically for airline pilots.
            </div>

            <ul className="mt-6 space-y-3 text-sm text-slate-300">
              <li><span className="text-[#75C043]">✓</span> Plain-English answers with source references</li>
              <li><span className="text-[#75C043]">✓</span> Save key sections and personal notes</li>
              <li><span className="text-[#75C043]">✓</span> Always-current contract documents</li>
            </ul>

            <Link
              href="/request-access"
              className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100"
            >
              Get Crew<span className="text-[#75C043]">Rules</span>™ Access
            </Link>
          </div>

          <div className="relative rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-[#75C043]/10 to-white/[0.03] p-7">
            <div className="absolute right-6 top-6 rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-200 ring-1 ring-emerald-500/30">
              Pro Features Coming Soon
            </div>

            <div className="text-sm text-slate-300">Pilot + Mentor</div>
            <div className="mt-2 text-2xl font-bold">Crew<span className="text-[#75C043]">Rules</span>™ Pro</div>
            <div className="mt-3 text-slate-200 text-sm">
              Advanced tools for mentoring, career progression, and deeper contract insights — built specifically for airline pilots.
            </div>

            <ul className="mt-6 space-y-3 text-sm text-slate-200">
              <li><span className="text-[#75C043]">✓</span> Mentor/mentee workflows</li>
              <li><span className="text-[#75C043]">✓</span> Progress tracking and notes history</li>
              <li><span className="text-[#75C043]">✓</span> Advanced search and update alerts</li>
            </ul>

            <Link
              href="/request-access"
              className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-[#75C043] px-5 py-3 text-sm font-semibold text-slate-950 hover:brightness-110 transition"
            >
              Join the Waitlist
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          Crew<span className="text-[#75C043]">Rules</span>™ is an independent pilot resource and is not affiliated with any airline, union, or regulatory authority.
          Always consult official documents for authoritative guidance.
        </p>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-16 border-t border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">FAQ</h2>
            <p className="mt-3 text-slate-300">Quick answers to common questions.</p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {[
              {
                key: "replace",
                q: <>Does Crew<span className="text-[#75C043]">Rules</span>™ replace the contract?</>,
                a: "No. It provides fast answers with citations back to the official source so you can verify instantly.",
              },
              {
                key: "multi-airline",
                q: "Can this work for multiple airlines later?",
                a: "Yes. The platform can be structured by airline \"tenant\" so each carrier has its own documents and rules.",
              },
              {
                key: "mentoring",
                q: "Will you offer mentoring features?",
                a: "Yes. Mentoring tools and notes workflows are planned as a Pro feature set once the core platform is stable.",
              },
              {
                key: "updates",
                q: "How do updates work?",
                a: "Admins upload the latest documents; the system re-indexes so questions reference the newest version.",
              },
            ].map((item) => (
              <div key={item.key ?? item.q} className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
                <div className="text-sm font-semibold">{item.q}</div>
                <div className="mt-2 text-sm text-slate-300 leading-relaxed">{item.a}</div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex justify-center">
            <Link
              href="/request-access"
              className="inline-flex items-center justify-center rounded-xl bg-[#75C043] px-6 py-3 text-sm font-semibold text-slate-950 hover:brightness-110 transition"
            >
              Request Access
            </Link>
          </div>
        </div>
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
                The Smart Knowledge Platform for Airline Pilots
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-slate-400">
              <a className="hover:text-white" href="#features">Features</a>
              <a className="hover:text-white" href="#how">How it Works</a>
              <a className="hover:text-white" href="#levels">Levels</a>
              <Link className="hover:text-white" href="/login">Login</Link>
            </div>
          </div>

          <div className="mt-8 text-xs text-slate-500 leading-relaxed">
            © {new Date().getFullYear()} Crew<span className="text-[#75C043]">Rules</span>™. All rights reserved. <br />
            Crew<span className="text-[#75C043]">Rules</span>™ is an independent pilot resource and is not affiliated with any airline, union, or regulatory authority.
            Information provided is for reference only.<br />
            Always consult official documents for authoritative guidance.
          </div>
        </div>
      </footer>
    </main>
  );
}
