import type { OperationalNotamItem, OperationalNotamsBriefResult } from "@/lib/weather-brief/notams/types";
import { formatOutOfServiceForWeatherBriefDisplay } from "@/lib/weather-brief/format-out-of-service-for-weather-brief-display";

/** Same severity ordering as OperationalNotamsCard (critical→info). */
const SEVERITY_ORDER: Record<"critical" | "warning" | "caution" | "info", number> = {
  critical: 4,
  warning: 3,
  caution: 2,
  info: 1,
};

function severityRank(it: OperationalNotamItem): number | null {
  if (it.decoded?.decodeStatus === "ok") {
    return SEVERITY_ORDER[it.decoded.severity] ?? 0;
  }
  return null;
}

/** First item after severity sort; ties preserve stable original order. */
function pickPrioritizedFirst(items: OperationalNotamItem[]): OperationalNotamItem | undefined {
  if (items.length === 0) return undefined;
  const indexed = items.map((it, idx) => ({ it, idx }));
  indexed.sort((a, b) => {
    const ra = severityRank(a.it);
    const rb = severityRank(b.it);
    const aRanked = ra != null ? 1 : 0;
    const bRanked = rb != null ? 1 : 0;
    if (aRanked !== bRanked) return bRanked - aRanked;
    if (ra != null && rb != null && ra !== rb) return rb - ra;
    return a.idx - b.idx;
  });
  return indexed[0]?.it;
}

/**
 * Drops a trailing soft explanatory sentence (matches OperationalNotamsCard headline handling).
 */
function stripSoftNotamHeadlineTail(plainEnglish: string): string {
  const t = plainEnglish.trim();
  const trailingSoft =
    /\.\s+(?:This may affect|This could affect|This might impact|This affects|This will affect|This can affect|This impacts|which may impact|which could affect|Pilots should|Pilots must|Crews should|Crews must|Be aware|Expect|Use caution)\b[\s\S]*$/i;
  return t.replace(trailingSoft, ".").trim();
}

/** Decode pipeline uses em dash when a field was empty — not pilot-facing copy. */
function isPlaceholderDecodeText(s: string): boolean {
  const t = s.trim();
  return !t || t === "—" || t === "-";
}

/**
 * Pilot Summary must not show raw NOTAM encodings. Detect model echo / telegraphic paste
 * (FNS punctuation, CLSD/TWY-style tokens, jammed abbreviations) and fall back.
 */
function looksLikeEncodedNotamSummary(s: string): boolean {
  const t = s.trim();
  if (t.length < 20) return false;
  if (/[|][\s\S]*\?|[<>]\s*[0-9]|>0\?/.test(t)) return true;
  if (/\bTWY\b|\bTXL\b|\bCLSD\b|\bBTN\b|\bRSTR\b|CLSD[A-Z]{2,}|[A-Z]{4,}>\d/.test(t)) return true;
  return false;
}

function notamSummaryBaseFromItem(item: OperationalNotamItem): string {
  const d = item.decoded;
  if (d?.decodeStatus !== "ok") return "";

  const pe = (d.plainEnglish ?? "").trim();
  if (pe && !isPlaceholderDecodeText(pe)) {
    const headline = stripSoftNotamHeadlineTail(pe).trim();
    if (headline && !looksLikeEncodedNotamSummary(headline)) return headline;
  }

  const oi = (d.operationalImpact ?? "").trim();
  if (oi && !isPlaceholderDecodeText(oi) && !looksLikeEncodedNotamSummary(oi)) return oi;

  return "";
}

function genericNotamSummaryPhrase(result: OperationalNotamsBriefResult): string {
  const dep = result.departure.stationIcao.trim().toUpperCase();
  const arr = result.arrival.stationIcao.trim().toUpperCase();
  const where = dep === arr ? dep : `${dep} and ${arr}`;
  return `Operational NOTAMs may affect ${where}`;
}

export function buildNotamSummaryLine(result: OperationalNotamsBriefResult): string | undefined {
  if (!result || result.availability !== "ok") {
    return undefined;
  }

  const items = [...result.departure.items, ...result.arrival.items];
  if (!items.length) {
    return undefined;
  }

  const item = pickPrioritizedFirst(items);
  if (!item) {
    return undefined;
  }

  let base = notamSummaryBaseFromItem(item);
  if (!base) {
    base = genericNotamSummaryPhrase(result);
  }

  const trimmedRaw = base.length > 80 ? base.slice(0, 77).trim() + "…" : base;
  const trimmed = formatOutOfServiceForWeatherBriefDisplay(trimmedRaw);

  return `⚠️ ${trimmed} — View NOTAMs`;
}
