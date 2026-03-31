"use client";

import Image from "next/image";
import { intervalToDuration, parseISO } from "date-fns";
import { AirlineLogo } from "@/components/airline-logo";
import { formatUsPhoneStored } from "@/lib/format-us-phone";
import { getProfilePositionLabel } from "@/lib/profile-position-label";
import type { Profile } from "@/lib/profile";
import { getTenantAirlineDisplayName, TENANT_CARRIER } from "@/lib/tenant-config";

function tenurePartsSinceHire(dateOfHire: string | null | undefined): {
  years: number;
  months: number;
} | null {
  const t = dateOfHire?.trim().slice(0, 10);
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  try {
    const hire = parseISO(`${t}T12:00:00.000Z`);
    const now = new Date();
    if (Number.isNaN(hire.getTime()) || hire > now) return null;
    const d = intervalToDuration({ start: hire, end: now });
    return {
      years: d.years ?? 0,
      months: d.months ?? 0,
    };
  } catch {
    return null;
  }
}

function formatTenureWithAirline(
  parts: { years: number; months: number },
  airlineDisplayName: string
): string {
  const { years: y, months: m } = parts;
  const chunks: string[] = [];
  if (y > 0) chunks.push(`${y} ${y === 1 ? "year" : "years"}`);
  if (m > 0) chunks.push(`${m} ${m === 1 ? "month" : "months"}`);
  if (chunks.length === 0) {
    return `Less than 1 month with ${airlineDisplayName}`;
  }
  return `${chunks.join(", ")} with ${airlineDisplayName}`;
}

function previewDisplayName(profile: Profile): string {
  const pref = profile.preferred_name?.trim();
  if (pref) {
    if (/^my\s*mentor$/i.test(pref)) {
      return profile.full_name?.trim() || pref;
    }
    return pref;
  }
  return profile.full_name?.trim() ?? "";
}

function previewPhoneForMentee(profile: Profile): string | null {
  const m = formatUsPhoneStored(profile.mentor_phone);
  if (m) return m;
  return formatUsPhoneStored(profile.phone);
}

function previewMentorContactEmail(profile: Profile): string | null {
  const e = profile.mentor_contact_email?.trim();
  return e || null;
}

type Props = {
  profile: Profile;
  /** `settings`: Community hub chrome. `portal-mentee`: inner business card only (mentoring page). */
  variant?: "settings" | "portal-mentee";
};

/**
 * Read-only mentor identity + contact (same rules as Settings → Community preview).
 */
