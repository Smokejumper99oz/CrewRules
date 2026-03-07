/**
 * Trip change detection: compare previous stored trip vs newly imported trip.
 * For FLICA-imported trip events only.
 */

import { extractPairingKey } from "@/lib/schedule-time";

export type TripLeg = {
  day?: string;
  flightNumber?: string;
  origin: string;
  destination: string;
  depTime?: string;
  arrTime?: string;
  blockMinutes?: number;
  deadhead?: boolean;
  raw?: string;
};

export type StoredTripRow = {
  start_time: string;
  end_time: string;
  title: string | null;
  report_time?: string | null;
  credit_minutes?: number | null;
  legs?: TripLeg[] | null;
  /** Hotel not in schema yet; optional if added later. */
  hotel?: string | null;
};

export type TripChangeSummary = {
  pairing: string;
  hasChanges: boolean;
  removedLegs: TripLeg[];
  addedLegs: TripLeg[];
  reportChanged: { before: string; after: string } | null;
  releaseChanged: { before: string; after: string } | null;
  hotelChanged: { before: string; after: string } | null;
  creditChanged: { before: number; after: number } | null;
};

/** Normalize leg to a comparable key. */
function legKey(leg: TripLeg): string {
  const d = (leg.day ?? "").toUpperCase();
  const fn = (leg.flightNumber ?? "").trim();
  const o = (leg.origin ?? "").toUpperCase();
  const dest = (leg.destination ?? "").toUpperCase();
  const dep = (leg.depTime ?? "").replace(/:/g, "");
  const arr = (leg.arrTime ?? "").replace(/:/g, "");
  return `${d}|${fn}|${o}|${dest}|${dep}|${arr}`;
}

/** Find legs in prev that are not in next (removed). */
function findRemovedLegs(prev: TripLeg[], next: TripLeg[]): TripLeg[] {
  const nextKeys = new Set(next.map(legKey));
  return prev.filter((l) => !nextKeys.has(legKey(l)));
}

/** Find legs in next that are not in prev (added). */
function findAddedLegs(prev: TripLeg[], next: TripLeg[]): TripLeg[] {
  const prevKeys = new Set(prev.map(legKey));
  return next.filter((l) => !prevKeys.has(legKey(l)));
}

/**
 * Compare previous stored trip with newly imported trip.
 * Returns a structured change summary.
 */
export function detectTripChanges(
  previous: StoredTripRow,
  incoming: StoredTripRow
): TripChangeSummary {
  const pairing = extractPairingKey(previous.title ?? incoming.title ?? null);
  const prevLegs = previous.legs ?? [];
  const nextLegs = incoming.legs ?? [];

  const removedLegs = findRemovedLegs(prevLegs, nextLegs);
  const addedLegs = findAddedLegs(prevLegs, nextLegs);

  const prevReport = (previous.report_time ?? "").trim();
  const nextReport = (incoming.report_time ?? "").trim();
  const reportChanged =
    prevReport !== nextReport && (prevReport || nextReport)
      ? { before: prevReport || "—", after: nextReport || "—" }
      : null;

  const prevRelease = previous.end_time ?? "";
  const nextRelease = incoming.end_time ?? "";
  const releaseChanged =
    prevRelease !== nextRelease ? { before: prevRelease, after: nextRelease } : null;

  const prevHotel = (previous.hotel ?? "").trim();
  const nextHotel = (incoming.hotel ?? "").trim();
  const hotelChanged =
    prevHotel !== nextHotel && (prevHotel || nextHotel)
      ? { before: prevHotel || "—", after: nextHotel || "—" }
      : null;

  const prevCredit = previous.credit_minutes ?? 0;
  const nextCredit = incoming.credit_minutes ?? 0;
  const creditChanged =
    prevCredit !== nextCredit ? { before: prevCredit, after: nextCredit } : null;

  const hasChanges =
    removedLegs.length > 0 ||
    addedLegs.length > 0 ||
    reportChanged !== null ||
    releaseChanged !== null ||
    hotelChanged !== null ||
    creditChanged !== null;

  return {
    pairing,
    hasChanges,
    removedLegs,
    addedLegs,
    reportChanged,
    releaseChanged,
    hotelChanged,
    creditChanged,
  };
}

/** Format a leg for compact display (e.g. "F9 2292 MDW → ATL 06:00–09:26" or "DH 1440 MDW → ATL 12:45–15:35"). */
export function formatLegLine(leg: TripLeg, isAdded: boolean): string {
  const prefix = isAdded && leg.deadhead ? "DH " : "";
  const fn = leg.flightNumber ?? "";
  const route = `${leg.origin} → ${leg.destination}`;
  const time = leg.depTime && leg.arrTime ? ` ${leg.depTime}–${leg.arrTime}` : "";
  return `${prefix}${fn} ${route}${time}`.trim();
}
