import Link from "next/link";

export const metadata = {
  title: "Privacy & Cookie Statement | CrewRules™",
  description: "Privacy and cookie practices for CrewRules™.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f6f1e8] text-slate-900">
      <div className="mx-auto w-full max-w-3xl min-w-0 cr-px-safe py-8 sm:py-12 md:py-16">
        <article className="rounded-sm border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/10 sm:p-8 md:p-10">
          <h1 className="font-serif text-2xl font-bold text-[#17324d] sm:text-3xl md:text-4xl">
            Privacy &amp; Cookie Statement
          </h1>
          <p className="mt-2 text-sm text-slate-600">Last updated: April 24, 2026</p>

          <div className="mt-10 space-y-10 text-sm leading-7 text-slate-700 md:text-base md:leading-8">
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">1. Introduction</h2>
              <p>
                CrewRules™ (&ldquo;CrewRules™,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) respects
                your privacy. This Privacy &amp; Cookie Statement (&ldquo;Statement&rdquo;) describes how we collect,
                use, store, and protect information when you visit our websites, use the CrewRules™ platform
                (&ldquo;Platform&rdquo;), or otherwise interact with our services.
              </p>
              <p>
                By using our websites or Platform, you acknowledge this Statement. If you do not agree, please do not
                use our services.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">2. Information We Collect</h2>
              <p>We may collect the following categories of information, depending on how you use CrewRules™:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <span className="font-semibold text-slate-800">Account and contact data:</span> name, email address,
                  organization, job role, and similar identifiers you provide when registering, requesting a demo, or
                  contacting us.
                </li>
                <li>
                  <span className="font-semibold text-slate-800">Operational and content data:</span> trip details,
                  crew communications, acknowledgments, documents, training records, uploads, and other workflow
                  information you or your organization submit to the Platform.
                </li>
                <li>
                  <span className="font-semibold text-slate-800">Technical and usage data:</span> IP address, device
                  and browser type, general location derived from IP, pages viewed, referring URLs, and similar
                  diagnostics that help us operate and secure the service.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">3. How We Use Information</h2>
              <p>We use collected information to:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Provide, maintain, and improve the Platform and related support;</li>
                <li>Authenticate users, enforce security, and detect fraud or abuse;</li>
                <li>Communicate about service updates, billing (where applicable), and administrative notices;</li>
                <li>Comply with legal obligations and respond to lawful requests;</li>
                <li>Analyze aggregated or de-identified usage to improve product experience.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">4. Cookies and Similar Technologies</h2>
              <p>
                We use cookies and similar technologies (such as local storage or pixels) to remember preferences,
                maintain sessions, measure site performance, and understand how visitors use our marketing pages.
              </p>
              <p>
                You can control cookies through your browser settings. Blocking certain cookies may limit functionality
                (for example, staying signed in). Where required by law, we will obtain consent before using non-essential
                cookies.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">5. Sharing of Information</h2>
              <p>
                We do not sell your personal information. We may share information with service providers who assist
                us (for example, hosting, email delivery, analytics, or payment processing) subject to contractual
                confidentiality and security obligations.
              </p>
              <p>
                We may disclose information if required by law, regulation, legal process, or to protect the rights,
                safety, and security of CrewRules™, our users, or the public.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">6. Retention</h2>
              <p>
                We retain information for as long as necessary to provide the Platform, fulfill the purposes described in
                this Statement, comply with legal and accounting requirements, and resolve disputes. Retention periods may
                depend on your organization&rsquo;s settings, subscription status, and applicable law.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">7. Security</h2>
              <p>
                We implement reasonable administrative, technical, and organizational measures designed to protect
                information against unauthorized access, loss, or alteration. No method of transmission or storage is
                completely secure; operators remain responsible for their own backup and recordkeeping practices for
                critical operational data.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">8. Your Choices and Rights</h2>
              <p>
                Depending on your location, you may have rights to access, correct, delete, or restrict processing of
                certain personal information, or to object to or port data. To exercise applicable rights, contact us
                through the official contact options on the CrewRules™ website. We may verify requests as permitted by
                law.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">9. Children</h2>
              <p>
                CrewRules™ is not directed at children under 16. We do not knowingly collect personal information from
                children. If you believe we have collected such information, please contact us so we can delete it.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">10. International Transfers</h2>
              <p>
                If you access our services from outside the United States, your information may be processed in the
                United States or other countries where we or our providers operate. We take steps designed to ensure
                appropriate safeguards where required.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">11. Changes to This Statement</h2>
              <p>
                We may update this Statement from time to time. We will post the revised version with an updated
                &ldquo;Last updated&rdquo; date. Continued use of the Platform after changes become effective
                constitutes acceptance of the revised Statement where permitted by law.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#17324d] md:text-xl">12. Contact</h2>
              <p>
                For privacy-related questions or requests, contact CrewRules™ through the official contact options
                provided on the CrewRules™ website.
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