export function SharedMentoringCardPreview({ profile, variant = "settings" }: Props) {
  const name = previewDisplayName(profile);
  const positionLabel = getProfilePositionLabel(profile.position);
  const crewBase = profile.base_airport?.trim() ?? "";
  const airlineName = getTenantAirlineDisplayName(profile.tenant);
  const tenantKey = profile.tenant?.trim().toLowerCase() ?? "";
  const tenantCarrier = TENANT_CARRIER[tenantKey] ?? "";

  const tenure = tenurePartsSinceHire(profile.date_of_hire);
  const tenureLine = tenure ? formatTenureWithAirline(tenure, airlineName) : null;
  const homeAirport = profile.home_airport?.trim() ?? "";

  const phone = previewPhoneForMentee(profile);
  const email = previewMentorContactEmail(profile);

  const hasPrivateContact = phone != null || email != null;
  const isPortalMentee = variant === "portal-mentee";

  const inner = (
    <div className={`flex justify-center sm:justify-start ${isPortalMentee ? "w-full" : "mt-5"}`}>
      <article
          className={[
            "w-full max-w-[17.5rem] overflow-hidden rounded-2xl border border-slate-200/90",
            "bg-gradient-to-b from-white via-white to-slate-50/90",
            "shadow-[0_14px_40px_-10px_rgba(15,23,42,0.22)]",
            "dark:border-white/[0.12] dark:from-slate-900 dark:via-slate-900/98 dark:to-slate-950",
            "dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.75)]",
          ].join(" ")}
          aria-label="Mentoring card preview"
        >
          <div
            className="h-1.5 w-full bg-gradient-to-r from-[#75C043] via-[#6bad3d] to-emerald-700/90"
            aria-hidden
          />

          <div className="space-y-3.5 px-4 pb-5 pt-4 sm:px-5 sm:pb-6 sm:pt-5">
            {name || positionLabel ? (
              <header className="flex items-stretch gap-2.5 border-b border-slate-200/80 pb-3.5 dark:border-white/10">
                {tenantKey === "frontier" ? (
                  <div
                    className="relative mt-0.5 h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-[0.2rem] dark:border-white/10 dark:bg-white/5 dark:shadow-[0_0_25px_rgba(117,192,67,0.15)]"
                    aria-hidden
                  >
                    <Image
                      src="/icons/f9-icon.png"
                      alt=""
                      width={28}
                      height={28}
                      className="rounded-lg object-contain"
                    />
                  </div>
                ) : tenantCarrier ? (
                  <div className="mt-0.5 shrink-0" aria-hidden>
                    <AirlineLogo carrier={tenantCarrier} size={36} />
                  </div>
                ) : null}

                <div
                  className="w-0.5 shrink-0 self-stretch rounded-full bg-[#75C043]/70 dark:bg-[#75C043]/55"
                  aria-hidden
                />

                <div className="min-w-0 flex-1 space-y-1">
                  {positionLabel ? (
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      {positionLabel}
                    </p>
                  ) : null}
                  {name ? (
                    <p className="text-[1.125rem] font-semibold leading-snug tracking-tight text-slate-900 dark:text-white [overflow-wrap:anywhere]">
                      {name}
                    </p>
                  ) : null}
                </div>
              </header>
            ) : null}

            <div className="space-y-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {crewBase ? (
                <p>
                  <span className="font-semibold text-slate-500 dark:text-slate-500">Crew Base: </span>
                  <span className="text-slate-800 dark:text-slate-200">{crewBase}</span>
                </p>
              ) : null}

              {tenureLine ? <p className="text-balance [overflow-wrap:anywhere]">{tenureLine}</p> : null}

              {homeAirport ? (
                <p>
                  <span className="font-semibold text-slate-500 dark:text-slate-500">Home Airport: </span>
                  <span className="text-slate-800 dark:text-slate-200">{homeAirport}</span>
                </p>
              ) : null}
            </div>

            {hasPrivateContact ? (
              <div className="border-t border-slate-200/90 pt-3.5 dark:border-white/10">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                  Private contact
                </p>
                <dl className="mt-2.5 space-y-2.5 text-xs">
                  {phone ? (
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-slate-500 dark:text-slate-500">Phone</dt>
                      <dd className="font-medium text-slate-900 dark:text-slate-100">{phone}</dd>
                    </div>
                  ) : null}
                  {email ? (
                    <div className="flex flex-col gap-0.5">
                      <dt className="text-slate-500 dark:text-slate-500">Email</dt>
                      <dd className="break-all font-medium leading-snug text-slate-900 dark:text-slate-100">
                        {email}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ) : null}
          </div>
      </article>
    </div>
  );

  if (isPortalMentee) {
    return inner;
  }

  return (
    <section
      className="mt-6 rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 sm:p-5 sm:mt-8 dark:border-white/10 dark:bg-white/[0.04]"
      aria-labelledby="shared-mentoring-card-preview-heading"
    >
      <div className="border-b border-slate-200/80 pb-3 dark:border-white/10">
        <h3
          id="shared-mentoring-card-preview-heading"
          className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white"
        >
          Shared Mentoring Card Preview
        </h3>
      </div>
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        This is the information your mentee can see inside CrewRules.
      </p>
      {inner}
    </section>
  );
}
