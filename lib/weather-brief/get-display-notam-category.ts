import type { OperationalNotamCategory, OperationalNotamItem } from "@/lib/weather-brief/notams/types";

/** Facility / navaid tokens first so “… NAV ILS …” headers bucket as navaid before generic ILS. */
const RE_NAV = /\b(?:VOR|DME|NDB|NAVAID|VORTAC|TACAN|NAV)\b/i;
const RE_ILS = /\bILS\b/i;

/**
 * UI-only category for pills, filtering, and the NOTAM summary row — does not alter server data.
 * Prefers aviation tokens from raw text + decoded plain English before model/heuristic buckets.
 */
export function getDisplayNotamCategory(it: OperationalNotamItem): OperationalNotamCategory {
  const overlay = it.decoded;

  let scan = it.rawText;
  if (overlay?.decodeStatus === "ok") {
    scan += `\n${overlay.plainEnglish ?? ""}`;
  }

  if (RE_NAV.test(scan)) {
    return "navaid";
  }
  if (RE_ILS.test(scan)) {
    return "ils";
  }
  if (overlay?.decodeStatus === "ok") {
    return overlay.aiCategory;
  }
  return it.category;
}
