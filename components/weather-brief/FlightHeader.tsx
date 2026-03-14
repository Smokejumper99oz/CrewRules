import type { NextFlight } from "@/lib/weather-brief/types";
import { AirlineLogo } from "@/components/airline-logo";
import { getTimezoneFromAirport } from "@/lib/airport-timezone";
import { computeDelayInfo, getDelayStatusLabel, parseIsoTs } from "@/lib/flight-delay";

type Props = {
  flight: NextFlight;
};

function fmtFlightTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function FlightHeader({ flight }: Props) {
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

  const arrDisplay =
    delayInfo?.cancelled || !delayInfo
      ? flight.arrivalTime && flight.arrivalTimeUtc
        ? `${flight.arrivalTime} (${flight.arrivalTimeUtc}Z)`
        : flight.arrivalTime || "—"
      : delayInfo?.arr
        ? `Sched. ${delayInfo.arr.scheduled} → ${delayInfo.arr.actual}`
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
    <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] md:p-6">
      <div className="flex flex-wrap items-center gap-4">
        {displayFlightNumber && (
          <div className="flex items-center gap-2">
            <AirlineLogo carrier="F9" size={28} />
            <span className="font-mono text-xl font-bold text-white">
              {displayFlightNumber}
            </span>
          </div>
        )}
        <div className="font-mono text-xl font-bold text-white">
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
      <div className="mt-4 flex flex-wrap gap-6 text-sm">
        <div>
          <span className="text-slate-500">Departure (local)</span>
          <span className="ml-2 font-mono text-slate-200">{depDisplay}</span>
        </div>
        {flight.arrivalTime != null && (
          <div>
            <span className="text-slate-500">Arrival (local)</span>
            <span className="ml-2 font-mono text-slate-200">{arrDisplay}</span>
          </div>
        )}
        {flight.tripNumber && (
          <div>
            <span className="text-slate-500">Trip Pairing:</span>
            <span className="ml-2 font-mono text-slate-200">{flight.tripNumber}</span>
          </div>
        )}
        {flightTimeMinutes != null && flightTimeMinutes > 0 && (
          <div>
            <span className="text-slate-500">Flight Time:</span>
            <span className="ml-2 font-mono text-slate-200">
              {fmtFlightTime(flightTimeMinutes)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
