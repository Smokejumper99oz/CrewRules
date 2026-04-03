/**
 * Classify thunderstorm-related signals from a single TAF forecast period only
 * (raw line + wxString). Avoids scanning the full TAF bulletin — substring checks
 * on the whole bulletin produced false positives (e.g. "MISTS", "VCTS" as TS).
 *
 * Client-safe (no I/O).
 */

export type TafThunderstormClass = "warning" | "vicinity";

/** Direct TS / CB tokens (word-boundary) — operational concern. */
const DIRECT_TS_OR_CB =
  /\b(\+|-)?TSRA\b|\b(\+|-)?TSSN\b|\b(\+|-)?TSGR\b|\b(\+|-)?TSPL\b|\b(\+|-)?TSDZ\b|\bTS\b|\bCB\b/i;

/** Vicinity convection — noteworthy but not the same as airport TS. */
const VICINITY_TS = /\bVCTS\b|\bVCB\b/i;

/**
 * @returns "warning" | "vicinity" | null — uses only the selected period text.
 */
export function thunderstormClassFromTafPeriod(
  rawLine: string | null | undefined,
  wxString: string | null | undefined
): TafThunderstormClass | null {
  const text = [wxString, rawLine].filter(Boolean).join(" ");
  if (!text.trim()) return null;
  if (DIRECT_TS_OR_CB.test(text)) return "warning";
  if (VICINITY_TS.test(text)) return "vicinity";
  return null;
}
