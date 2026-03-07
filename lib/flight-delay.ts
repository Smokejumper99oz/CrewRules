/**
 * Shared flight delay/on-time computation.
 * Used by Commute Assist and Current Trip card.
 */

import { formatInTimeZone } from "date-fns-tz";
import { parseAviationstackTs } from "@/lib/aviationstack";

export type DelayInfo = {
  cancelled: boolean;
  dep?: { scheduled: string; actual: string };
  arr?: { scheduled: string; actual: string };
};

export type FlightDelayInput = {
  depUtc: string;
  arrUtc: string;
  originTz?: string;
  destTz?: string;
  dep_scheduled_raw?: string;
  dep_estimated_raw?: string;
  dep_actual_raw?: string;
  arr_scheduled_raw?: string;
  arr_estimated_raw?: string;
  arr_actual_raw?: string;
  status?: string;
};

/**
 * Compute delay info for display (On time / Delayed / Cancelled).
 */
export function computeDelayInfo(
  opt: FlightDelayInput,
  originTz: string,
  destTz: string
): DelayInfo {
  const depTz = opt.originTz ?? originTz;
  const arrTz = opt.destTz ?? destTz;

  if (opt.status === "cancelled") {
    const depSched = opt.dep_scheduled_raw
      ? formatInTimeZone(parseAviationstackTs(opt.dep_scheduled_raw, depTz), depTz, "HH:mm")
      : formatInTimeZone(new Date(opt.depUtc), depTz, "HH:mm");
    const arrSched = opt.arr_scheduled_raw
      ? formatInTimeZone(parseAviationstackTs(opt.arr_scheduled_raw, arrTz), arrTz, "HH:mm")
      : formatInTimeZone(new Date(opt.arrUtc), arrTz, "HH:mm");
    return { cancelled: true, dep: { scheduled: depSched, actual: depSched }, arr: { scheduled: arrSched, actual: arrSched } };
  }

  const result: DelayInfo = { cancelled: false };

  const depWasRaw = opt.dep_scheduled_raw;
  const depNowRaw = opt.dep_actual_raw ?? opt.dep_estimated_raw;
  if (depWasRaw && depNowRaw) {
    const wasMs = parseAviationstackTs(depWasRaw, depTz).getTime();
    const nowMs = parseAviationstackTs(depNowRaw, depTz).getTime();
    if (!Number.isNaN(wasMs) && !Number.isNaN(nowMs) && nowMs - wasMs >= 60000) {
      result.dep = {
        scheduled: formatInTimeZone(parseAviationstackTs(depWasRaw, depTz), depTz, "HH:mm"),
        actual: formatInTimeZone(parseAviationstackTs(depNowRaw, depTz), depTz, "HH:mm"),
      };
    }
  }

  const arrWasRaw = opt.arr_scheduled_raw;
  const arrNowRaw = opt.arr_actual_raw ?? opt.arr_estimated_raw;
  if (arrWasRaw && arrNowRaw) {
    const wasMs = parseAviationstackTs(arrWasRaw, arrTz).getTime();
    const nowMs = parseAviationstackTs(arrNowRaw, arrTz).getTime();
    if (!Number.isNaN(wasMs) && !Number.isNaN(nowMs) && nowMs - wasMs >= 60000) {
      result.arr = {
        scheduled: formatInTimeZone(parseAviationstackTs(arrWasRaw, arrTz), arrTz, "HH:mm"),
        actual: formatInTimeZone(parseAviationstackTs(arrNowRaw, arrTz), arrTz, "HH:mm"),
      };
    }
  }

  return result;
}

/** Status label for display. */
export function getDelayStatusLabel(delayInfo: DelayInfo): "On time" | "Delayed" | "Cancelled" {
  if (delayInfo.cancelled) return "Cancelled";
  if (delayInfo.dep || delayInfo.arr) return "Delayed";
  return "On time";
}
