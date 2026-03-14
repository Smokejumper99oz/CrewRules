import Link from "next/link";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { getNextDuty, getScheduleImportStatus, getScheduleDisplaySettings } from "@/app/frontier/pilots/portal/schedule/actions";
import { getProfile, isProActive } from "@/lib/profile";
import type { ActiveTrip } from "@/lib/trips/get-active-trip";
import { formatLegLine } from "@/lib/trips/detect-trip-changes";
import type { TripChangeSummary } from "@/lib/trips/detect-trip-changes";
import { resolveLegIdentity } from "@/lib/trips/resolve-leg-identity";
import { formatDayLabel, addDay } from "@/lib/schedule-time";
import { computeDelayInfo, getDelayStatusLabel, parseIsoTs } from "@/lib/flight-delay";
import { AirlineLogo } from "@/components/airline-logo";
import { ScheduleStatusChip } from "@/components/schedule-status-chip";
import { ScheduleEventCard } from "@/components/schedule-event-card";
import { OnDutyTimer } from "@/components/on-duty-timer";
import { PortalNextDutyCommuteSection } from "@/components/portal-next-duty-commute-section";
import { getFiledRoute } from "@/lib/weather-brief/get-filed-route";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";

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

/** Default carrier for tenant when API has no data (e.g. Frontier = F9). */
const TENANT_CARRIER: Record<string, string> = { frontier: "F9" };

/** Subtract minutes from HH:MM; returns HH:MM. */
function subtractMinutesFromTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMin = (h ?? 0) * 60 + (m ?? 0) - minutes;
  const wrapped = ((totalMin % (24 * 60)) + 24 * 60) % (24 * 60);
  const nh = Math.floor(wrapped / 60);
  const nm = wrapped % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

const DUTY_LABELS: Record<string, string> = {
  on_duty: "On Duty",
  later_today: "Later today",
  next_duty: "Next Duty",
};

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
  const [{ event, label, hasSchedule, legsToShow, displayDateStr, isInPairing }, statusData, displaySettings, profile] = await Promise.all([
    getNextDuty(),
    getScheduleImportStatus(),
    getScheduleDisplaySettings(),
    getProfile(),
  ]);
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

  const isCurrentTripMode = !!activeTrip;
  const matchingChangeSummary = activeTrip
    ? tripChangeSummaries.find((s) => s.pairing === activeTrip.pairing)
    : null;

  const firstLeg = activeTrip?.todayLegs?.[0];
  const displayDateForResolve = activeTrip?.displayDateStr ?? formatInTimeZone(new Date(), displaySettings.baseTimezone, "yyyy-MM-dd");
  const [resolvedFirstLeg, filedResult] = await Promise.all([
    firstLeg && firstLeg.origin && firstLeg.destination
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
      const depDateStr = firstLeg.departureDate ?? displayDateForResolve;
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

  return (
    <div
      className={`rounded-3xl bg-gradient-to-b from-slate-900/60 to-slate-950/80 border border-white/5 p-6 transition-all duration-200 hover:-translate-y-0.5 ${
        isOnDuty
          ? "border-l-2 border-l-emerald-500 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_0_24px_rgba(16,185,129,0.08)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_0_28px_rgba(16,185,129,0.1),0_10px_30px_rgba(0,0,0,0.4)]"
          : "shadow-[0_0_0_1px_rgba(255,255,255,0.03)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.4)] hover:border-emerald-400/20"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2">
        {isCurrentTripMode ? (
          <h2 className="text-xl font-semibold tracking-tight">
            Crew<span className="text-[#75C043]">Rules</span><span className="align-super text-[10px]">™</span> Current Trip<span className="align-super text-[10px]">™</span>
          </h2>
        ) : isOnDuty ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-950/80 px-4 py-2 text-base font-bold text-emerald-200">
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

      {activeTrip && (
        <div className="mt-4 rounded-lg border border-slate-700/60 bg-slate-900/40 overflow-hidden">
          <div className="border-l-4 border-l-emerald-500">
          {activeTrip.todayLegs.length > 0 ? (
            activeTrip.todayLegs.map((leg, i) => {
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
              const flightLabel = f ? `${f.carrier} ${numPart || f.flightNumber}` : (fallbackCarrierForLeg ? `${fallbackCarrierForLeg} ${leg.flightNumber}` : leg.flightNumber);
              const effectiveAircraftType = f
                ? (f.aircraft_type ?? (f.carrier?.toUpperCase() === "WN" ? "B737" : "—"))
                : "—";
              if (delayInfo) {
                return (
                  <div
                    key={i}
                    className="pl-3 pr-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-400">
                        {formatDayLabel(`${(leg.departureDate ?? activeTrip?.displayDateStr ?? formatInTimeZone(new Date(), displaySettings.baseTimezone, "yyyy-MM-dd"))}T12:00:00.000Z`, displaySettings.baseTimezone)}
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
                      <AirlineLogo carrier={f?.carrier ?? fallbackCarrierForLeg ?? ""} size={24} />
                      <span className="text-slate-300 font-medium font-mono tabular-nums">{flightLabel}</span>
                      <span className="text-slate-600">•</span>
                      <span>Flight time {fmtHM(f?.durationMinutes ?? legDurationMinutes(leg.depTime, leg.arrTime))}</span>
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
              const legDisplayDate = leg.departureDate ?? activeTrip?.displayDateStr ?? formatInTimeZone(new Date(), displaySettings.baseTimezone, "yyyy-MM-dd");
              const fallbackCarrier = tenant ? TENANT_CARRIER[tenant] ?? null : null;
              const fallbackFlightLabel = fallbackCarrier ? `${fallbackCarrier} ${leg.flightNumber}` : leg.flightNumber;
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
                    {fallbackCarrier && <AirlineLogo carrier={fallbackCarrier} size={24} />}
                    <span className="text-slate-300 font-medium font-mono tabular-nums">{fallbackFlightLabel}</span>
                    {durMin > 0 && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span>Flight time {fmtHM(durMin)}</span>
                      </>
                    )}
                    <span className="text-slate-600">•</span>
                    <span className="tabular-nums">—</span>
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
            {event && (
              <span className="block text-sm text-slate-400 mt-0.5">
                Report {reportTimeOverride ?? event.report_time ?? "—"}
              </span>
            )}
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
          {!activeTrip && (
            <ScheduleEventCard
              event={event}
              displaySettings={displaySettings}
              position={profile?.position ?? null}
              compact={false}
              legsToShow={legsToShow}
              displayDateStr={displayDateStr}
              reportTimeOverride={reportTimeOverride}
            />
          )}
          {isOnDuty && (
            <OnDutyTimer startTime={event.start_time} endTime={event.end_time} timezone={displaySettings.baseTimezone} />
          )}

          {/* Commute Assist — layout scaffold with mock data */}
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
            dutyStartAirportOverride={legsToShow?.[0]?.origin}
            reportTimeOverride={reportTimeOverride}
            dutyStartTime={reportTimeOverride ?? event?.start_time ?? null}
          />

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
