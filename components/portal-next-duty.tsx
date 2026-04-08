import Link from "next/link";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { getNextDuty, getScheduleImportStatus, getScheduleDisplaySettings, getTrainingCityForEvent } from "@/app/frontier/pilots/portal/schedule/actions";
import { getProfile, isProActive } from "@/lib/profile";
import type { ActiveTrip } from "@/lib/trips/get-active-trip";
import { formatLegLine } from "@/lib/trips/detect-trip-changes";
import type { TripChangeSummary } from "@/lib/trips/detect-trip-changes";
import { resolveLegIdentity } from "@/lib/trips/resolve-leg-identity";
import { formatDayLabel, addDay, subtractMinutesFromTime } from "@/lib/schedule-time";
import { getLegsForDate, computeLegDates, getTripDateStrings } from "@/lib/leg-dates";
import { computeDelayInfo, getDelayStatusLabel, parseIsoTs } from "@/lib/flight-delay";
import { AirlineLogo } from "@/components/airline-logo";
import { ScheduleStatusChip } from "@/components/schedule-status-chip";
import { ScheduleEventCard } from "@/components/schedule-event-card";
import { OnDutyTimer } from "@/components/on-duty-timer";
import { Far117FdpBanner } from "@/components/far-117-fdp-banner";
import { PortalNextDutyCommuteSection } from "@/components/portal-next-duty-commute-section";
import { getFar117MaxFdpMinutes } from "@/lib/far-117/fdp-max";
import {
  computeProjectedFdpElapsedMinutes,
  computeFdpRemainingMinutes,
} from "@/lib/far-117/fdp-remaining";
import { getFiledRoute } from "@/lib/weather-brief/get-filed-route";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";
import { getLaterTodayRedEyeCardInfo, getTripReportNightMeta } from "@/lib/schedule-report-night";
import { TrainingDeviationPrompt } from "@/components/training-deviation-prompt";
import { iataToCityName } from "@/lib/family-view/translate-schedule";

function fmtHM(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Compute flight duration in minutes from HH:MM times (same-day or overnight). */
function legDurationMinutes(depTime: string, arrTime: string): number {
  const parse = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return ((h ?? 0) * 60 + (m ?? 0)) % (24 * 60);
  };
  let dep = parse(depTime);
  let arr = parse(arrTime);
  if (arr < dep) arr += 24 * 60; // overnight
  return Math.max(0, arr - dep);
}

/** Prefer live duration when live delayed times are shown so duration matches displayed dep/arr. */
function computeLiveDurationMinutes(depIso?: string | null, arrIso?: string | null): number | null {
  if (!depIso?.trim() || !arrIso?.trim()) return null;
  try {
    const depMs = new Date(depIso.trim()).getTime();
    const arrMs = new Date(arrIso.trim()).getTime();
    if (Number.isNaN(depMs) || Number.isNaN(arrMs)) return null;
    return Math.max(0, Math.round((arrMs - depMs) / 60000));
  } catch {
    return null;
  }
}

/** Default carrier for tenant when API has no data (e.g. Frontier = F9). */
const TENANT_CARRIER: Record<string, string> = { frontier: "F9" };

const DUTY_LABELS: Record<string, string> = {
  on_duty: "On Duty",
  later_today: "Later today",
  next_duty: "Next Duty",
  post_duty_release: "Trip Complete",
};

/** Normalize report_time (HH:MM or HHMM) to HH:MM for FAR 117 lookup. */
function normalizeReportTimeToHHMM(rt: string | null | undefined): string | null {
  if (!rt?.trim()) return null;
  const t = rt.trim();
  if (/^\d{1,2}:\d{2}$/.test(t)) return t;
  const s = t.replace(":", "");
  if (!/^\d{3,4}$/.test(s)) return null;
  return s.length === 4 ? `${s.slice(0, 2)}:${s.slice(2)}` : `0${s.slice(0, 1)}:${s.slice(1)}`;
}

/** Build report datetime ISO from report_time + duty date in timezone. */
function buildReportTimeIso(
  reportTime: string,
  dutyDateStr: string,
  timezone: string
): string | null {
  const norm = normalizeReportTimeToHHMM(reportTime);
  if (!norm) return null;
  try {
    return fromZonedTime(`${dutyDateStr}T${norm}:00`, timezone).toISOString();
  } catch {
    return null;
  }
}

