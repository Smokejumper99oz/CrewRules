/**
 * Pure helpers for resolving training-station IATA from FLICA rows (no "use server" —
 * keep sync exports out of Server Action modules).
 */

type LegForTrainingCity = {
  destination?: string;
  blockMinutes?: number;
};

export type TrainingEventRowForCity = {
  event_type: string;
  legs?: LegForTrainingCity[] | null;
  route?: string | null;
};

/**
 * Extract the training city IATA from trip/training legs.
 * Uses the longest leg (most block minutes) whose destination isn't the crew base.
 */
export function extractTrainingCityFromLegs(
  legs: LegForTrainingCity[],
  baseAirport: string | null | undefined
): string | null {
  if (!legs || legs.length === 0) return null;
  const base = (baseAirport ?? "").trim().toUpperCase();

  let bestLeg: LegForTrainingCity | null = null;
  let bestBlock = -1;
  for (const leg of legs) {
    const dest = (leg.destination ?? "").trim().toUpperCase();
    if (!dest || dest === base) continue;
    const block = leg.blockMinutes ?? 0;
    if (block > bestBlock) {
      bestBlock = block;
      bestLeg = leg;
    }
  }
  if (bestLeg?.destination) return bestLeg.destination.trim().toUpperCase();

  for (const leg of legs) {
    const dest = (leg.destination ?? "").trim().toUpperCase();
    if (dest && dest !== base) return dest;
  }
  return null;
}

/**
 * When companion-trip lookup fails: training station IATA from the training row's legs or route text (FLICA upload).
 */
export function getTrainingCityIataFromTrainingRow(
  event: TrainingEventRowForCity,
  baseAirport: string | null | undefined
): string | null {
  if (event.event_type !== "training") return null;
  const legs = event.legs ?? [];
  if (legs.length > 0) {
    const fromLegs = extractTrainingCityFromLegs(legs, baseAirport);
    if (fromLegs) return fromLegs;
  }
  const route = event.route?.trim();
  if (!route) return null;
  const codes = route.toUpperCase().match(/[A-Z]{3}/g);
  if (!codes?.length) return null;
  const base = (baseAirport ?? "").trim().toUpperCase();
  for (let i = codes.length - 1; i >= 0; i--) {
    const c = codes[i]!;
    if (c !== base) return c;
  }
  return codes[codes.length - 1] ?? null;
}

/**
 * True when recurrent training is in the pilot's crew domicile or home airport — no "commute from home" choice applies.
 */
export function trainingCityIsPilotBaseOrHome(
  trainingCityIata: string | null | undefined,
  baseAirport: string | null | undefined,
  homeAirport: string | null | undefined
): boolean {
  const t = (trainingCityIata ?? "").trim().toUpperCase();
  if (t.length !== 3) return false;
  const b = (baseAirport ?? "").trim().toUpperCase();
  const h = (homeAirport ?? "").trim().toUpperCase();
  return (b.length === 3 && t === b) || (h.length === 3 && t === h);
}
