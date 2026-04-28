"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  snoozeBidReminderSixHours,
  suppressBidReminderForCurrentOpening,
} from "@/app/frontier/pilots/portal/profile/actions";

const NAVBLUE_LOGO_SRC = "/brand/navblue-logo.png";

type Props = {
  openingLine: string;
  /** When set, NAVBLUE logo and name link here in a new tab (tenant-specific PBS login). */
  navbluePbsLoginHref?: string | null;
};

export function BidReminderBanner({ openingLine, navbluePbsLoginHref }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function runAction(
    fn: () => Promise<{ success: true } | { error: string }>
  ): void {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const pbsLogin = navbluePbsLoginHref?.trim() || null;

  const navblueName = pbsLogin ? (
    <a
      href={pbsLogin}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-slate-200 underline decoration-slate-500/50 underline-offset-2 transition hover:text-white hover:decoration-slate-400"
    >
      NAVBLUE
    </a>
  ) : (
    <span className="text-slate-200">NAVBLUE</span>
  );

  const logoBoxClass =
    "relative mx-auto h-[49px] w-[161px] sm:mx-0 sm:w-[179px]";
  const logoLinkFocus =
    "block shrink-0 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400";

  const logoImage = (
    <Image
      src={NAVBLUE_LOGO_SRC}
      alt="NAVBLUE"
      fill
      className="object-contain object-left sm:object-right"
      sizes="(max-width: 640px) 161px, 179px"
      priority={false}
    />
  );

  return (
    <aside
      className="rounded-2xl border border-sky-500/35 bg-gradient-to-br from-slate-900 via-slate-900/95 to-sky-950/90 px-3 py-2.5 shadow-sm ring-1 ring-sky-500/20 sm:px-3.5 sm:py-2.5"
      aria-label="PBS bid opening reminder"
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2.5">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-sky-200/90">
              PBS bid opening
            </p>
            <h2 className="mt-0.5 text-base font-semibold leading-snug text-white">
              Monthly CA and FO Bid Opens
            </h2>
            <p className="mt-0.5 text-xs leading-snug text-slate-300">
              Opens on the <span className="font-medium text-white">1st</span> of the Month at{" "}
              <span className="font-medium text-white">09:00 LDT</span> (Local Duty Time — Your Crew Base
              timezone).
              <br />
              NEXT OPEN: <span className="font-medium text-white">{openingLine}</span>.
            </p>
            <p className="mt-0.5 text-[0.6875rem] leading-snug text-slate-400">
              Bidding runs on {navblueName}. Plan your PBS session before the window closes.
            </p>
          </div>

          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-1.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => runAction(snoozeBidReminderSixHours)}
              className="w-full touch-manipulation rounded-md border border-sky-400/40 bg-sky-500/15 px-2.5 py-2 text-xs font-medium leading-none text-white transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-60 min-h-[44px] sm:min-h-0 sm:w-auto sm:py-0.5"
            >
              Remind me later
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => runAction(suppressBidReminderForCurrentOpening)}
              className="w-full touch-manipulation rounded-md border border-white/10 bg-transparent px-2.5 py-2 text-xs font-medium leading-none text-slate-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60 min-h-[44px] sm:min-h-0 sm:w-auto sm:py-0.5"
            >
              Dismiss for this month
            </button>
          </div>
          {error ? (
            <p className="text-xs leading-snug text-amber-300" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-start sm:justify-end">
          {pbsLogin ? (
            <a
              href={pbsLogin}
              target="_blank"
              rel="noopener noreferrer"
              className={`${logoBoxClass} ${logoLinkFocus}`}
              aria-label="Open NAVBLUE PBS login in a new tab"
            >
              {logoImage}
            </a>
          ) : (
            <div className={logoBoxClass}>{logoImage}</div>
          )}
        </div>
      </div>
    </aside>
  );
}