export async function PortalNextDuty({
  tenant,
  portal,
  activeTrip,
  tripChangeSummaries = [],
}: {
  tenant: string;
  portal: string;
  activeTrip?: ActiveTrip | null;
  tripChangeSummaries?: TripChangeSummary[];
}) {
  const [
    {
      event,
      label,
      hasSchedule,
      legsToShow,
      displayDateStr,
      isInPairing,
      commuteAssistDirection,
      commuteAssistReserveEarlyReleaseWindow,
      commuteAssistSuppressFlightSearch,
      shortTurnAtBase,
    },
    statusData,
    displaySettings,
    profile,
  ] = await Promise.all([
    getNextDuty(),
    getScheduleImportStatus(),
    getScheduleDisplaySettings(),
    getProfile(),
  ]);

  // Training event enrichment — fetch companion trip legs to determine training city
  const isTrainingEvent = event?.event_type === "training";
  const trainingCityIata = isTrainingEvent && event
    ? await getTrainingCityForEvent(event.title ?? null, event.start_time, event.end_time)
    : null;
  const trainingDeviationHomeCommute = isTrainingEvent
    ? (event?.training_deviation_home_commute ?? null)
    : null;
  const trainingCityDisplay = trainingCityIata ? iataToCityName(trainingCityIata) : null;
  const homeAirport = profile?.home_airport?.trim().toUpperCase() ?? null;
  const homeCity = homeAirport ? iataToCityName(homeAirport) : null;
  const scheduleHref = `/${tenant}/${portal}/portal/schedule`;
  const heading = label ? DUTY_LABELS[label] : "Next Duty";
  const isOnDuty = label === "on_duty";
  const proActive = isProActive(profile);
  const baseAirport = profile?.base_airport?.trim().toUpperCase() ?? displaySettings.baseAirport?.trim().toUpperCase() ?? "";
  const firstLegOrigin = legsToShow?.[0]?.origin?.trim().toUpperCase();
  const isOutOfBase = !!firstLegOrigin && !!baseAirport && firstLegOrigin !== baseAirport;
  const reportTimeOverride =
    isOutOfBase && legsToShow?.[0]?.depTime
      ? subtractMinutesFromTime(legsToShow[0].depTime, 45)
      : undefined;

  /** Duty-day legs for the card; omit prop on report-night day so ScheduleEventCard keeps event.legs for firstLeg in report-night block. */
  const scheduleCardTimeOpts = {
    timezone: displaySettings.baseTimezone,
    timeFormat: displaySettings.timeFormat,
    showTimezoneLabel: displaySettings.showTimezoneLabel,
    baseAirport: displaySettings.baseAirport,
  };
  const laterTodayRedEyeCard =
    label === "later_today" && event && event.event_type === "trip"
      ? getLaterTodayRedEyeCardInfo(event, scheduleCardTimeOpts)
      : null;
  const isRedEyeReport = laterTodayRedEyeCard != null;
  const redEyeReportDateLong = laterTodayRedEyeCard?.reportDateLong ?? null;
  let scheduleEventCardLegsToShow = legsToShow;
  if (label !== "post_duty_release" && event && event.event_type === "trip") {
    const reportNightMeta = getTripReportNightMeta(event, scheduleCardTimeOpts);
    const reportNightAppliesToThisCard =
      reportNightMeta.isReportNight &&
      reportNightMeta.reportLocalDate != null &&
      (displayDateStr == null || displayDateStr === reportNightMeta.reportLocalDate);
    const isTripReportNightUi =
      reportNightAppliesToThisCard &&
      reportNightMeta.firstDepartureLocalDate != null &&
      reportNightMeta.reportDisplay != null;
    if (isTripReportNightUi) {
      scheduleEventCardLegsToShow = undefined;
    }
  }

  const isCurrentTripMode = !!activeTrip;
  const matchingChangeSummary = activeTrip
    ? tripChangeSummaries.find((s) => s.pairing === activeTrip.pairing)
    : null;

  const firstLeg = (legsToShow && legsToShow.length > 0 ? legsToShow[0] : activeTrip?.todayLegs?.[0]) ?? null;
  const displayDateForResolve = (legsToShow && legsToShow.length > 0 ? displayDateStr : activeTrip?.displayDateStr) ?? formatInTimeZone(new Date(), displaySettings.baseTimezone, "yyyy-MM-dd");
  const [resolvedFirstLeg, filedResult] = await Promise.all([
    firstLeg && firstLeg.flightNumber && firstLeg.origin && firstLeg.destination && proActive && !firstLeg.deadhead
      ? resolveLegIdentity({
          flightNumber: firstLeg.flightNumber,
          origin: firstLeg.origin,
          destination: firstLeg.destination,
          depTime: firstLeg.depTime,
          date: displayDateForResolve,
        })
      : null,
    (async () => {
      if (!firstLeg?.flightNumber || !firstLeg.origin || !firstLeg.destination) return { filedResult: null, departureIso: null, arrivalIso: null };
      const depDateStr = ("departureDate" in firstLeg && firstLeg.departureDate) ? firstLeg.departureDate : displayDateForResolve;
      const depTimeRaw = (firstLeg.depTime ?? "00:00").replace(":", "").padStart(4, "0");
      const depTimeNorm = depTimeRaw.length >= 4 ? `${depTimeRaw.slice(0, 2)}:${depTimeRaw.slice(2, 4)}` : "00:00";
      const depTzLeg = getTimezoneFromAirport(firstLeg.origin);
      const arrTzLeg = getTimezoneFromAirport(firstLeg.destination);
      const depMin = parseInt(depTimeRaw.slice(0, 2) || "0", 10) * 60 + parseInt(depTimeRaw.slice(2, 4) || "0", 10);
      const arrTimeRaw = (firstLeg.arrTime ?? "00:00").replace(":", "").padStart(4, "0");
      const arrMin = parseInt(arrTimeRaw.slice(0, 2) || "0", 10) * 60 + parseInt(arrTimeRaw.slice(2, 4) || "0", 10);
      const arrDateStr = arrMin < depMin ? addDay(depDateStr) : depDateStr;
      const arrTimeNorm = arrTimeRaw.length >= 4 ? `${arrTimeRaw.slice(0, 2)}:${arrTimeRaw.slice(2, 4)}` : "00:00";
      const depUtc = fromZonedTime(`${depDateStr}T${depTimeNorm}:00`, depTzLeg);
      const arrUtc = fromZonedTime(`${arrDateStr}T${arrTimeNorm}:00`, arrTzLeg);
      const routeLookup = {
        flightNumber: firstLeg.flightNumber,
        origin: firstLeg.origin,
        destination: firstLeg.destination,
        departureIso: depUtc.toISOString(),
        tenant: profile?.tenant ?? "frontier",
        user_id: profile?.id,
      };
      const filedResult = await getFiledRoute(routeLookup);
      return { filedResult, departureIso: depUtc.toISOString(), arrivalIso: arrUtc.toISOString() };
    })(),
  ]);
  const firstLegLiveStatus = filedResult?.filedResult?.status ?? null;
  const firstLegDepIso = filedResult?.departureIso ?? null;
  const firstLegArrIso = filedResult?.arrivalIso ?? null;

  console.log("[CurrentTrip primary mode]", { currentTripMode: isCurrentTripMode, nextDutyMode: !isCurrentTripMode });
  console.log("[CurrentTrip change summary]", {
    found: !!matchingChangeSummary,
    activePairing: activeTrip?.pairing ?? null,
    availablePairings: tripChangeSummaries.map((s) => s.pairing),
  });
  console.log("[CurrentTrip visual unify]", { usingUnifiedCardStyle: isCurrentTripMode });
  console.log("[CurrentTrip flight resolve]", {
    resolved: !!resolvedFirstLeg,
    carrierCode: resolvedFirstLeg?.carrierCode ?? null,
    airlineName: resolvedFirstLeg?.airlineName ?? null,
    status: resolvedFirstLeg?.status ?? null,
  });

  const far117Result =
    hasSchedule && event && isOnDuty
      ? (() => {
          const baseTimezone = displaySettings.baseTimezone;
          const reportTimeLocal = reportTimeOverride ?? event.report_time ?? null;
          if (!reportTimeLocal) return null;
          const reportTimeNorm = normalizeReportTimeToHHMM(reportTimeLocal);
          if (!reportTimeNorm) return null;

          const tripDates = getTripDateStrings(event.start_time, event.end_time, baseTimezone);
          const legDates = computeLegDates(event.legs ?? [], tripDates, baseTimezone);
          const now = new Date();
          const nowFallback = formatInTimeZone(now, baseTimezone, "yyyy-MM-dd");

          let dutyDate: string;
          const displayedLeg = legsToShow?.[0];
          if (displayedLeg) {
            const ld = legDates.find(
              (x) => x.leg.origin === displayedLeg.origin && x.leg.destination === displayedLeg.destination
            );
            dutyDate =
              ld?.departureDate && tripDates.includes(ld.departureDate)
                ? ld.departureDate
                : displayDateStr ?? nowFallback;
          } else {
            dutyDate = displayDateStr ?? nowFallback;
          }

          const reportTimeIso = buildReportTimeIso(reportTimeLocal, dutyDate, baseTimezone);
          if (!reportTimeIso) return null;

          const legsForDutyDate = getLegsForDate(event.legs ?? [], dutyDate, tripDates, baseTimezone);

          const reportTimeMs = new Date(reportTimeIso).getTime();
          const filteredLegsForDutyDate = legsForDutyDate.filter((leg) => {
            const ld = legDates.find((x) => x.leg === leg);
            if (!ld?.departureDate) return false;
            const depRaw = (leg.depTime ?? "00:00").replace(":", "").padStart(4, "0");
            const depNorm = `${depRaw.slice(0, 2)}:${depRaw.slice(-2)}`;
            const depIso = fromZonedTime(`${ld.departureDate}T${depNorm}:00`, baseTimezone).getTime();
            return depIso >= reportTimeMs;
          });

          const seenKeys = new Set<string>();
          const dutyPeriodLegs = filteredLegsForDutyDate.filter((leg) => {
            const key = `${leg.origin}-${leg.destination}-${leg.depTime ?? ""}-${leg.arrTime ?? ""}`;
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
          });

          const segmentCount = dutyPeriodLegs.filter((l) => !l.deadhead).length;
          const maxFdp = getFar117MaxFdpMinutes(reportTimeNorm, segmentCount);
          if (maxFdp == null) return null;

          let projectedDutyEndIso: string | null = null;
          if (dutyPeriodLegs.length > 0) {
            const dutyPeriodWithArrIso = dutyPeriodLegs
              .map((leg) => {
                const ld = legDates.find((x) => x.leg === leg);
                if (!ld?.arrivalDate) return null;
                const arrRaw = (leg.arrTime ?? "00:00").replace(":", "").padStart(4, "0");
                const arrNorm = `${arrRaw.slice(0, 2)}:${arrRaw.slice(-2)}`;
                const arrIso = fromZonedTime(
                  `${ld.arrivalDate}T${arrNorm}:00`,
                  baseTimezone
                ).toISOString();
                return { leg, arrIso };
              })
              .filter((x): x is { leg: (typeof dutyPeriodLegs)[0]; arrIso: string } => x != null);
            if (dutyPeriodWithArrIso.length > 0) {
              const sorted = dutyPeriodWithArrIso.sort((a, b) =>
                a.arrIso.localeCompare(b.arrIso)
              );
              projectedDutyEndIso = sorted[sorted.length - 1].arrIso;
            }
          }

          if (projectedDutyEndIso == null) {
            if (tripDates.length === 1) projectedDutyEndIso = event.end_time;
            else return null;
          }

          const scheduledProjectedDutyEndIso = projectedDutyEndIso;
          let currentLegArrivalDelayMinutes = 0;
          const arrSched = firstLegLiveStatus?.arr_scheduled_raw;
          const arrNow = firstLegLiveStatus?.arr_actual_raw ?? firstLegLiveStatus?.arr_estimated_raw;
          if (arrSched && arrNow) {
            const schedMs = new Date(arrSched).getTime();
            const nowMs = new Date(arrNow).getTime();
            if (!Number.isNaN(schedMs) && !Number.isNaN(nowMs)) {
              const delayMin = Math.round((nowMs - schedMs) / 60000);
              currentLegArrivalDelayMinutes = delayMin > 0 ? delayMin : 0;
            }
          }

          if (currentLegArrivalDelayMinutes > 0) {
            projectedDutyEndIso = new Date(
              new Date(scheduledProjectedDutyEndIso).getTime() + currentLegArrivalDelayMinutes * 60_000
            ).toISOString();
          }

          const elapsed = computeProjectedFdpElapsedMinutes(reportTimeIso, projectedDutyEndIso);
          if (elapsed == null) return null;
          const remaining = computeFdpRemainingMinutes(maxFdp, elapsed);

          return { remainingMinutes: remaining, maxFdpMinutes: maxFdp };
        })()
      : null;

  return (
    <div
      className={`rounded-3xl border p-4 sm:p-6 transition-all duration-200 hover:-translate-y-0.5 ${
        isOnDuty
          ? "border-l-2 border-l-emerald-500 border-slate-200 bg-white shadow-sm hover:shadow-md dark:border-white/5 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-900/60 dark:to-slate-950/80 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_0_24px_rgba(16,185,129,0.08)] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_0_28px_rgba(16,185,129,0.1),0_10px_30px_rgba(0,0,0,0.4)]"
          : "border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-emerald-400/30 dark:border-white/5 dark:bg-slate-950 dark:bg-gradient-to-b dark:from-slate-900/60 dark:to-slate-950/80 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.03)] dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] dark:hover:border-emerald-400/20"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-white/5">
        {isCurrentTripMode ? (
          <h2 className="text-xl font-semibold tracking-tight">
            Crew<span className="text-[#75C043]">Rules</span><span className="align-super text-[10px]">™</span> Current Trip<span className="align-super text-[10px]">™</span>
          </h2>
        ) : isOnDuty ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-base font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200">
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
              aria-hidden
            />
            {heading}
          </span>
        ) : (
          <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
        )}
        <ScheduleStatusChip
          status={statusData.status}
          lastImportedAt={statusData.lastImportedAt}
          profile={isCurrentTripMode ? profile : undefined}
          showProBadge={isCurrentTripMode}
        />
      </div>

      {far117Result && activeTrip && (
        <div className="mt-4">
          <Far117FdpBanner
            remainingMinutes={far117Result.remainingMinutes}
            maxFdpMinutes={far117Result.maxFdpMinutes}
          />
        </div>
      )}

      {activeTrip && (
        <div className="mt-4 space-y-2">
          <div
            className={`rounded-lg border overflow-hidden ${
              isRedEyeReport
                ? "border-amber-500/30 bg-amber-500/[0.06] dark:border-amber-500/25 dark:bg-amber-500/[0.08]"
                : "border-slate-200 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900/40"
            }`}
          >
          <div className="border-l-4 border-l-emerald-500">
          {legsToShow && legsToShow.length > 0 ? (
            legsToShow.map((leg, i) => {
              const resolved = i === 0 ? resolvedFirstLeg : null;
              const f = resolved?.flight;
              const depTz = f?.originTz ?? getTimezoneFromAirport(leg.origin);
              const arrTz = f?.destTz ?? getTimezoneFromAirport(leg.destination);
              const delayInfo =
                i === 0 && firstLegLiveStatus && firstLegDepIso && firstLegArrIso
                  ? computeDelayInfo(
                      {
                        depUtc: firstLegDepIso,
                        arrUtc: firstLegArrIso,
                        originTz: depTz,
                        destTz: arrTz,
                        dep_scheduled_raw: firstLegLiveStatus.dep_scheduled_raw ?? undefined,
                        dep_estimated_raw: firstLegLiveStatus.dep_estimated_raw ?? undefined,
                        dep_actual_raw: firstLegLiveStatus.dep_actual_raw ?? undefined,
                        arr_scheduled_raw: firstLegLiveStatus.arr_scheduled_raw ?? undefined,
                        arr_estimated_raw: firstLegLiveStatus.arr_estimated_raw ?? undefined,
                        arr_actual_raw: firstLegLiveStatus.arr_actual_raw ?? undefined,
                        status: firstLegLiveStatus.cancelled ? "cancelled" : undefined,
                      },
                      depTz,
                      arrTz,
                      parseIsoTs
                    )
                  : f
                    ? computeDelayInfo(f, depTz, arrTz)
                    : null;
              const depSched = f ? formatInTimeZone(new Date(f.depUtc), depTz, "HH:mm") : leg.depTime;
              const arrSched = f ? formatInTimeZone(new Date(f.arrUtc), arrTz, "HH:mm") : leg.arrTime;
              const depDisplay = delayInfo?.dep ?? { scheduled: depSched, actual: undefined };
              const arrDisplay = delayInfo?.arr ?? { scheduled: arrSched, actual: undefined };
              const numPart = f && (f.flightNumber ?? "").toUpperCase().startsWith((f.carrier ?? "").toUpperCase())
                ? (f.flightNumber ?? "").slice((f.carrier ?? "").length).trim()
                : null;
              const fallbackCarrierForLeg = tenant ? TENANT_CARRIER[tenant] ?? null : null;
              const legFlightNum = leg.flightNumber ?? "";
              const legEncodedCarrier = /^([A-Z]{2})\d/i.exec(legFlightNum)?.[1]?.toUpperCase() ?? null;
              const flightLabel = f ? `${f.carrier}${numPart || f.flightNumber}` : (fallbackCarrierForLeg && !legEncodedCarrier ? `${fallbackCarrierForLeg}${legFlightNum}` : legFlightNum);
              const effectiveCarrier = (f?.carrier ?? legEncodedCarrier ?? fallbackCarrierForLeg ?? "").toUpperCase();
              const effectiveAircraftType = f
                ? (f.aircraft_type ?? (effectiveCarrier === "WN" ? "B737" : "—"))
                : (effectiveCarrier === "WN" ? "B737" : "—");
              if (delayInfo) {
                return (
                  <div
                    key={i}
                    className="pl-3 pr-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-400">
                        {formatDayLabel(`${("departureDate" in leg && leg.departureDate) ? leg.departureDate : displayDateStr ?? formatInTimeZone(new Date(), displaySettings.baseTimezone, "yyyy-MM-dd")}T12:00:00.000Z`, displaySettings.baseTimezone)}
                      </span>
                      <span
                        className={[
                          "px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase",
                          delayInfo.cancelled
                            ? "bg-red-500/20 text-red-400 border border-red-500/40"
                            : (delayInfo.dep || delayInfo.arr)
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                              : "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30",
                        ].join(" ")}
                      >
                        {getDelayStatusLabel(delayInfo)}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <div className="flex flex-col items-start">
                        {delayInfo.cancelled ? (
                          <span className="text-2xl tabular-nums line-through text-red-400/90">{depDisplay.scheduled}</span>
                        ) : (delayInfo.dep && depDisplay.actual) ? (
                          <span className="flex flex-col items-baseline gap-0">
                            <span className="line-through text-amber-400/60 opacity-70 tabular-nums text-[0.85em]">{depDisplay.scheduled}</span>
                            <span className="text-amber-300 font-bold tracking-wide tabular-nums text-2xl">{depDisplay.actual}</span>
                          </span>
                        ) : (
                          <span className="text-2xl font-bold tabular-nums text-slate-200">{depDisplay.scheduled}</span>
                        )}
                      </div>
                      <span className="text-[11px] tabular-nums font-medium text-slate-300 bg-slate-800/50 border border-slate-700/40 px-1.5 py-0.5 rounded">
                        {leg.origin} → {leg.destination}
                      </span>
                      <div className="flex flex-col items-end">
                        {delayInfo.cancelled ? (
                          <span className="text-2xl tabular-nums line-through text-red-400/90">{arrDisplay.scheduled}</span>
                        ) : (delayInfo.arr && arrDisplay.actual) ? (
                          <span className="flex flex-col items-baseline gap-0">
                            <span className="line-through text-amber-400/60 opacity-70 tabular-nums text-[0.85em]">{arrDisplay.scheduled}</span>
                            <span className="text-amber-300 font-bold tracking-wide tabular-nums text-2xl">{arrDisplay.actual}</span>
                          </span>
                        ) : (
                          <span className="text-2xl font-bold tabular-nums text-slate-200">{arrDisplay.scheduled}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                      {leg.deadhead && (
                        <span className="inline-flex rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">DH</span>
                      )}
                      <AirlineLogo carrier={f?.carrier ?? legEncodedCarrier ?? fallbackCarrierForLeg ?? ""} size={24} />
                      <span className="text-slate-300 font-medium font-mono tabular-nums">{flightLabel}</span>
                      <span className="text-slate-600">•</span>
                      {/* Prefer live duration when live delayed times are shown so duration matches displayed dep/arr */}
                      <span>Flight time {fmtHM(computeLiveDurationMinutes(firstLegLiveStatus?.dep_actual_raw ?? firstLegLiveStatus?.dep_estimated_raw ?? null, firstLegLiveStatus?.arr_actual_raw ?? firstLegLiveStatus?.arr_estimated_raw ?? null) ?? f?.durationMinutes ?? legDurationMinutes(leg.depTime ?? "00:00", leg.arrTime ?? "00:00"))}</span>
                      {effectiveAircraftType && (
                        <>
                          <span className="text-slate-600">•</span>
                          <span className="tabular-nums">{effectiveAircraftType}</span>
                        </>
                      )}
                      {f?.dep_gate && (
                        <>
                          <span className="text-slate-600">•</span>
                          <span className="tabular-nums">Gate {f.dep_gate}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              }

              // Fallback when API has no data (e.g. tomorrow's flights): show schedule-derived info to match Commute Assist style
              const legDisplayDate = ("departureDate" in leg && leg.departureDate) ? leg.departureDate : displayDateStr ?? formatInTimeZone(new Date(), displaySettings.baseTimezone, "yyyy-MM-dd");
              const fallbackCarrier = tenant ? TENANT_CARRIER[tenant] ?? null : null;
              const fallbackLegNum = leg.flightNumber ?? "";
              const fallbackLegEncodedCarrier = /^([A-Z]{2})\d/i.exec(fallbackLegNum)?.[1]?.toUpperCase() ?? null;
              const fallbackFlightLabel = fallbackCarrier && !fallbackLegEncodedCarrier ? `${fallbackCarrier}${fallbackLegNum}` : fallbackLegNum;
              const durMin = leg.depTime && leg.arrTime ? legDurationMinutes(leg.depTime, leg.arrTime) : 0;

              return (
                <div key={i} className="pl-3 pr-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-400">
                      {formatDayLabel(`${legDisplayDate}T12:00:00.000Z`, displaySettings.baseTimezone)}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      Scheduled
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-bold tabular-nums text-slate-200">{leg.depTime}</span>
                    <span className="text-[11px] tabular-nums font-medium text-slate-300 bg-slate-800/50 border border-slate-700/40 px-1.5 py-0.5 rounded">
                      {leg.origin} → {leg.destination}
                    </span>
                    <span className="text-2xl font-bold tabular-nums text-slate-200">{leg.arrTime}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                    {leg.deadhead && (
                      <span className="inline-flex rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">DH</span>
                    )}
                    {(fallbackLegEncodedCarrier || fallbackCarrier) && <AirlineLogo carrier={fallbackLegEncodedCarrier ?? fallbackCarrier ?? ""} size={24} />}
                    <span className="text-slate-300 font-medium font-mono tabular-nums">{fallbackFlightLabel}</span>
                    {durMin > 0 && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span>Flight time {fmtHM(durMin)}</span>
                      </>
                    )}
                    {(() => {
                      const fbAcCarrier = (fallbackLegEncodedCarrier ?? fallbackCarrier ?? "").toUpperCase();
                      const fbAcType = fbAcCarrier === "WN" ? "B737" : "—";
                      return (
                        <>
                          <span className="text-slate-600">•</span>
                          <span className="tabular-nums">{fbAcType}</span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="pl-3 pr-3 py-2.5">
              <span className="text-sm text-slate-500">No flights today</span>
            </div>
          )}
          <div className="border-t border-slate-700/60 pl-3 pr-3 py-2">
            <span className="text-sm font-medium text-white">{activeTrip.pairing} • Day {activeTrip.tripDay} of {activeTrip.tripLength}</span>
            {event &&
              (isRedEyeReport && redEyeReportDateLong ? (
                <span className="mt-0.5 block text-sm font-medium text-amber-300">
                  Report: {reportTimeOverride ?? event.report_time ?? "—"} — {redEyeReportDateLong} — Flight departs after midnight
                </span>
              ) : (
                <span className="block text-sm text-slate-400 mt-0.5">
                  Report {reportTimeOverride ?? event.report_time ?? "—"}
                </span>
              ))}
          </div>
          </div>
          {matchingChangeSummary && (
            <div className="border-t border-slate-700/60 pl-3 pr-3 py-2 space-y-0.5">
              <span className="text-sm text-slate-400">Trip updated</span>
              {matchingChangeSummary.removedLegs.length > 0 && (
                <span className="block text-sm text-slate-400">
                  Canceled: {matchingChangeSummary.removedLegs.map((l) => formatLegLine(l, false)).join("; ")}
                </span>
              )}
              {matchingChangeSummary.addedLegs.length > 0 && (
                <span className="block text-sm text-slate-400">
                  Added: {matchingChangeSummary.addedLegs.map((l) => formatLegLine(l, true)).join("; ")}
                </span>
              )}
              {matchingChangeSummary.reportChanged && (
                <span className="block text-sm text-slate-400">
                  Report: {matchingChangeSummary.reportChanged.before} → {matchingChangeSummary.reportChanged.after}
                </span>
              )}
            </div>
          )}
          </div>
        </div>
      )}

      {!hasSchedule && (
        <div className="mt-4 space-y-2">
          <p className="text-slate-400">No schedule imported yet.</p>
          <p className="text-xs text-slate-500">
            This uploads a file from your computer — it does not connect CrewRules™ to FLICA.
          </p>
          <div className="flex justify-end">
            <Link
              href={scheduleHref}
              className="text-sm font-medium text-[#75C043] hover:underline"
            >
              View schedule to upload →
            </Link>
          </div>
        </div>
      )}

      {hasSchedule && event && (
        <div className="mt-4 space-y-2">
          {!activeTrip &&
            (isRedEyeReport ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-2 sm:p-3 dark:border-amber-500/25 dark:bg-amber-500/[0.08]">
                <ScheduleEventCard
                  event={event}
                  displaySettings={displaySettings}
                  position={profile?.position ?? null}
                  compact={false}
                  legsToShow={scheduleEventCardLegsToShow}
                  displayDateStr={displayDateStr}
                  reportTimeOverride={reportTimeOverride}
                  postDutyRelease={label === "post_duty_release"}
                  redEyeReportDateLong={redEyeReportDateLong}
                />
              </div>
            ) : (
              <ScheduleEventCard
                event={event}
                displaySettings={displaySettings}
                position={profile?.position ?? null}
                compact={false}
                legsToShow={scheduleEventCardLegsToShow}
                displayDateStr={displayDateStr}
                reportTimeOverride={reportTimeOverride}
                postDutyRelease={label === "post_duty_release"}
              />
            ))}
          {far117Result && !activeTrip && (
            <Far117FdpBanner
              remainingMinutes={far117Result.remainingMinutes}
              maxFdpMinutes={far117Result.maxFdpMinutes}
            />
          )}
          {isOnDuty && (
            <OnDutyTimer startTime={event.start_time} endTime={event.end_time} timezone={displaySettings.baseTimezone} />
          )}

          {/* Training deviation prompt — shown when deviation preference not yet set */}
          {isTrainingEvent && trainingDeviationHomeCommute === null && event && (
            <TrainingDeviationPrompt
              eventId={event.id}
              trainingCityIata={trainingCityIata}
              trainingCityDisplay={trainingCityDisplay}
              homeAirport={homeAirport}
              homeCity={homeCity}
            />
          )}

          {/* Commute Assist — suppressed for training unless pilot is deviating */}
          {(!isTrainingEvent || trainingDeviationHomeCommute === true) && (
          <PortalNextDutyCommuteSection
            event={event}
            label={label ?? undefined}
            profile={profile}
            displaySettings={displaySettings}
            tenant={tenant}
            portal={portal}
            proActive={proActive}
            displayDateStr={displayDateStr}
            isInPairing={isInPairing}
            commuteAssistDirection={commuteAssistDirection}
            commuteAssistReserveEarlyReleaseWindow={commuteAssistReserveEarlyReleaseWindow}
            commuteAssistSuppressFlightSearch={commuteAssistSuppressFlightSearch}
            dutyStartAirportOverride={
              isTrainingEvent && trainingDeviationHomeCommute === true
                ? (homeAirport ?? legsToShow?.[0]?.origin)
                : legsToShow?.[0]?.origin
            }
            dutyEndAirportOverride={
              isTrainingEvent && trainingDeviationHomeCommute === true
                ? (trainingCityIata ?? undefined)
                : event?.legs && event.legs.length > 0
                  ? event.legs[event.legs.length - 1]?.destination
                  : undefined
            }
            reportTimeOverride={reportTimeOverride}
            dutyStartTime={reportTimeOverride ?? event?.start_time ?? null}
            shortTurnAtBase={shortTurnAtBase}
          />
          )}

          <div className="flex justify-end">
            <Link
              href={scheduleHref}
              className="mt-3 text-sm font-medium text-[#75C043] hover:underline"
            >
              View full schedule →
            </Link>
          </div>
        </div>
      )}

      {hasSchedule && !event && (
        <div className="mt-4 space-y-2">
          <p className="text-slate-400">No upcoming duties.</p>
          <div className="flex justify-end">
            <Link
              href={scheduleHref}
              className="text-sm font-medium text-[#75C043] hover:underline"
            >
              View full schedule →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
