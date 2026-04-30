"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import type {
  OperationalNotamItem,
  OperationalNotamsBriefResult,
  OperationalNotamCategory,
  OperationalNotamSeverity,
  OperationalNotamValidity,
} from "@/lib/weather-brief/notams/types";
import { formatOutOfServiceForWeatherBriefDisplay } from "@/lib/weather-brief/format-out-of-service-for-weather-brief-display";
import { getDisplayNotamCategory } from "@/lib/weather-brief/get-display-notam-category";
import { CollapsibleWeatherBriefSection } from "@/components/weather-brief/CollapsibleWeatherBriefSection";

type Props = {
  result: OperationalNotamsBriefResult;
  proActive?: boolean;
};

const DEFAULT_VISIBLE_PER_AIRPORT = 3;

/** Higher = show first when prioritizing collapsed view */
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

/**
 * Stable sort by decode severity when present (critical→info); otherwise preserve arrival order among peers.
 */
function prioritizedFirstN(items: OperationalNotamItem[], n: number): OperationalNotamItem[] {
  if (items.length <= n || n <= 0) return [...items];

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

  return indexed.slice(0, n).map((x) => x.it);
}

function showsToggle(depCount: number, arrCount: number): boolean {
  return depCount > DEFAULT_VISIBLE_PER_AIRPORT || arrCount > DEFAULT_VISIBLE_PER_AIRPORT;
}

function meaningfulNotamField(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  if (t === "—") return false;
  return true;
}

