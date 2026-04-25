import { Suspense } from "react";
import Link from "next/link";
import { SharedLoginForm } from "@/components/auth/shared-login-form";

const authSecondaryCta = (
  <Link
    href="/request-access"
    className="block w-full rounded-lg border border-[#75C043]/60 bg-[#75C043]/10 px-4 py-2 text-center text-sm font-medium text-[#75C043] transition hover:border-[#75C043] hover:bg-[#75C043]/20"
  >
    New to CrewRules? Request access
  </Link>
);

const authFooter = (
  <div className="mt-4 space-y-1.5 text-center">
    <p>
      <Link href="/request-access" className="text-sm text-slate-300 transition hover:text-slate-200">
        Join the waitlist for your airline
      </Link>
    </p>
    <p>
      <Link href="/contact" className="text-sm text-slate-500 hover:text-slate-300">
        Account or Sign-In Help
      </Link>
    </p>
    <p>
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-300">
        Back to home
      </Link>
    </p>
  </div>
);

const authDisclaimer = (
  <p className="text-xs leading-relaxed text-slate-500">
    CrewRules™ is an independent pilot/crew resource and is not affiliated with any airline, union, or
    regulator. Always consult official sources for authoritative guidance.
  </p>
);

export default function AuthLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#75C043]/40 border-t-[#75C043]" />
        </main>
      }
    >
      <SharedLoginForm
        backgroundClass="min-h-screen bg-slate-950 text-white"
        accentColor="emerald"
        afterSignOutHref="/auth/login"
        title={
          <>
            Crew<span className="text-[#75C043]">Rules</span>
            <span className="align-super text-xs text-white">™</span> Login
          </>
        }
        subtitle="Secure access to your CrewRules account"
        secondaryCta={authSecondaryCta}
        footerContent={authFooter}
        disclaimer={authDisclaimer}
      />
    </Suspense>
  );
}
