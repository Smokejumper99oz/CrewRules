/**
 * Short, display-safe summary for enroute SIGMET/AIRMET cards (not full bulletin text).
 */

const DEFAULT_MAX = 180;
const SEP = " — ";

export function buildEnrouteAdvisoryPilotSummary(
  title: string,
  description: string,
  maxLen = DEFAULT_MAX
): string {
  const t = (title ?? "").trim() || "Advisory";
  const d = (description ?? "").trim();

  if (!d) {
    return t.length <= maxLen ? t : `${t.slice(0, Math.max(1, maxLen - 1))}…`;
  }

  const combined = `${t}${SEP}${d}`;
  if (combined.length <= maxLen) return combined;

  if (t.length + SEP.length >= maxLen) {
    return t.length <= maxLen ? t : `${t.slice(0, Math.max(1, maxLen - 1))}…`;
  }

  const descBudget = maxLen - t.length - SEP.length;
  const cap = Math.max(1, descBudget - 1);
  const dShort = d.length > descBudget ? `${d.slice(0, cap)}…` : d;
  const out = `${t}${SEP}${dShort}`;
  return out.length <= maxLen ? out : `${out.slice(0, Math.max(1, maxLen - 1))}…`;
}
