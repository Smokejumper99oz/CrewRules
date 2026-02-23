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
      <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400/30 to-cyan-400/20 ring-1 ring-white/10" />
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">
                CrewRules<span className="align-super text-xs">™</span>
              </div>
              <div className="text-xs text-slate-400">
                For Airline Pilots
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a className="hover:text-white" href="#features">Features</a>
            <a className="hover:text-white" href="#how">How it Works</a>
            <a className="hover:text-white" href="#pricing">Pricing</a>
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
              className="inline-flex rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Request Access
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-10 pt-16 md:pb-16 md:pt-20">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Answers with contract references • Built by airline pilots
            </div>

            <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-5xl">
              CrewRules<span className="align-super text-base">™</span> — The Smart Knowledge Platform{" "}
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
                    CrewRules™ returns a plain-English answer and links it back to the specific
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

            <div className="mt-4 text-center text-xs text-slate-500">
              Tip: Once deployed, your link preview uses your OpenGraph image automatically.
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
      <section id="features" className="mx-auto max-w-6xl px-6 py-16">
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
            },
            {
              title: "Mentor Workflows",
              desc: "Mentor/mentee notes, progress tracking, and structured guidance for new hires and upgrades.",
            },
            {
              title: "Knowledge & Notes Hub",
              desc: "Bookmark sections, save personal notes, and keep your own references organized.",
            },
            {
              title: "Continuous Updates",
              desc: "Upload updated documents and re-index instantly so the system stays current.",
            },
          ].map((c) => (
            <div
              key={c.title}
              className="group rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-white/[0.03] p-6 shadow-lg shadow-black/20"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{c.title}</h3>
                  <p className="mt-2 text-sm text-slate-300 leading-relaxed">{c.desc}</p>
                </div>
                <div className="h-10 w-10 rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/25 group-hover:bg-emerald-500/20" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-white/5 bg-white/[0.03]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">How it Works</h2>
            <p className="mt-3 text-slate-300">
              Simple flow — fast answers — always referenced.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Login",
                desc: "Secure access for verified pilots and admins.",
              },
              {
                step: "2",
                title: "Ask or Explore",
                desc: "Search the contract, browse topics, or use mentoring tools.",
              },
              {
                step: "3",
                title: "Get Trusted Answers",
                desc: "Plain-English responses with the source citations attached.",
              },
            ].map((s) => (
              <div
                key={s.step}
                className="rounded-3xl border border-white/10 bg-slate-950/40 p-6"
              >
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-sm font-bold ring-1 ring-white/10">
                  {s.step}
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">Pricing</h2>
          <p className="mt-3 text-slate-300">
            Start simple now. Expand to Mentor tools and airline licensing later.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
            <div className="text-sm text-slate-400">Pilot</div>
            <div className="mt-2 text-2xl font-bold">Early Access</div>
            <div className="mt-3 text-slate-300 text-sm">
              Perfect for launching with contract Q&A + references.
            </div>

            <ul className="mt-6 space-y-3 text-sm text-slate-300">
              <li>✓ Contract AI search with citations</li>
              <li>✓ Bookmarks &amp; saved notes</li>
              <li>✓ Update-ready document library</li>
            </ul>

            <Link
              href="/request-access"
              className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100"
            >
              Request Access
            </Link>
          </div>

          <div className="relative rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/15 to-white/[0.03] p-7">
            <div className="absolute right-6 top-6 rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-200 ring-1 ring-emerald-500/30">
              Coming Next
            </div>

            <div className="text-sm text-slate-300">Mentor + Pro</div>
            <div className="mt-2 text-2xl font-bold">CrewRules™ Pro</div>
            <div className="mt-3 text-slate-200 text-sm">
              Designed for mentoring, career support, and deeper tools.
            </div>

            <ul className="mt-6 space-y-3 text-sm text-slate-200">
              <li>✓ Mentor/mentee workflows</li>
              <li>✓ Progress tracking &amp; notes history</li>
              <li>✓ Advanced search &amp; update alerts</li>
            </ul>

            <Link
              href="/request-access"
              className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Join the Waitlist
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          CrewRules™ is an independent pilot resource and is not affiliated with any airline, union, or regulatory authority.
          Always consult official documents for authoritative guidance.
        </p>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-white/5 bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">FAQ</h2>
            <p className="mt-3 text-slate-300">Quick answers to common questions.</p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {[
              {
                q: "Does CrewRules™ replace the contract?",
                a: "No. It provides fast answers with citations back to the official source so you can verify instantly.",
              },
              {
                q: "Can this work for multiple airlines later?",
                a: "Yes. The platform can be structured by airline \"tenant\" so each carrier has its own documents and rules.",
              },
              {
                q: "Will you offer mentoring features?",
                a: "Yes. Mentoring tools and notes workflows are planned as a Pro feature set once the core platform is stable.",
              },
              {
                q: "How do updates work?",
                a: "Admins upload the latest documents; the system re-indexes so questions reference the newest version.",
              },
            ].map((item) => (
              <div key={item.q} className="rounded-3xl border border-white/10 bg-slate-950/40 p-6">
                <div className="text-sm font-semibold">{item.q}</div>
                <div className="mt-2 text-sm text-slate-300 leading-relaxed">{item.a}</div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex justify-center">
            <Link
              href="/request-access"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
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
                CrewRules<span className="align-super text-xs">™</span>
              </div>
              <div className="mt-1 text-sm text-slate-400">
                The Smart Knowledge Platform for Airline Pilots
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm text-slate-400">
              <a className="hover:text-white" href="#features">Features</a>
              <a className="hover:text-white" href="#how">How it Works</a>
              <a className="hover:text-white" href="#pricing">Pricing</a>
              <Link className="hover:text-white" href="/login">Login</Link>
            </div>
          </div>

          <div className="mt-8 text-xs text-slate-500 leading-relaxed">
            © {new Date().getFullYear()} CrewRules™. All rights reserved. <br />
            CrewRules™ is an independent pilot resource and is not affiliated with any airline, union, or regulatory authority.
            Information provided is for reference only. Always consult official documents for authoritative guidance.
          </div>
        </div>
      </footer>
    </main>
  );
}
