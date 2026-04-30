import Link from "next/link";
import { Lock } from "lucide-react";

import type { NextFlight } from "@/lib/weather-brief/types";
import { AirlineLogo } from "@/components/airline-logo";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";
import { computeDelayInfo, getDelayStatusLabel, parseIsoTs } from "@/lib/flight-delay";
import { formatInTimeZone } from "date-fns-tz";

type Props = {
  flight: NextFlight;
  /** Pro / Enterprise / active trial — show tail and gate rows from live status */
  proActive: boolean;
};

function fmtFlightTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function FlightHeader({ flight, proActive }: Props) {
  const dep = (flight.departureAirport ?? "").replace(/^K/, "") || "—";
  const arr = (flight.arrivalAirport ?? "").replace(/^K/, "") || "—";

  /** For Frontier, display as FFT + number (e.g. FFT2751). Strip F9/FFT prefix if present. */
  const displayFlightNumber = flight.flightNumber
    ? (() => {
        const raw = (flight.flightNumber || "").trim();
        const numeric = raw.replace(/^(F9|FFT)\s*/i, "").replace(/\D/g, "") || raw.replace(/\D/g, "");
        return numeric ? `FFT${numeric}` : null;
      })()
    : null;

  const depTz = getTimezoneFromAirport(flight.departureAirport);
  const arrTz = getTimezoneFromAirport(flight.arrivalAirport);

  const ls = flight.liveStatus;
  const delayInfo =
    ls && flight.departureIso && flight.arrivalIso
      ? computeDelayInfo(
          {
            depUtc: flight.departureIso,
            arrUtc: flight.arrivalIso ?? "",
            originTz: depTz,
            destTz: arrTz,
            dep_scheduled_raw: ls.dep_scheduled_raw ?? undefined,
            dep_estimated_raw: ls.dep_estimated_raw ?? undefined,
            dep_actual_raw: ls.dep_actual_raw ?? undefined,
            arr_scheduled_raw: ls.arr_scheduled_raw ?? undefined,
            arr_estimated_raw: ls.arr_estimated_raw ?? undefined,
            arr_actual_raw: ls.arr_actual_raw ?? undefined,
            status: ls.cancelled ? "cancelled" : undefined,
          },
          depTz,
          arrTz,
          parseIsoTs
        )
      : null;

  const depDisplay =
    delayInfo?.cancelled || !delayInfo
      ? flight.departureTime && flight.departureTimeUtc
        ? `${flight.departureTime} (${flight.departureTimeUtc}Z)`
        : flight.departureTime || "—"
      : delayInfo.dep
        ? `Sched. ${delayInfo.dep.scheduled} → ${delayInfo.dep.actual}`
        : flight.departureTime && flight.departureTimeUtc
          ? `${flight.departureTime} (${flight.departureTimeUtc}Z)`
          : flight.departureTime || "—";

  /** Weather Brief: local + Zulu from timezone-correct instant (same tz source as get-next-flight). */
  const arrFromIso = (() => {
    if (!flight.arrivalIso) return null;
    const d = new Date(flight.arrivalIso);
    if (isNaN(d.getTime())) return null;
    return {
      local: formatInTimeZone(d, arrTz, "HH:mm"),
      utc: formatInTimeZone(d, "UTC", "HH:mm"),
    };
  })();

  const arrDisplay =
    delayInfo?.cancelled || !delayInfo
      ? arrFromIso
        ? `${arrFromIso.local} (${arrFromIso.utc}Z)`
        : flight.arrivalTime && flight.arrivalTimeUtc
          ? `${flight.arrivalTime} (${flight.arrivalTimeUtc}Z)`
          : flight.arrivalTime || "—"
      : delayInfo?.arr
        ? `Sched. ${delayInfo.arr.scheduled} → ${delayInfo.arr.actual}`
        : arrFromIso
          ? `${arrFromIso.local} (${arrFromIso.utc}Z)`
          : flight.arrivalTime && flight.arrivalTimeUtc
            ? `${flight.arrivalTime} (${flight.arrivalTimeUtc}Z)`
            : flight.arrivalTime || "—";

  const flightTimeMinutes =
    flight.blockMinutes ??
    (flight.departureIso && flight.arrivalIso
      ? Math.round((new Date(flight.arrivalIso).getTime() - new Date(flight.departureIso).getTime()) / 60000)
      : null);

  const statusLabel = ls && delayInfo ? getDelayStatusLabel(delayInfo) : null;

  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] md:p-6">
      <div className="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
        {displayFlightNumber && (
          <div className="flex min-w-0 shrink-0 items-center gap-2">
            <AirlineLogo carrier="F9" size={28} />
            <span className="font-mono text-lg font-bold text-white sm:text-xl">
              {displayFlightNumber}
            </span>
          </div>
        )}
        <div className="min-w-0 break-words font-mono text-lg font-bold text-white sm:text-xl">
          {dep} → {arr}
        </div>
        {statusLabel && (
          <span
            className={
              statusLabel === "Cancelled"
                ? "rounded px-2 py-0.5 text-xs font-medium text-red-400 ring-1 ring-red-400/40"
                : statusLabel === "Delayed"
                  ? "rounded px-2 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-amber-400/40"
                  : "rounded px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-400/40"
            }
          >
            {statusLabel}
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-col gap-4 text-sm sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
        <div className="min-w-0 max-w-full">
          <span className="text-slate-500">Departure (local)</span>
          <span className="mt-0.5 block font-mono text-slate-200 break-words sm:mt-0 sm:ml-2 sm:inline">
            {delayInfo?.cancelled ? (
              <span className="text-red-400">Cancelled</span>
            ) : delayInfo?.dep ? (
              <><span className="line-through text-slate-400/90">Sched. {delayInfo.dep.scheduled}</span> <span className="text-amber-400">NOW {delayInfo.dep.actual}</span></>
            ) : (
              depDisplay
            )}
          </span>
        </div>
        {(flight.arrivalIso != null || flight.arrivalTime != null) && (
          <div className="min-w-0 max-w-full">
            <span className="text-slate-500">Arrival (local)</span>
            <span className="mt-0.5 block font-mono text-slate-200 break-words sm:mt-0 sm:ml-2 sm:inline">
              {delayInfo?.cancelled ? (
                <span className="text-red-400">Cancelled</span>
              ) : delayInfo?.arr ? (
                <><span className="line-through text-slate-400/90">Sched. {delayInfo.arr.scheduled}</span> <span className="text-amber-400">NOW {delayInfo.arr.actual}</span></>
              ) : (
                arrDisplay
              )}
            </span>
          </div>
        )}
        {flightTimeMinutes != null && flightTimeMinutes > 0 && (
          <div className="min-w-0 max-w-full">
            <span className="text-slate-500">Flight Time:</span>
            <span className="mt-0.5 block font-mono text-slate-200 break-words sm:mt-0 sm:ml-2 sm:inline">
              {fmtFlightTime(flightTimeMinutes)}
            </span>
          </div>
        )}
        {proActive ? (
          <>
            <div className="min-w-0 max-w-full">
              <span className="text-slate-500">Tail</span>
              <span className="mt-0.5 block font-mono text-slate-200 break-words sm:mt-0 sm:ml-2 sm:inline">
                {ls?.registration?.trim() ? ls.registration.trim() : "—"}
              </span>
            </div>
            <div className="min-w-0 max-w-full">
              <span className="text-slate-500">Departure Gate</span>
              <span className="mt-0.5 block font-mono text-slate-200 break-words sm:mt-0 sm:ml-2 sm:inline">
                {ls?.gate_origin?.trim() ? ls.gate_origin.trim() : "—"}
              </span>
            </div>
            <div className="min-w-0 max-w-full">
              <span className="text-slate-500">Arrival Gate</span>
              <span className="mt-0.5 block font-mono text-slate-200 break-words sm:mt-0 sm:ml-2 sm:inline">
                {ls?.gate_destination?.trim() ? ls.gate_destination.trim() : "—"}
              </span>
            </div>
          </>
        ) : (
          <div className="min-w-0 max-w-full sm:max-w-[min(100%,24rem)]">
            <div className="rounded-lg border border-amber-500/25 bg-amber-950/15 px-3 py-2.5">
              <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-200/95">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
                <span>
                  Aircraft and gate details are included with Advanced Weather Brief.
                </span>
              </p>
              <Link
                href="/frontier/pilots/portal/settings/subscription"
                className="mt-2 inline-block text-xs font-medium text-amber-300 underline-offset-2 transition hover:text-amber-200 hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-500/40 rounded-sm"
              >
                View Pro trial
              </Link>
            </div>
          </div>
        )}
        {flight.tripNumber && (
          <div className="min-w-0 max-w-full">
            <span className="text-slate-500">Trip Pairing:</span>
            <span className="mt-0.5 block font-mono text-slate-200 break-words sm:mt-0 sm:ml-2 sm:inline">{flight.tripNumber}</span>
          </div>
        )}
      </div>
    </div>
  );
}
