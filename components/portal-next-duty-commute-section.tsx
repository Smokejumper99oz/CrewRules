"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { ProBadge } from "@/components/pro-badge";
import { CommuteAssistProContent } from "@/components/commute-assist-pro-content";
import type { Profile } from "@/lib/profile";
import { isEligibleForProTrialStartCta } from "@/lib/profile-helpers";
import type { ScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";
import { getPlanBadgeLabel, getPlanBadgeVariant } from "@/lib/profile-badge";

type Props = {
  event: { start_time: string; end_time?: string; report_time?: string | null; route?: string | null };
  label?: "on_duty" | "later_today" | "next_duty" | "post_duty_release";
  profile: Profile | null;
  displaySettings: ScheduleDisplaySettings;
  tenant: string;
  portal: string;
  proActive: boolean;
  displayDateStr?: string | null;
  isInPairing?: boolean;
  commuteAssistDirection?: "to_home" | "to_base";
  commuteAssistReserveEarlyReleaseWindow?: boolean;
  commuteAssistSuppressFlightSearch?: boolean;
  dutyStartAirportOverride?: string | null;
  dutyEndAirportOverride?: string | null;
  reportTimeOverride?: string | null;
  dutyStartTime?: string | null;
  shortTurnAtBase?: { nextReportIso: string; nextReportDisplay: string; hoursUntilNextReport: number };
};

export function PortalNextDutyCommuteSection({
  event,
  label,
  profile,
  displaySettings,
  tenant,
  portal,
  proActive,
  displayDateStr,
  isInPairing,
  commuteAssistDirection,
  commuteAssistReserveEarlyReleaseWindow,
  commuteAssistSuppressFlightSearch,
  dutyStartAirportOverride,
  dutyEndAirportOverride,
  reportTimeOverride,
  dutyStartTime,
  shortTurnAtBase,
}: Props) {
  const daysUntilDuty =
    dutyStartTime
      ? Math.floor((new Date(dutyStartTime).getTime() - Date.now()) / 86400000)
      : null;

  const daysSinceDutyStart =
    dutyStartTime
      ? Math.floor((Date.now() - new Date(dutyStartTime).getTime()) / 86400000)
      : null;

  const shouldAutoShow =
    (daysUntilDuty !== null && daysUntilDuty <= 1 && daysUntilDuty >= -1) ||
    label === "post_duty_release";

  const [showFlights, setShowFlights] = useState(shouldAutoShow);
  const handleShowFlights = () => setShowFlights(true);
  const handleHideFlights = () => setShowFlights(false);

  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/5 dark:bg-slate-950/30">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 pt-1 dark:border-white/10">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-200">
            Crew<span className="text-[#75C043]">Rules</span><span className="align-super text-[10px]">™</span> Commute{" "}
            <span className="text-[#75C043]">Assist</span>
            <span className="align-super text-[10px]">™</span>
          </h3>
          {proActive && !showFlights && (
            <button
              type="button"
              onClick={handleShowFlights}
              className="ml-2 inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
            >
              <Eye className="h-4 w-4" />
              Show Flights
            </button>
          )}
          {showFlights && proActive && (
            <button
              type="button"
              onClick={handleHideFlights}
              className="ml-2 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-500 dark:hover:bg-slate-700/70"
            >
              <EyeOff className="h-4 w-4" />
              Hide Flights
            </button>
          )}
        </div>
        <ProBadge label={getPlanBadgeLabel(profile)} variant={getPlanBadgeVariant(profile)} size="sm" />
      </div>
      {proActive && !showFlights && (
        <p className="mt-2 mb-3 text-xs text-slate-500 dark:text-slate-400">
          Flights will appear automatically within 24 hours of your trip start or end. Click "Show Flights" above to view options now.
        </p>
      )}
      {!proActive ? (
        <div className="mt-3 space-y-2">
          <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Commute <span className="text-[#75C043]">Assist</span>
            <span className="align-super text-[10px]">™</span>
            {"\u00A0"}·{"\u00A0"}PRO
          </span>
          <p className="text-xs text-slate-600 dark:text-slate-500">
            {isEligibleForProTrialStartCta(profile)
              ? "Start a 14-day free trial to unlock this feature. No credit card required."
              : "Subscribe to CrewRules™ Pro to unlock Commute Assist."}
          </p>
          <Link
            href={`/${tenant}/${portal}/portal/settings/subscription`}
            className="inline-block text-sm font-medium text-[#75C043] hover:underline"
          >
            {isEligibleForProTrialStartCta(profile) ? "Start free trial →" : "Subscribe now →"}
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-3">
          {showFlights && (
          <>
            <CommuteAssistProContent
            event={event}
            label={label ?? undefined}
            profile={profile!}
            displaySettings={displaySettings}
            tenant={tenant}
            portal={portal}
            displayDateStr={displayDateStr}
            isInPairing={isInPairing}
            commuteAssistDirection={commuteAssistDirection}
            commuteAssistReserveEarlyReleaseWindow={commuteAssistReserveEarlyReleaseWindow}
            commuteAssistSuppressFlightSearch={commuteAssistSuppressFlightSearch}
            dutyStartAirportOverride={dutyStartAirportOverride}
            dutyEndAirportOverride={dutyEndAirportOverride}
            reportTimeOverride={reportTimeOverride}
            shortTurnAtBase={shortTurnAtBase}
          />
          </>
          )}
          </div>
        </>
      )}
    </div>
  );
}
