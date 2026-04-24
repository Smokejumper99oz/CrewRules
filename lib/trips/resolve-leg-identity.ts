/**
 * Resolve current trip leg to carrier/airline/status using existing flight-data infrastructure.
 * Used by Current Trip™ card for leg enrichment.
 * Reuses getCommuteFlights (DB-backed cache) to avoid duplicate AviationStack requests with Commute Assist.
 */

import { parseAviationstackTs, type CommuteFlight } from "@/lib/aviationstack";
import { getCommuteFlights } from "@/app/frontier/pilots/portal/commute/actions";
import { AIRLINE_NAMES } from "@/lib/airlines";

export type ResolvedLegIdentity = {
  carrierCode?: string;
  airlineName?: string;
  status?: string;
  /** Full flight for delay/on-time computation. */
  flight?: ResolvedLegFlight;
};

export type ResolvedLegFlight = {
  carrier: string;
  flightNumber: string;
  depUtc: string;
  arrUtc: string;
  originTz: string;
  destTz: string;
  dep_scheduled_raw?: string;
  dep_estimated_raw?: string;
  dep_actual_raw?: string;
  arr_scheduled_raw?: string;
  arr_estimated_raw?: string;
  arr_actual_raw?: string;
  status?: string;
  durationMinutes: number;
  aircraft_type?: string | null;
  dep_gate?: string | null;
};

/** Extract numeric part of flight number for matching (e.g. "1440", "WN1440" → "1440"). */
function flightNumberNumeric(flightNumber: string): string {
  const s = (flightNumber ?? "").trim();
  const m = s.match(/\d+/);
  return m ? m[0] : s.replace(/\D/g, "");
}

/** True if leg flight number matches API flight (carrier+number, e.g. WN1440). */
function flightNumberMatches(legNum: string, apiFlightNumber: string): boolean {
  const legNumeric = flightNumberNumeric(legNum);
  if (!legNumeric) return false;
  const apiFull = (apiFlightNumber ?? "").trim().toUpperCase();
  const apiNumeric = flightNumberNumeric(apiFull);
  return legNumeric === apiNumeric || apiFull.endsWith(legNumeric);
}

function hhmmStringToMinutes(hhmm: string): number | null {
  const d = (hhmm ?? "").replace(/\D/g, "").padStart(4, "0").slice(0, 4);
  if (d.length < 4) return null;
  const h = parseInt(d.slice(0, 2), 10);
  const m = parseInt(d.slice(2, 4), 10);
  if (Number.isNaN(h) || Number.isNaN(m) || h > 23 || m > 59) return null;
  return h * 60 + m;
}

function extractApiDepHhMm(f: { dep_scheduled_raw?: string; departureTime?: string | Date }): string | null {
  const depRaw = f.dep_scheduled_raw ?? (f.departureTime != null ? String(f.departureTime) : "");
  const digits = depRaw.replace(/[^0-9]/g, "");
  const depHhMm = digits.length >= 12 ? digits.slice(8, 12) : digits.slice(0, 4);
  if (depHhMm.length < 3) return null;
  return depHhMm.padStart(4, "0");
}

const DEADHEAD_DEP_TOLERANCE_MIN = 15;

/**
 * Deadhead: require a single best match within ±15 minutes dep time; ambiguous → no carrier.
 * Non-deadhead: unchanged (first match, legacy ~30 “clock” tolerance).
 */
