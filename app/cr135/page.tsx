import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "CrewRules 135 | Flight Ops. Simplified.",
  description:
    "The all-in-one flight operations platform for Part 135, Part 91, and corporate flight departments.",
  openGraph: {
    title: "CrewRules 135 | Flight Ops. Simplified.",
    description:
      "The all-in-one flight operations platform for Part 135, Part 91, and corporate flight departments.",
    url: "https://www.crewrules.com/cr135",
    siteName: "CrewRules",
    type: "website",
    images: [
      {
        url: "/images/cr135-og.png",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CrewRules 135 | Flight Ops. Simplified.",
    description:
      "The all-in-one flight operations platform for Part 135, Part 91, and corporate flight departments.",
    images: ["/images/cr135-og.png"],
  },
};

const crewrulesContactUrl = "https://www.crewrules.com/contact";

const navLinks: { label: string; href: string }[] = [
  { label: "Solutions", href: "#solutions" },
  { label: "Contact", href: crewrulesContactUrl },
];

const featureStripLinkClass =
  "font-semibold text-white underline decoration-white/40 underline-offset-2 transition hover:text-amber-300 hover:decoration-amber-300/60";

const featureStrip: { title: string; icon: string; description: ReactNode }[] = [
  {
    title: "Trip Management",
    description: (
      <>
        All your flights in one place.
        <br />
        No spreadsheets. No WhatsApp. No guesswork.
      </>
    ),
    icon: "calendar",
  },
  {
    title: "Pilot Acknowledgment",
    description: (
      <>
        Know your crew is ready.
        <br />
        No missed messages. No uncertainty.
      </>
    ),
    icon: "check",
  },
  {
    title: "Weather & Briefings",
    description: (
      <>
        Essential info at a glance.
        <br />
        Powered by real-world aviation tools like{" "}
        <a
          href="https://www.planewx.ai/?ref=46AC7263"
          target="_blank"
          rel="noopener noreferrer"
          className={featureStripLinkClass}
        >
          PlaneWX
        </a>{" "}
        and{" "}
        <a
          href="https://www.hotcalc.com/"
          target="_blank"
          rel="noopener noreferrer"
          className={featureStripLinkClass}
        >
          HOTcalc
        </a>
        .
      </>
    ),
    icon: "weather",
  },
];

const featureCards: { title: string; description: ReactNode }[] = [
  {
    title: "Crew Notifications & Acknowledgment",
    description: (
      <>
        Instant alerts and pilot confirmations.
        <br />
        From notification to acknowledgment—fully tracked.
      </>
    ),
  },
  {
    title: "Document Hub & Training Records",
    description: (
      <>
        SOPs, manuals, and qualifications in one place.
        <br />
        Track everything. Stay audit-ready.
        <br />
        Snap, upload, and store records on the go.
      </>
    ),
  },
];

function FeatureIcon({ type }: { type: string }) {
  if (type === "check") {
    return (
      <div className="relative h-14 w-14">
        <Image
          src="/icons/135tickicon.png"
          alt=""
          fill
          sizes="56px"
          className="object-contain"
        />
      </div>
    );
  }

  if (type === "weather") {
    return (
      <div className="relative h-14 w-16">
        <Image
          src="/icons/135weathericon.png"
          alt=""
          fill
          sizes="64px"
          className="object-contain"
        />
      </div>
    );
  }

  return (
    <div className="relative h-14 w-16">
      <Image
        src="/icons/135tripicon.png"
        alt=""
        fill
        sizes="64px"
        className="object-contain"
      />
    </div>
  );
}

export default function Cr135LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f6f1e8] text-slate-900">
      <section
        className="relative isolate min-h-[min(100svh,520px)] overflow-hidden bg-slate-950 text-white sm:min-h-[520px] md:min-h-[570px] xl:min-h-[620px]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(10, 20, 40, 0.85) 0%, rgba(10, 20, 40, 0.6) 40%, rgba(10, 20, 40, 0.2) 70%, rgba(10, 20, 40, 0.0) 100%), url('/images/jet-hero.jpg')",
          backgroundPosition: "center 58%",
          backgroundSize: "cover",
        }}
      >

        <header className="border-b border-white/20 bg-slate-950/25 backdrop-blur-[2px]">
          <div className="mx-auto flex max-w-6xl min-w-0 items-center gap-3 cr-px-safe py-3 sm:gap-6">
            <Link href="/" className="min-w-0 shrink leading-tight text-white">
              <span className="block truncate text-xl font-extrabold tracking-tight sm:text-2xl md:text-3xl">
                Crew<span className="text-amber-300">Rules</span>
                <span className="align-super text-xs text-white">™</span>
              </span>
              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/75 sm:text-[11px] sm:tracking-[0.22em]">
                Flight OPS Simplified
              </span>
            </Link>

            <div className="flex min-w-0 flex-1 items-center justify-end gap-4 sm:gap-5 md:gap-6">
              <nav className="hidden min-w-0 items-center gap-4 text-sm font-semibold text-white/90 md:flex md:gap-5 lg:gap-6">
                {navLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="shrink-0 transition hover:text-amber-300"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <Link
                href="/cr135/login"
                className="shrink-0 rounded-sm bg-gradient-to-b from-amber-300 to-amber-500 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-950 shadow-lg shadow-black/30 transition hover:brightness-110 sm:px-6 sm:py-3 sm:text-xs md:px-7"
              >
                Login
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl cr-px-safe pb-24 pt-16 sm:pb-32 sm:pt-24 lg:pb-40">
          <div className="max-w-2xl min-w-0">
            <h1 className="text-[1.65rem] font-extrabold leading-[1.15] tracking-tight text-white drop-shadow sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl">
              Streamline Your Flight
              <span className="block text-amber-300">Operations.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/90 sm:mt-6 md:text-lg">
              The All-in-One Platform for Part 135, Part 91, and Corporate Operators.
            </p>
            <div className="mt-7 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap">
              <Link
                href={crewrulesContactUrl}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-gradient-to-b from-amber-300 to-amber-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-black/25 transition hover:brightness-110 sm:w-auto sm:min-w-36"
              >
                Get a Demo
              </Link>
              <Link
                href="#features"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-sm bg-[#102c49] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-black/25 transition hover:bg-[#163a5e] sm:w-auto sm:min-w-36"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="scroll-mt-6 bg-[#102b46] text-white shadow-[0_-10px_40px_rgba(15,23,42,0.25)]"
      >
        <div className="mx-auto grid max-w-6xl gap-0 cr-px-safe py-6 md:grid-cols-3 md:py-7">
          {featureStrip.map((feature, index) => (
            <div
              key={feature.title}
              className={`flex min-w-0 items-start gap-4 px-4 py-5 sm:items-center sm:gap-5 ${
                index > 0 ? "border-t border-white/15 md:border-t-0 md:border-l md:border-white/20" : ""
              }`}
            >
              <div className="shrink-0">
                <FeatureIcon type={feature.icon} />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold">{feature.title}</h2>
                <p className="mt-1 break-words text-sm text-white/75">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="solutions" className="scroll-mt-6 bg-[#f8f2ea] py-10 sm:py-14 md:py-20">
        <div className="mx-auto max-w-6xl min-w-0 cr-px-safe">
          <div className="grid gap-8 sm:gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div>
              <h2 className="font-serif text-3xl font-bold text-[#17324d] md:text-4xl">
                Simplify Your Operations.
              </h2>
              <div
                aria-hidden
                className="mx-auto my-4 h-0.5 w-full max-w-[320px] bg-[linear-gradient(to_right,transparent,rgba(23,50,77,0.7),transparent)]"
              />
              <p className="text-base leading-7 text-slate-700">
                Centralize your trips, documents, training records, acknowledgments, and crew communications in one
                polished operations hub.
              </p>

              <div className="mt-6 overflow-hidden rounded-sm border border-slate-200 bg-white shadow-xl shadow-slate-900/10 sm:mt-8">
                <div className="relative h-[12.96rem] sm:h-[14.4rem] md:h-[16.2rem]">
                  <Image
                    src="/hero/135inflightairplane.png"
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 520px, (min-width: 640px) 90vw, 100vw"
                    className="scale-110 object-cover object-[58%_50%] saturate-110 sm:object-[62%_50%]"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to right, rgba(10,20,40,0.85) 0%, rgba(10,20,40,0.65) 40%, rgba(10,20,40,0.2) 70%, rgba(10,20,40,0.0) 100%)",
                    }}
                  />
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-24 bg-[linear-gradient(to_bottom,rgba(15,35,60,0.92)_0%,rgba(15,35,60,0.55)_50%,rgba(15,35,60,0)_100%)] sm:h-32" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_42%,rgba(255,184,84,0.26),rgba(255,184,84,0.08)_28%,transparent_58%)]" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-16 bg-[linear-gradient(to_right,rgba(10,22,38,0.5)_0%,rgba(10,22,38,0.3)_35%,rgba(10,22,38,0.1)_60%,rgba(10,22,38,0)_100%)] sm:h-20 md:h-24" />
                  <div className="absolute -bottom-8 left-3 top-4 z-10 w-[9.5rem] sm:-bottom-10 sm:left-7 sm:top-5 sm:w-44">
                    <Image
                      src="/icons/135iphoneicon.png"
                      alt="CrewRules trip briefing mobile preview"
                      fill
                      sizes="(max-width: 639px) 152px, 185px"
                      className="object-contain object-bottom"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="min-w-0 rounded-sm border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/10 sm:p-5">
              <div className="rounded-t-sm bg-gradient-to-r from-[#102b46] to-[#173c5f] px-4 py-4 text-white sm:px-5 sm:py-5">
                <div className="min-w-0">
                  <h3 className="text-2xl font-extrabold tracking-tight sm:text-3xl">TPA to SJU</h3>
                  <p className="mt-2 text-sm text-white/75">April 25 - 27</p>
                </div>
              </div>

              <div className="space-y-5 p-4 text-sm text-slate-700 sm:p-5">
                <div className="grid gap-3 border-b border-slate-200 pb-5 sm:grid-cols-2">
                  <p>
                    <span className="font-bold text-slate-950">Aircraft:</span> N92CR
                  </p>
                  <p>
                    <span className="font-bold text-slate-950">Crew:</span> Capt. John Doe
                  </p>
                  <p>
                    <span className="font-bold text-slate-950">FO:</span> Mike Smith
                  </p>
                  <p>
                    <span className="font-bold text-slate-950">Status:</span> Ready
                  </p>
                </div>

                <div className="flex gap-5">
                  <FeatureIcon type="weather" />
                  <div className="flex-1">
                    <h4 className="font-bold text-[#17324d]">Weather</h4>
                    <div className="mt-4 space-y-3">
                      <div className="h-3 w-full rounded bg-slate-200" />
                      <div className="h-3 w-10/12 rounded bg-slate-200" />
                      <div className="h-3 w-8/12 rounded bg-slate-200" />
                    </div>
                  </div>
                </div>

                <div className="rounded bg-slate-50 p-4">
                  <h4 className="font-bold text-[#17324d]">One operations hub for your crews.</h4>
                  <p className="mt-2 leading-6">
                    Trips, crew communication, documents, training records, and acknowledgments stay organized around
                    the work your crews need to complete.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 sm:gap-7 md:grid-cols-2 md:gap-6">
            {featureCards.map((card, index) => (
              <article
                key={card.title}
                className="relative min-h-0 min-w-0 overflow-hidden rounded-sm border border-slate-200 bg-white p-0 shadow-xl shadow-slate-900/10"
              >
                <Image
                  src="/images/cr135-cloud-cta.png"
                  alt=""
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover object-center opacity-75"
                />
                <div
                  className={`absolute inset-0 ${
                    index === 0
                      ? "bg-gradient-to-r from-white/95 via-white/70 to-white/10"
                      : "bg-gradient-to-r from-white/90 via-white/65 to-white/20"
                  }`}
                />
                <div className="relative z-10 flex min-w-0 flex-col text-left">
                  <div
                    className="flex flex-col gap-2 rounded-t-sm bg-[linear-gradient(to_bottom,rgba(15,35,60,0.95)_0%,rgba(15,35,60,0.85)_60%,rgba(15,35,60,0)_100%)] p-4 pb-6 text-white sm:p-6 sm:pb-8"
                  >
                    <h3 className="text-base font-extrabold leading-snug text-white drop-shadow-sm sm:text-lg md:text-xl md:whitespace-nowrap">
                      {card.title}
                    </h3>
                    <div
                      aria-hidden
                      className="h-0.5 w-full max-w-[320px] bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.65),transparent)]"
                    />
                  </div>
                  <div className="flex flex-col gap-4 px-4 pb-5 pt-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:px-6 sm:pb-6">
                    <div
                      className={
                        index === 0 ? "min-w-0 flex-1 sm:pr-1" : "min-w-0 flex-1 sm:max-w-sm sm:pr-1"
                      }
                    >
                      <p className="text-sm leading-6 text-slate-700">{card.description}</p>
                    </div>
                    {index === 0 ? (
                      <div
                        className="relative mx-auto h-20 w-36 shrink-0 sm:mx-0 sm:h-24 sm:w-44 sm:self-end md:h-28 md:w-52"
                        style={{ transform: "rotate(-3deg) scale(1.05) translateY(0.625rem)" }}
                      >
                        <Image
                          src="/icons/135ipad.png"
                          alt="Crew notifications dashboard preview"
                          fill
                          sizes="(max-width: 639px) 144px, (min-width: 768px) 220px, 185px"
                          className="object-contain object-bottom"
                        />
                      </div>
                    ) : (
                      <div className="relative mx-auto h-20 w-28 shrink-0 translate-y-1 sm:mx-0 sm:h-24 sm:w-32 sm:self-end md:h-28 md:w-36 md:translate-y-2">
                        <Image
                          src="/icons/135SOPicon.png"
                          alt="SOP Docs"
                          fill
                          sizes="(max-width: 639px) 112px, (min-width: 768px) 144px, 128px"
                          className="object-contain object-bottom drop-shadow-xl"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative isolate overflow-hidden bg-slate-950 py-12 text-center text-white sm:py-14 md:py-[4.5rem]">
        <Image
          src="/images/cr135-cloud-cta.png"
          alt=""
          fill
          sizes="100vw"
          className="absolute inset-0 -z-20 object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#102b46]/35 via-[#102b46]/45 to-slate-950/80" />
        <div className="mx-auto max-w-4xl min-w-0 cr-px-safe">
          <h2 className="font-serif text-2xl font-bold sm:text-3xl md:text-4xl">
            Ready to Elevate Your Flight Ops?
          </h2>
          <div
            aria-hidden
            className="mx-auto my-4 h-0.5 w-full max-w-[320px] bg-[linear-gradient(to_right,transparent,rgba(255,255,255,0.7),transparent)]"
          />
          <p className="mx-auto max-w-2xl px-0 text-sm text-white/85 sm:text-base">
            Schedule a Demo and see CrewRules™ in action.
          </p>
          <Link
            href={crewrulesContactUrl}
            className="mt-7 inline-flex min-h-12 w-full max-w-xs items-center justify-center rounded-sm bg-gradient-to-b from-amber-300 to-amber-500 px-8 py-4 text-sm font-bold text-slate-950 shadow-xl shadow-black/30 transition hover:brightness-110 sm:w-auto sm:min-w-44"
          >
            Get Started
          </Link>
        </div>
      </section>

      <footer className="bg-[#071b2e] text-white">
        <div className="mx-auto flex max-w-6xl min-w-0 flex-col gap-4 cr-px-safe py-6 text-xs text-white/70 sm:py-7 md:flex-row md:items-center md:justify-between md:gap-5">
          <p className="min-w-0 leading-relaxed">© 2026 CrewRules. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:gap-x-8">
            <Link
              href="/privacy"
              className="min-h-11 min-w-[44px] py-2.5 leading-snug underline-offset-4 transition hover:text-white sm:min-h-0 sm:py-0 sm:leading-normal sm:no-underline"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="min-h-11 min-w-[44px] py-2.5 leading-snug underline-offset-4 transition hover:text-white sm:min-h-0 sm:py-0 sm:leading-normal sm:no-underline"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
