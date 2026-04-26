import Link from "next/link";

export const metadata = {
  title: "Terms of Service | CrewRules™",
  description: "Terms of Service for CrewRules™ flight operations workflow platform.",
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f6f1e8] text-slate-900">
      <div className="mx-auto w-full max-w-3xl min-w-0 cr-px-safe py-8 sm:py-12 md:py-16">
        <article className="rounded-sm border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/10 sm:p-8 md:p-10">
          <h1 className="font-serif text-2xl font-bold text-[#17324d] sm:text-3xl md:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-slate-600">Last updated: April 24, 2026</p>

          <div className="mt-10 space-y-10 text-sm leading-7 text-slate-700 md:text-base md:leading-8">
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">1. Acceptance of Terms</h2>
              <p>
                By accessing or using CrewRules™ (&ldquo;the Platform&rdquo;), you agree to be bound by these Terms of
                Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, you may not access or use the
                Platform.
              </p>
              <p>
                CrewRules™ reserves the right to modify these Terms at any time. Continued use of the Platform after
                updates constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">2. Description of Services</h2>
              <p>
                CrewRules™ is a digital flight operations workflow platform for Part 135, Part 91, corporate flight
                departments, and aviation operators.
              </p>
              <p>
                The Platform provides tools for organizing trips, crew communication, pilot acknowledgments, documents,
                training records, weather-related operational information, and related workflow records.
              </p>
              <p>
                CrewRules™ does not operate aircraft, provide dispatch services, make operational control decisions,
                determine crew legality, or replace company manuals, regulatory requirements, or approved operational
                procedures.
              </p>
              <p>All operational decisions remain the responsibility of the operator and authorized personnel.</p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">3. User Responsibilities</h2>
              <p>
                Users are responsible for maintaining accurate account information, protecting login credentials,
                uploading accurate and authorized documents, and using the Platform in accordance with applicable
                regulations, company policies, and approved procedures.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">4. Regulatory Responsibility</h2>
              <p>
                CrewRules™ is not a substitute for FAA regulations, company manuals, Operations Specifications,
                training requirements, dispatch procedures, crew duty rules, weather briefing requirements, or any
                other approved operational documentation.
              </p>
              <p>
                Any implementation of CrewRules™ within a certificated operation is subject to the operator&rsquo;s
                internal approval processes and applicable regulatory oversight.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">5. Data Ownership</h2>
              <p>
                User-submitted operational data, uploaded documents, training records, trip information,
                acknowledgments, invoices, and related records remain the property of the user or their respective
                organization.
              </p>
              <p>
                CrewRules™ provides hosting and workflow functionality only and does not claim ownership of
                user-submitted data.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">6. Data Availability and Backup</h2>
              <p>
                CrewRules™ makes reasonable efforts to maintain system availability and data integrity. However,
                uninterrupted or error-free access is not guaranteed. Operators and users remain responsible for
                maintaining independent copies of critical operational, regulatory, training, and financial records.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">7. Limitation of Liability</h2>
              <p>
                To the fullest extent permitted by law, CrewRules™ shall not be liable for direct, indirect, incidental,
                consequential, special, exemplary, or punitive damages arising from use of the Platform, inability to
                use the Platform, reliance on Platform data, service interruption, data loss, regulatory findings,
                delays, cancellations, or operational disruption.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">8. Intellectual Property</h2>
              <p>
                All CrewRules™ software, branding, design, structure, and proprietary materials are protected by
                intellectual property laws. Users may not reproduce, reverse engineer, modify, distribute, or create
                derivative works without prior written consent.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">9. Termination</h2>
              <p>
                CrewRules™ may suspend or terminate access for non-payment, breach of these Terms, misuse of the
                Platform, or activity that creates operational, legal, security, or compliance risk.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">10. Contact</h2>
              <p>
                For legal or contractual inquiries, contact CrewRules™ through the official contact options provided on
                the CrewRules™ website.
              </p>
            </section>
          </div>
        </article>

        <p className="mt-8 text-center text-sm text-slate-600">
          <Link
            href="/cr135"
            className="inline-flex min-h-11 items-center justify-center px-2 font-semibold text-[#17324d] underline decoration-[#17324d]/30 underline-offset-4 transition hover:text-amber-700 hover:decoration-amber-600/50"
          >
            Back to CrewRules™
          </Link>
        </p>
      </div>
    </main>
  );
}
