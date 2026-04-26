import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { SharedLoginForm } from "@/components/auth/shared-login-form";

const contactUrl = "https://www.crewrules.com/contact";

export const metadata: Metadata = {
  title: "Sign in | CrewRules™ 135",
  description: "Sign in to your CrewRules™ 135 flight operations account.",
};

const cr135SecondaryCta = (
  <a
    href={contactUrl}
    className="block w-full rounded-sm border border-amber-400/60 bg-amber-50 px-4 py-2.5 text-center text-sm font-semibold text-amber-900 transition hover:border-amber-500 hover:bg-amber-100/80"
  >
    New Operator? Get a Demo
  </a>
);

const cr135Footer = (
  <div className="mt-4 space-y-1.5 text-center text-sm">
    <p>
      <a
        href={contactUrl}
        className="text-amber-800 underline decoration-amber-300/60 hover:text-amber-950"
      >
        Account or Sign-In Help
      </a>
    </p>
    <p>
      <Link href="/cr135" className="text-slate-500 transition hover:text-slate-800">
        ← Back to CrewRules™ 135/91 OPS
      </Link>
    </p>
  </div>
);

const cr135Disclaimer = (
  <p className="text-xs leading-relaxed text-slate-500">
    CrewRules™ is an independent software platform and is not affiliated with any single operator. Always
    consult official sources for authoritative guidance.
  </p>
);

/** In-card top strip: larger Crew + Rules™ wordmark, “ - Login”, subline. */
const cr135CardHeader = (
  <div className="w-full text-left">
    <p className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
      <span className="text-white">Crew</span>
      <span className="text-amber-300">Rules</span>
      <span className="align-super text-[0.48em] font-bold text-amber-300">™</span>
      <span className="ml-1.5 font-extrabold text-white/90 sm:ml-2.5"> - Login</span>
    </p>
    <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 sm:mt-2.5 sm:text-[11px]">
      Flight OPS Simplified
    </p>
  </div>
);

export default function Cr135LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f6f1e8] text-slate-900">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-500" />
        </div>
      }
    >
      <SharedLoginForm
        backgroundClass="min-h-screen bg-[#f6f1e8] text-slate-900"
        accentColor="amber"
        afterSignOutHref="/cr135/login"
        subtitle="Secure access to your Part 135 / 91 OPS Account on CrewRules™."
        cardHeader={cr135CardHeader}
        secondaryCta={cr135SecondaryCta}
        footerContent={cr135Footer}
        disclaimer={cr135Disclaimer}
      />
    </Suspense>
  );
}
