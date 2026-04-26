"use client";

import Link from "next/link";
import { useState, useEffect, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signOut } from "@/app/frontier/pilots/portal/actions";
import { SignOutButton } from "@/components/sign-out-button";

const REMEMBERED_EMAIL_KEY = "crewrules-login-email";

const GATE_ERROR_MESSAGES: Record<string, string> = {
  not_signed_in: "Your session expired. Please sign in again.",
  company_email_required: "Use an authorized work email for your organization or the address you were invited with.",
  profile_missing: "Your account exists but your CrewRules™ profile is missing. Contact an admin.",
  profile_missing_contact_admin: "Your account exists but your CrewRules™ profile is missing. Contact an admin.",
  tenant_mismatch: "This account is not authorized for this organization.",
  portal_mismatch: "This account is not authorized for this portal.",
  role_not_allowed: "Your role does not allow access. Contact an admin.",
  account_disabled: "Your account has been disabled. Contact an admin.",
};

export type SharedLoginFormProps = {
  /** Omitted when the card already has a header (e.g. cr135 in-card wordmark). */
  title?: ReactNode;
  subtitle: string;
  /** Outer wrapper, e.g. `min-h-screen bg-slate-950 text-white` or cream + dark text */
  backgroundClass: string;
  /**
   * Primary action styling: `emerald` = CrewRules™ green (default /auth);
   * `amber` = Part 135 gradient (cr135).
   */
  accentColor: "emerald" | "amber";
  /** After gate sign-out, return here (e.g. `/auth/login` or `/cr135/login`) */
  afterSignOutHref: string;
  /** Optional top bar: e.g. cr135 “Overview” + “CrewRules™ home” */
  headerLinks?: { label: string; href: string }[];
  /** Optional left block in top bar (e.g. CrewRules™ 135 + tagline) */
  headerBrand?: ReactNode;
  headerSubline?: string;
  /** Optional CTA under subtitle (Request access, Get a demo, etc.) */
  secondaryCta?: ReactNode;
  /** Links and actions under the form (help, back to home, etc.) */
  footerContent?: ReactNode;
  /** Small print under the form */
  disclaimer: ReactNode;
  /**
   * Optional in-card top strip (e.g. logo on dark `bg-slate-950` to match the page header).
   * When set with `accentColor="amber"`, the main card body is padded in a child region below.
   */
  cardHeader?: ReactNode;
};