function pickMatchForLeg(
  flights: CommuteFlight[],
  legNum: string,
  legDep: string,
  deadhead: boolean
): CommuteFlight | null {
  if (!deadhead) {
    return (
      flights.find((f) => {
        if (!flightNumberMatches(legNum, f.flightNumber)) return false;
        if (legDep) {
          const depRaw = f.dep_scheduled_raw ?? f.departureTime ?? "";
          const digits = depRaw.replace(/[^0-9]/g, "");
          const depHhMm = digits.length >= 12 ? digits.slice(8, 12) : digits.slice(0, 4);
          if (depHhMm && legDep) {
            const diff = Math.abs(parseInt(depHhMm, 10) - parseInt(legDep, 10));
            if (diff > 30) return false;
          }
        }
        return true;
      }) ?? null
    );
  }

  const legDepMin = hhmmStringToMinutes(legDep);
  if (!legDep || legDepMin == null) return null;

  const scored = flights
    .filter((f) => flightNumberMatches(legNum, f.flightNumber))
    .map((f) => {
      const apiHhMm = extractApiDepHhMm(f);
      const apiMin = apiHhMm ? hhmmStringToMinutes(apiHhMm) : null;
      if (apiMin == null) return { f, delta: Number.POSITIVE_INFINITY };
      const delta = Math.abs(legDepMin - apiMin);
      return { f, delta };
    })
    .filter((x) => x.delta <= DEADHEAD_DEP_TOLERANCE_MIN)
    .sort((a, b) => a.delta - b.delta);

  if (scored.length === 0) return null;
  if (scored.length === 1) return scored[0]!.f;
  if (scored[0]!.delta < scored[1]!.delta) return scored[0]!.f;
  return null;
}

export type ResolveLegIdentityOptions = {
  /** Strict single-match dep window (±15 min); no ambiguous carrier. */
  deadhead?: boolean;
};

/**
 * Resolve the first leg of an active trip to carrier/airline/status.
 * Uses getCommuteFlights (DB-backed cache) so Dashboard load shares cache with Commute Assist.
 * Returns null if no match or API unavailable.
 */
export async function resolveLegIdentity(
  input: {
    flightNumber: string;
    origin: string;
    destination: string;
    depTime?: string;
    date: string; // YYYY-MM-DD in user's timezone
  },
  options?: ResolveLegIdentityOptions
): Promise<ResolvedLegIdentity | null> {
  const origin = (input.origin ?? "").trim().toUpperCase();
  const destination = (input.destination ?? "").trim().toUpperCase();
  if (origin.length !== 3 || destination.length !== 3) return null;

  try {
    const res = await getCommuteFlights({
      origin,
      destination,
      date: input.date,
      skipPlanGating: true,
    });
    if (!res.ok || !res.flights) return null;
    const flights = res.flights;

    const legNum = (input.flightNumber ?? "").trim();
    const legDep = (input.depTime ?? "").replace(/:/g, "").slice(0, 4); // HHMM
    const deadhead = options?.deadhead === true;

    const match = pickMatchForLeg(flights, legNum, legDep, deadhead);

    if (!match) return null;

    const carrierCode = (match.carrier ?? "").trim().toUpperCase();
    const airlineName = carrierCode ? AIRLINE_NAMES[carrierCode] ?? undefined : undefined;
    const status = match.status
      ? String(match.status).charAt(0).toUpperCase() + String(match.status).slice(1).toLowerCase()
      : undefined;

    const depTz = match.origin_tz ?? "UTC";
    const arrTz = match.dest_tz ?? "UTC";
    const depUtc = match.dep_scheduled_raw
      ? parseAviationstackTs(match.dep_scheduled_raw, depTz).toISOString()
      : new Date(match.departureTime).toISOString();
    const arrUtc = match.arr_scheduled_raw
      ? parseAviationstackTs(match.arr_scheduled_raw, arrTz).toISOString()
      : new Date(match.arrivalTime).toISOString();

    const flight: ResolvedLegFlight = {
      carrier: match.carrier,
      flightNumber: match.flightNumber,
      depUtc,
      arrUtc,
      originTz: depTz,
      destTz: arrTz,
      dep_scheduled_raw: match.dep_scheduled_raw,
      dep_estimated_raw: match.dep_estimated_raw,
      dep_actual_raw: match.dep_actual_raw,
      arr_scheduled_raw: match.arr_scheduled_raw,
      arr_estimated_raw: match.arr_estimated_raw,
      arr_actual_raw: match.arr_actual_raw,
      status: match.status,
      durationMinutes: match.durationMinutes,
      aircraft_type: match.aircraft_type,
      dep_gate: match.dep_gate,
    };

    return {
      carrierCode: carrierCode || undefined,
      airlineName: airlineName || undefined,
      status: status || undefined,
      flight,
    };
  } catch {
    return null;
  }
}
