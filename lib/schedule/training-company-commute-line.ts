/**
 * Company-provided deadhead from FLICA (ICS DESCRIPTION on the companion trip).
 * Times are the same HHMM local-at-station values FLICA prints (dep at origin, arr at dest).
 * Personal / deviated commute is not inferred — only this schedule line.
 *
 * Outbound (to recurrent): DH legs whose destination reaches the training station (e.g. SJU → DEN).
 * Return: DH legs departing the training station (e.g. DEN → MCO → SJU).
 */

import type { ScheduleEventLeg } from "@/app/frontier/pilots/portal/schedule/actions";
import type { TimeFormat } from "@/lib/schedule-time";
import { isOvernightLeg } from "@/lib/leg-dates";
import { formatInTimeZone } from "date-fns-tz";

export type TrainingCommutePopoverPayload = {
  toTraining: { line: string | null; legs: ScheduleEventLeg[] };
  fromTraining: { line: string | null; legs: ScheduleEventLeg[] };
};

export type TrainingCompanyCommuteDirection = "to_training" | "from_training";

function parseLegHm(t: string | undefined): { h: number; m: number } | null {
  if (!t?.trim()) return null;
  const s = t.trim().replace(":", "");
  if (!/^\d{3,4}$/.test(s)) return null;
  const p = s.padStart(4, "0");
  const h = parseInt(p.slice(0, 2), 10);
  const m = parseInt(p.slice(2), 10);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

/** Match FLICA’s clock in 24h mode (zero-padded HH:mm from import); 12h only when user prefers it. */
function formatFlicaHm(h: number, m: number, timeFormat: TimeFormat): string {
  if (timeFormat === "24h") {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const d = new Date(Date.UTC(2000, 0, 1, h, m));
  return formatInTimeZone(d, "UTC", "h:mm a");
}

function sliceToTrainingStation(pool: ScheduleEventLeg[], train: string): ScheduleEventLeg[] {
  if (train.length !== 3) return [];
  const endIdx = pool.findIndex((l) => (l.destination ?? "").trim().toUpperCase() === train);
  if (endIdx < 0) return [];
  return pool.slice(0, endIdx + 1);
}

function sliceFromTrainingStation(pool: ScheduleEventLeg[], train: string): ScheduleEventLeg[] {
  if (train.length !== 3) return [];
  const idx = pool.findIndex((l) => (l.origin ?? "").trim().toUpperCase() === train);
  return idx >= 0 ? pool.slice(idx) : [];
}

/**
 * Prefix ending at the training station (positioning to recurrent).
 * Prefers DH-marked legs; if none match, uses all companion legs (FLICA sometimes omits Dh on positioning).
 */
export function getTrainingCompanyCommuteLegsToTraining(
  legs: ScheduleEventLeg[],
  trainingStationIata: string | null
): ScheduleEventLeg[] {
  const train = (trainingStationIata ?? "").trim().toUpperCase();
  if (!legs.length || train.length !== 3) return [];
  const dh = legs.filter((l) => l.deadhead === true);
  if (dh.length > 0) {
    const fromDh = sliceToTrainingStation(dh, train);
    if (fromDh.length > 0) return fromDh;
  }
  return sliceToTrainingStation(legs, train);
}

/**
 * Legs from the training station onward (company travel home).
 * Prefers DH-marked legs; if none match, uses all companion legs.
 */
export function getTrainingCompanyCommuteLegsFromTraining(
  legs: ScheduleEventLeg[],
  trainingStationIata: string | null
): ScheduleEventLeg[] {
  const train = (trainingStationIata ?? "").trim().toUpperCase();
  if (!legs.length) return [];
  const dh = legs.filter((l) => l.deadhead === true);
  if (dh.length > 0) {
    const fromDh = sliceFromTrainingStation(dh, train);
    if (fromDh.length > 0) return fromDh;
  }
  if (train.length !== 3) return [];
  return sliceFromTrainingStation(legs, train);
}

/** @deprecated Use getTrainingCompanyCommuteLegsFromTraining or getTrainingCompanyCommuteLegsToTraining. */
export function getTrainingCompanyCommuteLegs(
  legs: ScheduleEventLeg[],
  trainingStationIata: string | null
): ScheduleEventLeg[] {
  return getTrainingCompanyCommuteLegsFromTraining(legs, trainingStationIata);
}

function buildLineFromChain(
  chain: ScheduleEventLeg[],
  timeFormat: TimeFormat,
  direction: TrainingCompanyCommuteDirection
): string | null {
  if (chain.length === 0) return null;
  const first = chain[0]!;
  const last = chain[chain.length - 1]!;
  const depParsed = parseLegHm(first.depTime);
  const arrParsed = parseLegHm(last.arrTime);
  if (!depParsed || !arrParsed) return null;

  const depDisp = formatFlicaHm(depParsed.h, depParsed.m, timeFormat);
  const arrDisp = formatFlicaHm(arrParsed.h, arrParsed.m, timeFormat);
  const depAp = (first.origin ?? "").trim().toUpperCase();
  const arrAp = (last.destination ?? "").trim().toUpperCase();
  const overnight = isOvernightLeg(last);

  const tag = direction === "to_training" ? "To recurrent (FLICA)" : "Return (FLICA)";
  let line = `${tag} · ${depDisp} local ${depAp} → ${arrDisp} local ${arrAp}`;
  if (overnight) line += " (+1)";
  return line;
}

/**
 * Summary line for one direction of company DH on the companion trip.
 */
export function buildTrainingCompanyCommuteLine(
  legs: ScheduleEventLeg[],
  opts: {
    timeFormat: TimeFormat;
    trainingStationIata: string | null;
    direction?: TrainingCompanyCommuteDirection;
  }
): string | null {
  const direction = opts.direction ?? "from_training";
  const chain =
    direction === "to_training"
      ? getTrainingCompanyCommuteLegsToTraining(legs, opts.trainingStationIata)
      : getTrainingCompanyCommuteLegsFromTraining(legs, opts.trainingStationIata);
  return buildLineFromChain(chain, opts.timeFormat, direction);
}
