/**
 * Display-only time relevance for SIGMET/AIRMET-style bulletins.
 * Parses VALID UNTIL DDHHMM (Zulu) and compares to scheduled departure — does not alter fetch/merge.
 */

import type { EnrouteAdvisory } from "./types";

export type EnrouteAdvisoryTimeRelevance = "active" | "near_term";

/** Beyond scheduled departure: still "near_term" if validity ends within this many hours after dep. */
const POST_DEP_NEAR_TERM_MS = 12 * 60 * 60 * 1000;

function parseDdHhMm(ddhhmm: string): { day: number; hour: number; minute: number } | null {
  if (!/^\d{6}$/.test(ddhhmm)) return null;
  const day = Number(ddhhmm.slice(0, 2));
  const hour = Number(ddhhmm.slice(2, 4));
  const minute = Number(ddhhmm.slice(4, 6));
  if (!Number.isFinite(day) || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour > 23 || minute > 59 || day < 1 || day > 31) return null;
  return { day, hour, minute };
}

/** Pick UTC instant closest to anchor among same day/hour/minute in prev/current/next calendar month. */
export function closestZuluDdHhMmUtc(ddhhmm: string, anchorUtc: Date): Date | null {
  const p = parseDdHhMm(ddhhmm);
  if (!p) return null;
  const y = anchorUtc.getUTCFullYear();
  const m0 = anchorUtc.getUTCMonth();
  let best: Date | null = null;
  let bestDist = Infinity;
  for (let dm = -1; dm <= 1; dm++) {
    const t = new Date(Date.UTC(y, m0 + dm, p.day, p.hour, p.minute, 0));
    const dist = Math.abs(t.getTime() - anchorUtc.getTime());
    if (dist < bestDist) {
      bestDist = dist;
      best = t;
    }
  }
  return best;
}

function parseIssueUtcGuessFromRaw(rawText: string, anchorUtc: Date): Date | null {
  const line = (rawText.split(/\r?\n/).find((l) => l.trim()) ?? "").trim();
  const m = line.match(/^\S+\s+\S+\s+(\d{6})\b/);
  if (!m) return null;
  return closestZuluDdHhMmUtc(m[1], anchorUtc);
}

/**
 * Extract VALID UNTIL DDHHMM → UTC Date (anchor = scheduled departure for month disambiguation).
 */
export function parseValidUntilUtcFromRaw(rawText: string, anchorUtc: Date): Date | null {
  const u = rawText.toUpperCase();
  const m = u.match(/\bVALID\s+UNTIL\s+(\d{6})Z?\b/);
  if (!m) return null;
  const valid = closestZuluDdHhMmUtc(m[1], anchorUtc);
  if (!valid) return null;
  const issue = parseIssueUtcGuessFromRaw(rawText, anchorUtc);
  if (issue && valid.getTime() < issue.getTime() - 60_000) {
    const bumped = new Date(valid);
    bumped.setUTCMonth(bumped.getUTCMonth() + 1);
    if (bumped.getTime() >= issue.getTime() - 60_000) return bumped;
  }
  return valid;
}

export type ClassifyEnrouteTimeOptions = {
  nowUtc?: Date;
};

/**
 * Display-only:
 * - expired: validUntil is in the past, or validUntil before scheduled departure (not useful for this leg).
 * - near_term: still valid at departure but ends within 12h after departure.
 * - active: validUntil after departure + 12h (covers departure/enroute window longer).
 * - unknown: no VALID UNTIL parsed — kept for display (lenient).
 */
export function classifyEnrouteAdvisoryTimeRelevance(
  validUntil: Date | null,
  departureUtc: Date,
  options?: ClassifyEnrouteTimeOptions
): "active" | "near_term" | "expired" | "unknown" {
  if (validUntil == null) return "unknown";
  const nowMs = (options?.nowUtc ?? new Date()).getTime();
  const depMs = departureUtc.getTime();
  const vu = validUntil.getTime();
  if (vu < nowMs) return "expired";
  if (vu < depMs) return "expired";
  if (vu <= depMs + POST_DEP_NEAR_TERM_MS) return "near_term";
  return "active";
}

export type FilterEnrouteAdvisoriesByTimeResult = {
  advisories: EnrouteAdvisory[];
  /** True when the merged feed had items but none passed time rules. */
  allFilteredByTime: boolean;
};

/**
 * Drops advisories not current for this leg or already ended; sets {@link EnrouteAdvisory.timeRelevance} on kept items.
 */
export function filterEnrouteAdvisoriesForFlightWindow(
  advisories: EnrouteAdvisory[],
  departureUtc: Date,
  options?: ClassifyEnrouteTimeOptions
): FilterEnrouteAdvisoriesByTimeResult {
  const hadSource = advisories.length > 0;
  const out: EnrouteAdvisory[] = [];

  for (const a of advisories) {
    const raw = (a.rawText ?? a.description ?? "").trim();
    const validUntil = raw ? parseValidUntilUtcFromRaw(raw, departureUtc) : null;
    const bucket = classifyEnrouteAdvisoryTimeRelevance(validUntil, departureUtc, options);

    if (bucket === "expired") continue;

    const timeRelevance: EnrouteAdvisoryTimeRelevance =
      bucket === "unknown" ? "active" : bucket === "near_term" ? "near_term" : "active";

    out.push({ ...a, timeRelevance });
  }

  return {
    advisories: out,
    allFilteredByTime: hadSource && out.length === 0,
  };
}