/** Relative age from ISO timestamp for NOTAM AVWX freshness display. */
function formatNotamDataAge(iso?: string): string | null {
  if (typeof iso !== "string") return null;
  const t = iso.trim();
  if (!t) return null;
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) return null;
  const sec = Math.round((Date.now() - ms) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? "1 min ago" : `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return hr === 1 ? "1 hr ago" : `${hr} hrs ago`;
  const days = Math.floor(hr / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function operationalNotamsFreshnessSubtitle(result: OperationalNotamsBriefResult): string | null {
  const depAt = result.departure.fetchedAt;
  const arrAt = result.arrival.fetchedAt;
  const depAge = formatNotamDataAge(depAt);
  const arrAge = formatNotamDataAge(arrAt);
  const depIcao = result.departure.stationIcao;
  const arrIcao = result.arrival.stationIcao;
  const sameStation = depIcao.trim().toUpperCase() === arrIcao.trim().toUpperCase();
  const sameTimestamp =
    typeof depAt === "string" &&
    typeof arrAt === "string" &&
    depAt.trim() !== "" &&
    depAt.trim() === arrAt.trim();

  if (!depAge && !arrAge) return null;
  if (depAge && !arrAge) return `Departure updated ${depAge}`;
  if (!depAge && arrAge) return `Arrival updated ${arrAge}`;

  if (depAge && arrAge) {
    if (sameStation || sameTimestamp || depAge === arrAge) {
      return `NOTAMs updated ${depAge}`;
    }
    return `Departure updated ${depAge} · Arrival updated ${arrAge}`;
  }

  return null;
}

const AI_CATEGORY_LABEL: Record<OperationalNotamCategory, string> = {
  runway: "Runway",
  ils: "ILS",
  navaid: "Navaid",
  taxiway: "Taxiway",
  airport: "Airport",
  airspace: "Airspace",
  other: "Other",
};

type CategoryFilterSelection = OperationalNotamCategory | "all";

const CATEGORY_FILTERS: { id: CategoryFilterSelection; label: string }[] = [
  { id: "all", label: "All" },
  { id: "runway", label: AI_CATEGORY_LABEL.runway },
  { id: "ils", label: AI_CATEGORY_LABEL.ils },
  { id: "navaid", label: AI_CATEGORY_LABEL.navaid },
  { id: "taxiway", label: AI_CATEGORY_LABEL.taxiway },
  { id: "airport", label: AI_CATEGORY_LABEL.airport },
  { id: "airspace", label: AI_CATEGORY_LABEL.airspace },
  { id: "other", label: AI_CATEGORY_LABEL.other },
];

function countNotamsAcrossStations(dep: OperationalNotamItem[], arr: OperationalNotamItem[]): {
  total: number;
  byCategory: Record<OperationalNotamCategory, number>;
} {
  const byCategory: Record<OperationalNotamCategory, number> = {
    runway: 0,
    ils: 0,
    navaid: 0,
    taxiway: 0,
    airport: 0,
    airspace: 0,
    other: 0,
  };
  for (const it of [...dep, ...arr]) {
    const c = getDisplayNotamCategory(it);
    byCategory[c] += 1;
  }
  return { total: dep.length + arr.length, byCategory };
}

function filterItemsByCategory(
  items: OperationalNotamItem[],
  selection: CategoryFilterSelection
): OperationalNotamItem[] {
  if (selection === "all") return items;
  return items.filter((it) => getDisplayNotamCategory(it) === selection);
}

function formatAiCategoryRow(cat: OperationalNotamCategory): string {
  return AI_CATEGORY_LABEL[cat] ?? cat;
}

function formatSeverityLabel(sev: OperationalNotamSeverity): string {
  return sev.charAt(0).toUpperCase() + sev.slice(1).toLowerCase();
}

function severityRowClass(sev: OperationalNotamSeverity): string {
  switch (sev) {
    case "critical":
      return "font-medium text-red-400";
    case "warning":
      return "font-medium text-amber-400";
    case "caution":
      return "font-medium text-amber-300/95";
    case "info":
      return "text-sky-300/90";
    default:
      return "text-slate-400";
  }
}

const MONTH_ABBREV_UTC = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function pad2Utc(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * Formats parseable `validity.*.iso` (AVWX `*.dt`) as Zulu-only text, e.g. `18 Dec 2025 1433Z`.
 * Uses UTC components only — no browser-local or Intl timezone.
 */
function formatNotamValidityDate(value?: string): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  const day = d.getUTCDate();
  const mon = MONTH_ABBREV_UTC[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hhmm = `${pad2Utc(d.getUTCHours())}${pad2Utc(d.getUTCMinutes())}`;
  return `${day} ${mon} ${year} ${hhmm}Z`;
}

function effectiveValidityDisplay(validity?: OperationalNotamValidity): string | null {
  const e = validity?.effective;
  if (!e) return null;
  const fromIso = formatNotamValidityDate(e.iso);
  if (fromIso) return fromIso;
  const repr = typeof e.repr === "string" && e.repr.trim() ? e.repr.trim() : null;
  return repr;
}

function expiresValidityDisplay(validity?: OperationalNotamValidity): string | null {
  const exp = validity?.expires;
  if (!exp) return null;
  if (exp.permanent === true) return "Permanent (No expiration)";
  const fromIso = formatNotamValidityDate(exp.iso);
  if (fromIso) return fromIso;
  const repr = typeof exp.repr === "string" && exp.repr.trim() ? exp.repr.trim() : null;
  if (repr) return repr;
  const raw = typeof exp.value === "string" && exp.value.trim() ? exp.value.trim() : null;
  return raw;
}

function NotamValidityMetadataRows({ validity }: { validity?: OperationalNotamValidity }) {
  const effective = effectiveValidityDisplay(validity);
  const expires = expiresValidityDisplay(validity);
  if (!effective && !expires) return null;
  return (
    <>
      {effective ? (
        <p>
          <span className="text-slate-500">Effective: </span>
          <span className="text-slate-200">{effective}</span>
        </p>
      ) : null}
      {expires ? (
        <p>
          <span className="text-slate-500">Expires: </span>
          <span className="text-slate-200">{expires}</span>
        </p>
      ) : null}
    </>
  );
}

/**
 * Drops a trailing soft explanatory sentence (common model hedging after the factual clause).
 */
function stripSoftNotamHeadlineTail(plainEnglish: string): string {
  const t = plainEnglish.trim();
  const trailingSoft =
    /\.\s+(?:This may affect|This could affect|This might impact|This affects|This will affect|This can affect|This impacts|which may impact|which could affect|Pilots should|Pilots must|Crews should|Crews must|Be aware|Expect|Use caution)\b[\s\S]*$/i;
  return t.replace(trailingSoft, ".").trim();
}

/** Display headline base for CrewRules™ Summary — must stay in sync with duplicate detection below. */
function crewRulesSummaryHeadlineBase(it: OperationalNotamItem): string | null {
  const d = it.decoded;
  if (!d || d.decodeStatus !== "ok") return null;
  return formatOutOfServiceForWeatherBriefDisplay(stripSoftNotamHeadlineTail(d.plainEnglish)).trim() || null;
}

function normalizedHeadlineDedupKey(headlineBase: string): string {
  return headlineBase.trim().toLowerCase();
}

/** Keys that appear two+ times among showed cards (same summary after trim + lowercase). */
function computeDuplicateSummaryKeys(items: OperationalNotamItem[]): Set<string> {
  const counts = new Map<string, number>();
  for (const it of items) {
    const base = crewRulesSummaryHeadlineBase(it);
    if (!base) continue;
    const k = normalizedHeadlineDedupKey(base);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const dups = new Set<string>();
  for (const [k, n] of counts) {
    if (n > 1) dups.add(k);
  }
  return dups;
}

/** `${summaryDedupKey}|${category}` when that pair appears 2+ among visible decoded items — need date qualifier. */
function compositeSummaryCategoryDedupKey(
  summaryDedupKey: string,
  category: OperationalNotamCategory
): string {
  return `${summaryDedupKey}|${category}`;
}

function computeDuplicateSummarySameCategoryKeys(items: OperationalNotamItem[]): Set<string> {
  const perSummaryCounts = new Map<string, number>();
  for (const it of items) {
    const base = crewRulesSummaryHeadlineBase(it);
    if (!base) continue;
    const sk = normalizedHeadlineDedupKey(base);
    perSummaryCounts.set(sk, (perSummaryCounts.get(sk) ?? 0) + 1);
  }

  const pairCounts = new Map<string, number>();
  for (const it of items) {
    const base = crewRulesSummaryHeadlineBase(it);
    if (!base) continue;
    const sk = normalizedHeadlineDedupKey(base);
    if ((perSummaryCounts.get(sk) ?? 0) < 2) continue;
    const cat = getDisplayNotamCategory(it);
    const ck = compositeSummaryCategoryDedupKey(sk, cat);
    pairCounts.set(ck, (pairCounts.get(ck) ?? 0) + 1);
  }

  const needDate = new Set<string>();
  for (const [ck, n] of pairCounts) {
    if (n > 1) needDate.add(ck);
  }
  return needDate;
}

/** Expiration string for summary qualifier; falls back to effective when expiration missing. */
function summaryQualifierValidityLabel(validity?: OperationalNotamValidity): {
  prefix: "Expires" | "Effective";
  value: string;
} | null {
  const exp = expiresValidityDisplay(validity);
  if (exp) return { prefix: "Expires", value: exp };
  const eff = effectiveValidityDisplay(validity);
  if (eff) return { prefix: "Effective", value: eff };
  return null;
}

function NotamListItem({
  it,
  proActive,
  duplicateSummaryKeys,
  duplicateSummarySameCategoryKeys,
}: {
  it: OperationalNotamItem;
  proActive?: boolean;
  duplicateSummaryKeys: Set<string>;
  duplicateSummarySameCategoryKeys: Set<string>;
}) {
  const [officialOpen, setOfficialOpen] = useState(false);
  const [impactOpen, setImpactOpen] = useState(false);
  const decoded = it.decoded;
  const d = decoded && decoded.decodeStatus === "ok" ? decoded : null;
  const ok = d != null;
  const err = decoded?.decodeStatus === "error";

  const impactText = d ? formatOutOfServiceForWeatherBriefDisplay(d.operationalImpact) : "";
  const actionText = d ? formatOutOfServiceForWeatherBriefDisplay(d.pilotAction) : "";
  const hasImpact = !!d && meaningfulNotamField(impactText);
  const hasAction = !!d && meaningfulNotamField(actionText);

  const headline = d ? formatOutOfServiceForWeatherBriefDisplay(stripSoftNotamHeadlineTail(d.plainEnglish)) : "";
  const headlineBaseTrimmed = headline.trim();
  const summaryDedupKey = headlineBaseTrimmed ? normalizedHeadlineDedupKey(headlineBaseTrimmed) : "";
  const showCategoryQualifier =
    headlineBaseTrimmed.length > 0 && duplicateSummaryKeys.has(summaryDedupKey);
  const displayCategory = getDisplayNotamCategory(it);
  const categoryLabelForQualifier = formatAiCategoryRow(displayCategory);

  let qualifierInner = categoryLabelForQualifier;
  if (
    showCategoryQualifier &&
    duplicateSummarySameCategoryKeys.has(compositeSummaryCategoryDedupKey(summaryDedupKey, displayCategory))
  ) {
    const dateQ = summaryQualifierValidityLabel(it.validity);
    if (dateQ) {
      qualifierInner = `${categoryLabelForQualifier} · ${dateQ.prefix} ${dateQ.value}`;
    }
  }

  const headlineDisplay = showCategoryQualifier ? `${headlineBaseTrimmed} (${qualifierInner})` : headline;

  const officialCollapsibleInner = (
    <div className="pt-1">
      <button
        type="button"
        aria-expanded={officialOpen}
        onClick={() => setOfficialOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs font-medium text-slate-200 transition hover:bg-white/[0.07] focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-500/40"
      >
        <span>Official NOTAM</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${officialOpen ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {officialOpen ? (
        proActive === true ? (
          <div className="mt-2 rounded-lg border border-white/5 bg-slate-950/50 px-3 py-2">
            <p className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed tracking-wide text-slate-500">
              {formatOutOfServiceForWeatherBriefDisplay(it.rawText)}
            </p>
          </div>
        ) : (
          <div className="mt-2 rounded-lg border border-amber-500/25 bg-amber-950/15 px-3 py-3">
            <p className="text-xs leading-relaxed text-amber-400">
              🔒 Official NOTAM text is available with CrewRules™ Pro.
            </p>
            <Link
              href="/frontier/pilots/portal/settings/subscription"
              className="mt-2 inline-block text-xs font-medium text-amber-300 underline-offset-2 transition hover:text-amber-200 hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-500/40 rounded-sm"
            >
              View Pro trial
            </Link>
          </div>
        )
      ) : null}
    </div>
  );

  return (
    <li className="rounded-lg border border-white/5 bg-slate-950/40 p-3 text-sm leading-relaxed text-slate-200">
      {ok && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider">
            <span className="text-white">CREW</span>
            <span className="text-[#75C043]">RULES</span>
            <span className="text-white">™</span>
            <span className="text-[#75C043]"> SUMMARY</span>
          </p>
          <p className="text-sm font-normal leading-snug text-white">{headlineDisplay}</p>
          <div className="space-y-1 text-xs">
            <p>
              <span className="text-slate-500">Category: </span>
              <span className="text-slate-200">{formatAiCategoryRow(getDisplayNotamCategory(it))}</span>
            </p>
            <p>
              <span className="text-slate-500">Severity: </span>
              <span className={severityRowClass(d.severity)}>{formatSeverityLabel(d.severity)}</span>
            </p>
            <NotamValidityMetadataRows validity={it.validity} />
          </div>

          <div className="mt-3 border-t border-white/10 pt-3">{officialCollapsibleInner}</div>

          {(hasImpact || hasAction) && (
            <div className="pt-1">
              <button
                type="button"
                aria-expanded={impactOpen}
                onClick={() => setImpactOpen((v) => !v)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs font-medium text-slate-200 transition hover:bg-white/[0.07] focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                <span>Impact &amp; Action</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${impactOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
              {impactOpen ? (
                proActive === true ? (
                  <div className="mt-2 space-y-2 rounded-lg border border-white/5 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
                    {hasImpact ? (
                      <p>
                        <span className="font-medium text-slate-400">Impact: </span>
                        {impactText}
                      </p>
                    ) : null}
                    {hasAction ? (
                      <p>
                        <span className="font-medium text-slate-400">Action: </span>
                        {actionText}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2 rounded-lg border border-amber-500/25 bg-amber-950/15 px-3 py-3">
                    <p className="text-xs leading-relaxed text-amber-400">
                      🔒 Impact and action guidance is available with CrewRules™ Pro.
                    </p>
                    <Link
                      href="/frontier/pilots/portal/settings/subscription"
                      className="mt-2 inline-block text-xs font-medium text-amber-300 underline-offset-2 transition hover:text-amber-200 hover:underline focus-visible:outline focus-visible:ring-2 focus-visible:ring-amber-500/40 rounded-sm"
                    >
                      View Pro trial
                    </Link>
                  </div>
                )
              ) : null}
            </div>
          )}
        </div>
      )}

      {!ok && err ? <p className="text-xs text-amber-400/90">Plain-language summary unavailable.</p> : null}

      {!ok ? (
        <div
          className={
            err ? "mt-3 space-y-3 border-t border-white/10 pt-3" : "space-y-3"
          }
        >
          <NotamValidityMetadataRows validity={it.validity} />
          {officialCollapsibleInner}
        </div>
      ) : null}
    </li>
  );
}

export function OperationalNotamsCard({ result, proActive }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterSelection>("all");
  const { availability, reason, departure, arrival } = result;
  const hasAnyItems = departure.items.length > 0 || arrival.items.length > 0;

  const { total: allStationsTotal, byCategory: countsByCat } = useMemo(
    () => countNotamsAcrossStations(departure.items, arrival.items),
    [departure.items, arrival.items]
  );

  const { depItemsDisplay, arrItemsDisplay, depFiltered, arrFiltered } = useMemo(() => {
    const depF = filterItemsByCategory(departure.items, categoryFilter);
    const arrF = filterItemsByCategory(arrival.items, categoryFilter);

    if (showAll) {
      return {
        depItemsDisplay: depF,
        arrItemsDisplay: arrF,
        depFiltered: depF,
        arrFiltered: arrF,
      };
    }
    return {
      depItemsDisplay: prioritizedFirstN(depF, DEFAULT_VISIBLE_PER_AIRPORT),
      arrItemsDisplay: prioritizedFirstN(arrF, DEFAULT_VISIBLE_PER_AIRPORT),
      depFiltered: depF,
      arrFiltered: arrF,
    };
  }, [departure.items, arrival.items, showAll, categoryFilter]);

  const notamFreshnessSubtitle = useMemo(() => operationalNotamsFreshnessSubtitle(result), [result]);

  const duplicateSummaryKeys = useMemo(
    () => computeDuplicateSummaryKeys([...depItemsDisplay, ...arrItemsDisplay]),
    [depItemsDisplay, arrItemsDisplay]
  );

  const duplicateSummarySameCategoryKeys = useMemo(
    () => computeDuplicateSummarySameCategoryKeys([...depItemsDisplay, ...arrItemsDisplay]),
    [depItemsDisplay, arrItemsDisplay]
  );

  const toggleVisible =
    availability === "ok" && hasAnyItems && showsToggle(depFiltered.length, arrFiltered.length);

  if (availability === "unavailable" && reason === "not_configured") {
    return (
      <CollapsibleWeatherBriefSection title="Operational NOTAMs" defaultOpen={false}>
        <div className="space-y-2">
          <p className="text-slate-300">Operational NOTAM data source is not configured yet.</p>
          <p className="text-sm text-slate-400">
            Weather Brief continues using available weather, route, and advisory sources.
          </p>
        </div>
      </CollapsibleWeatherBriefSection>
    );
  }

  if (availability === "ok" && !hasAnyItems) {
    return (
      <CollapsibleWeatherBriefSection title="Operational NOTAMs" defaultOpen={false}>
        <p className="text-slate-300">No operationally flagged NOTAMs for this flight.</p>
      </CollapsibleWeatherBriefSection>
    );
  }

  if (hasAnyItems) {
    return (
      <CollapsibleWeatherBriefSection
        title="Operational NOTAMs"
        subtitle={notamFreshnessSubtitle ?? undefined}
        defaultOpen={false}
      >
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter NOTAMs by category">
            {CATEGORY_FILTERS.map(({ id, label }) => {
              const count =
                id === "all" ? allStationsTotal : countsByCat[id as OperationalNotamCategory];
              const selected = categoryFilter === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setCategoryFilter(id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                    selected
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-100"
                      : "border-white/15 bg-slate-900/40 text-slate-300 hover:border-white/25 hover:bg-slate-800/50"
                  }`}
                >
                  <span>{label}</span>
                  <span className={`tabular-nums ${selected ? "text-emerald-200/85" : "text-slate-500"}`}>
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <NotamStationBlock
              label="Departure"
              stationIcao={departure.stationIcao}
              items={depItemsDisplay}
              emptyStationFromApi={departure.items.length === 0}
              filterExcludedAllForStation={departure.items.length > 0 && depFiltered.length === 0}
              proActive={proActive}
              duplicateSummaryKeys={duplicateSummaryKeys}
              duplicateSummarySameCategoryKeys={duplicateSummarySameCategoryKeys}
            />
            <NotamStationBlock
              label="Arrival"
              stationIcao={arrival.stationIcao}
              items={arrItemsDisplay}
              emptyStationFromApi={arrival.items.length === 0}
              filterExcludedAllForStation={arrival.items.length > 0 && arrFiltered.length === 0}
              proActive={proActive}
              duplicateSummaryKeys={duplicateSummaryKeys}
              duplicateSummarySameCategoryKeys={duplicateSummarySameCategoryKeys}
            />
          </div>

          {toggleVisible && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                aria-expanded={showAll}
                onClick={() => setShowAll((v) => !v)}
                className="inline-flex items-center rounded-md border border-white/15 bg-slate-900/50 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500/50"
              >
                {showAll ? "Show fewer NOTAMs" : "View all NOTAMs"}
              </button>
            </div>
          )}
        </div>
      </CollapsibleWeatherBriefSection>
    );
  }

  const fallback =
    reason === "timeout"
      ? "Operational NOTAM lookup timed out. Try refreshing this page shortly."
      : reason === "network"
        ? "Operational NOTAM lookup failed due to a network issue."
        : "Operational NOTAM data is temporarily unavailable.";

  return (
    <CollapsibleWeatherBriefSection title="Operational NOTAMs" defaultOpen={false}>
      <p className="text-slate-300">{fallback}</p>
    </CollapsibleWeatherBriefSection>
  );
}

function NotamStationBlock({
  label,
  stationIcao,
  items,
  emptyStationFromApi,
  filterExcludedAllForStation,
  proActive,
  duplicateSummaryKeys,
  duplicateSummarySameCategoryKeys,
}: {
  label: string;
  stationIcao: string;
  items: OperationalNotamItem[];
  emptyStationFromApi: boolean;
  filterExcludedAllForStation: boolean;
  proActive?: boolean;
  duplicateSummaryKeys: Set<string>;
  duplicateSummarySameCategoryKeys: Set<string>;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
        {label} ({stationIcao})
      </p>
      {emptyStationFromApi ? (
        <p className="mt-2 text-sm text-slate-500">—</p>
      ) : filterExcludedAllForStation ? (
        <p className="mt-2 text-sm text-slate-500/90">No matching NOTAMs</p>
      ) : (
        <ul className="mt-3 list-none space-y-3 p-0">
          {items.map((it) => (
            <NotamListItem
              key={it.id}
              it={it}
              proActive={proActive}
              duplicateSummaryKeys={duplicateSummaryKeys}
              duplicateSummarySameCategoryKeys={duplicateSummarySameCategoryKeys}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
