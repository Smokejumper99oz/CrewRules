import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-900 text-white">
      {/* HERO */}
      <section className="px-6 py-24 text-center max-w-5xl mx-auto">
        <h1 className="text-5xl font-bold tracking-tight">
          CrewRules™ — The Smart Knowledge Platform for Airline Pilots
        </h1>

        <p className="mt-6 text-xl text-slate-300">
          Contract clarity. Mentoring support. Trusted answers — all in one
          place. Built by airline pilots to simplify complex agreements and
          support professional growth.
        </p>

        <div className="mt-10 flex justify-center gap-6">
          <Link
            href="/login"
            className="px-8 py-3 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 transition"
          >
            Pilot Login
          </Link>

          <Link
            href="/request-access"
            className="px-8 py-3 rounded-xl border border-slate-500 hover:border-white transition"
          >
            Request Access
          </Link>
        </div>
      </section>

      {/* VALUE STRIP */}
      <section className="bg-slate-800 py-12">
        <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-8 px-6 text-center">
          <div>✔ Contract answers with referenced sources</div>
          <div>✔ Pilot mentoring tools</div>
          <div>✔ Always up-to-date documents</div>
          <div>✔ Built by airline pilots</div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-16">
          Designed for Real Airline Operations
        </h2>

        <div className="grid md:grid-cols-2 gap-16">
          <div>
            <h3 className="text-2xl font-semibold mb-4">Contract AI Search</h3>
            <p className="text-slate-300">
              Ask questions in plain English and receive clear answers with
              direct contract references. No more digging through hundreds of
              pages.
            </p>
          </div>

          <div>
            <h3 className="text-2xl font-semibold mb-4">
              Pilot Mentoring Platform
            </h3>
            <p className="text-slate-300">
              Structured tools to support new hires, upgrades, and career
              progression through organized mentoring workflows.
            </p>
          </div>

          <div>
            <h3 className="text-2xl font-semibold mb-4">
              Knowledge & Notes Hub
            </h3>
            <p className="text-slate-300">
              Bookmark important sections, save interpretations, and keep
              operational insights organized and accessible anywhere.
            </p>
          </div>

          <div>
            <h3 className="text-2xl font-semibold mb-4">
              Continuous Document Updates
            </h3>
            <p className="text-slate-300">
              Stay aligned with the latest CBAs and LOAs through automatic
              indexing and update notifications.
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-slate-800 py-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">How It Works</h2>

          <div className="grid md:grid-cols-3 gap-12 text-slate-300">
            <div>
              <h4 className="font-semibold text-white mb-2">1. Login</h4>
              Secure access for verified airline pilots.
            </div>

            <div>
              <h4 className="font-semibold text-white mb-2">
                2. Ask or Explore
              </h4>
              Search contracts, access mentoring tools, or review saved notes.
            </div>

            <div>
              <h4 className="font-semibold text-white mb-2">
                3. Get Trusted Answers
              </h4>
              Receive clear explanations with direct source references.
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="py-24 px-6 max-w-5xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-6">Built by Airline Pilots</h2>

        <p className="text-slate-300 text-lg">
          CrewRules™ is an independent knowledge platform created to simplify
          contract understanding and support professional development. It is
          designed to reduce confusion, improve mentoring, and provide clarity
          when it matters most.
        </p>
      </section>

      {/* CTA */}
      <section className="bg-emerald-500 text-black py-20 text-center">
        <h2 className="text-3xl font-bold mb-6">
          Ready to simplify your contract knowledge?
        </h2>

        <Link
          href="/login"
          className="inline-block px-8 py-3 rounded-xl bg-black text-white font-semibold hover:bg-slate-900 transition"
        >
          Pilot Login
        </Link>
      </section>

      {/* FOOTER */}
      <footer className="bg-slate-900 border-t border-slate-700 py-10 text-center text-sm text-slate-400">
        <p>© 2026 CrewRules™. All rights reserved.</p>
        <p className="mt-2">
          CrewRules™ is an independent pilot resource and is not affiliated with
          any airline, union, or regulatory authority. Always consult official
          documents for authoritative guidance.
        </p>
      </footer>
    </main>
  );
}