export function SharedLoginForm({
  title,
  subtitle,
  backgroundClass,
  accentColor,
  afterSignOutHref,
  headerLinks,
  headerBrand,
  headerSubline,
  secondaryCta,
  footerContent,
  disclaimer,
  cardHeader,
}: SharedLoginFormProps) {
  const searchParams = useSearchParams();
  const redirectError = searchParams?.get("error");
  const gateMessage = redirectError ? GATE_ERROR_MESSAGES[redirectError] : null;

  const [isPending, setIsPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const isAmber = accentColor === "amber";
  const isDarkShell = !isAmber; // auth uses full dark; cr135 content card is light but outer is cream

  useEffect(() => {
    try {
      const stored = localStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (stored && typeof stored === "string") setEmail(stored.trim());
    } catch {
      /* ignore */
    }
  }, []);

  const formErrorMessage =
    submitError ??
    (redirectError === "invalid_link"
      ? "Reset link is invalid or expired. Please request a new one."
      : !gateMessage && redirectError
        ? redirectError
        : null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setIsPending(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    let navigatedAfterSuccess = false;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: formData,
      });
      let data: { ok?: boolean; error?: string; redirect?: string } = {};
      try {
        const text = await res.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        setSubmitError("Invalid response from server. Please try again.");
        return;
      }

      if (data.ok) {
        try {
          const emailToStore = (formData.get("email") as string)?.trim();
          if (emailToStore) localStorage.setItem(REMEMBERED_EMAIL_KEY, emailToStore);
        } catch {
          /* ignore */
        }
        navigatedAfterSuccess = true;
        window.location.href = data.redirect ?? "/";
        return;
      }

      setSubmitError(data.error ?? "Login failed");
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      if (!navigatedAfterSuccess) setIsPending(false);
    }
  }

  const gateBanner = gateMessage && (
    <div
      className={
        isAmber
          ? "mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900"
          : "mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3"
      }
    >
      <p className={isAmber ? "text-sm" : "text-sm text-rose-200"}>{gateMessage}</p>
      {redirectError !== "not_signed_in" && (
        <SignOutButton
          signOut={signOut}
          afterSignOutHref={afterSignOutHref}
          buttonClassName={
            isAmber
              ? "shrink-0 rounded-lg border border-rose-300/80 bg-rose-100/80 px-3 py-2 text-sm text-rose-900 hover:bg-rose-200/80"
              : "shrink-0 rounded-lg border border-rose-400/50 bg-rose-900/50 px-3 py-2 text-sm text-rose-100 hover:bg-rose-900/70"
          }
        >
          Sign out
        </SignOutButton>
      )}
    </div>
  );

  const buttonClass =
    accentColor === "amber"
      ? "inline-flex w-full items-center justify-center gap-2 rounded-sm bg-gradient-to-b from-amber-300 to-amber-500 px-4 py-3.5 text-sm font-bold uppercase tracking-wide text-slate-950 shadow-lg shadow-amber-900/20 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-80"
      : "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#75C043] px-4 py-3 font-semibold text-slate-950 transition hover:opacity-95 disabled:cursor-wait disabled:opacity-70";

  const inputClass = isAmber
    ? "w-full rounded-sm border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-inner outline-none placeholder:text-slate-400 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
    : "w-full rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-emerald-400/40";

  const passwordInputClass = `${inputClass} pr-12`;

  const passwordToggleClass = isAmber
    ? "absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:opacity-40"
    : "absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 disabled:opacity-40";

  const labelClass = isAmber ? "text-sm font-medium text-slate-800" : "text-sm text-slate-200";
  const rememberClass = isAmber
    ? "rounded border-slate-300 text-amber-600 focus:ring-amber-500/40 disabled:opacity-50"
    : "rounded border-slate-500 bg-slate-800 text-[#75C043] focus:ring-[#75C043]/50 disabled:opacity-50";
  const rememberTextClass = isAmber ? "text-sm text-slate-600" : "text-sm text-slate-300";
  const errorText = isAmber ? "text-sm text-red-600" : "text-sm text-red-400";

  const hasCardHeader = isAmber && cardHeader;

  const cardClass = isAmber
    ? hasCardHeader
      ? "rounded-2xl border border-slate-200/80 bg-white text-slate-900 shadow-lg shadow-slate-900/5 overflow-hidden"
      : "rounded-2xl border border-slate-200/80 bg-white p-6 text-slate-900 shadow-lg shadow-slate-900/5 sm:p-8"
    : "rounded-3xl border border-white/5 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-8 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.03)] shadow-lg shadow-black/30 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400/20 hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)]";

  const cardBodyPadding = hasCardHeader ? "p-6 sm:p-8" : "";

  const formTitleClass = isAmber
    ? "text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
    : "text-3xl font-bold tracking-tight";
  const subtitleClass = isAmber ? "mt-2 text-slate-600" : "mt-3 text-slate-300";
  const subtitleClassNoTitle = isAmber ? "text-slate-600" : "text-slate-300";
  const showFormTitle =
    title != null && (typeof title !== "string" || title.trim() !== "");

  const showHeader = headerBrand != null && headerLinks && headerLinks.length > 0;

  const cardBody = (
    <>
      {showFormTitle ? <h1 className={formTitleClass}>{title}</h1> : null}
      <p className={showFormTitle ? subtitleClass : subtitleClassNoTitle}>{subtitle}</p>
      {secondaryCta ? <div className={isAmber ? "mt-5" : "mt-6"}>{secondaryCta}</div> : null}
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className={labelClass}>Email</label>
            <input
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={isPending}
              className={`${inputClass} mt-2`}
            />
          </div>
          <div>
            <label className={labelClass}>Password</label>
            <div className="relative mt-2">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                disabled={isPending}
                autoComplete="current-password"
                className={passwordInputClass}
              />
              <button
                type="button"
                disabled={isPending}
                onClick={() => setShowPassword((v) => !v)}
                className={passwordToggleClass}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
              </button>
            </div>
          </div>
          <label
            className={`mt-3 flex items-center gap-2 ${isPending ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
          >
            <input
              type="checkbox"
              name="remember"
              disabled={isPending}
              className={rememberClass}
            />
            <span className={rememberTextClass}>{isAmber ? "Remember me" : "Remember Me"}</span>
          </label>
          {formErrorMessage && <p className={errorText}>{formErrorMessage}</p>}
          <div className={isAmber ? "pt-1" : "mt-3"}>
            <button type="submit" disabled={isPending} className={buttonClass}>
              {isPending ? (
                <>
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                  <span>Signing in…</span>
                </>
              ) : isAmber ? (
                "Sign in"
              ) : (
                "Sign In"
              )}
            </button>
          </div>
          {footerContent}
        </form>
        <div className={isAmber ? "mt-6" : "mt-6 text-xs leading-relaxed text-slate-500"}>
          {disclaimer}
        </div>
    </>
  );

  const inner = (
    <>
      {gateBanner}
      <div className={cardClass}>
        {hasCardHeader ? (
          <>
            <div className="border-b border-slate-200/80 bg-slate-950 px-5 py-4 sm:px-8 sm:py-5">
              {cardHeader}
            </div>
            <div className={cardBodyPadding}>{cardBody}</div>
          </>
        ) : (
          cardBody
        )}
      </div>
    </>
  );

  if (isDarkShell) {
    return (
      <main className={backgroundClass}>
        <div className="mx-auto max-w-lg px-6 py-16">{inner}</div>
      </main>
    );
  }

  // Light / cr135: header + main
  return (
    <div className={backgroundClass}>
      {showHeader ? (
        <header className="border-b border-slate-200/80 bg-slate-950 text-white">
          <div className="mx-auto flex max-w-6xl min-w-0 items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0 shrink leading-tight">
              {headerBrand}
              {headerSubline ? (
                <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/75">
                  {headerSubline}
                </span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2 text-sm font-semibold sm:gap-4">
              {headerLinks!.map((item) => (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  className="text-white/90 transition hover:text-amber-300"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </header>
      ) : null}
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 sm:py-14">{inner}</div>
    </div>
  );
}
