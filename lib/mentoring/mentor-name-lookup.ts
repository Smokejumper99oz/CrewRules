import type { MentorPreloadRow } from "@/lib/mentoring/get-mentor-preload-rows-for-tenant";

export type MentorNameLookupProfileRow = {
  employee_number: string;
  full_name: string;
};

export type MentorNameLookupMergedRow = {
  employeeNumber: string;
  fullName: string;
};

export type MentorNameLookupOutputRow = {
  enteredName: string;
  matchedName: string | null;
  /** Canonical employee id string, or the literal `unknown` when unresolved. */
  employeeNumber: string;
  status: string;
};

const UNKNOWN = "unknown";

/**
 * Normalize for lookup keys: strip inline quoted nickname segments, then trim, collapse spaces, lowercase.
 * - Double-quoted runs: `"Rick"` … removed entirely.
 * - Single-quoted runs only when delimited by start/whitespace before and whitespace/end after (avoids O'Brien).
 */
export function normalizeMentorLookupName(raw: string): string {
  let s = String(raw).trim();
  s = s.replace(/"[^"]*"/g, "");
  s = s.replace(/(?<=\s|^)'[^']+'(?=\s|$)/g, "");
  return s.replace(/\s+/g, " ").toLowerCase();
}

/**
 * Merge mentor_preload + profiles for name lookup.
 * Dedupes by trimmed `employee_number`. When the same employee number exists in both sources,
 * the profiles row wins and the preload row is dropped.
 */
export function mergeMentorPreloadAndProfilesForNameLookup(
  preloadRows: MentorPreloadRow[],
  profileRows: MentorNameLookupProfileRow[],
): MentorNameLookupMergedRow[] {
  const byEmp = new Map<string, MentorNameLookupMergedRow>();

  for (const row of preloadRows) {
    const emp = String(row.employee_number ?? "").trim();
    const name = String(row.full_name ?? "").trim();
    if (!emp || !name) continue;
    byEmp.set(emp, { employeeNumber: emp, fullName: name });
  }

  for (const row of profileRows) {
    const emp = String(row.employee_number ?? "").trim();
    const name = String(row.full_name ?? "").trim();
    if (!emp || !name) continue;
    byEmp.set(emp, { employeeNumber: emp, fullName: name });
  }

  return [...byEmp.values()];
}

function buildNormalizedNameIndex(
  merged: MentorNameLookupMergedRow[],
): Map<string, Map<string, string>> {
  const index = new Map<string, Map<string, string>>();
  for (const row of merged) {
    const key = normalizeMentorLookupName(row.fullName);
    if (!key) continue;
    let empMap = index.get(key);
    if (!empMap) {
      empMap = new Map();
      index.set(key, empMap);
    }
    empMap.set(row.employeeNumber, row.fullName);
  }
  return index;
}

type BaseStatus = "Matched" | "Review" | "Unknown";

/** Minimum normalized query length before edit-distance suggestion runs (avoids noisy short strings). */
const SUGGEST_MIN_NORMALIZED_QUERY_LEN = 4;

/**
 * Levenshtein distance; deterministic, full Unicode code units (same as exact-match normalization).
 * Two-row DP — fine for short names × ~2k roster rows per pasted line.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array<number>(n + 1);
  let cur = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) {
    prev[j] = j;
  }
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = cur;
    cur = swap;
  }
  return prev[n];
}

/**
 * Conservative: allow at most one edit for short-ish names, at most two only when both strings are longer.
 * d ≤ 0: never suggest (exact match should have hit; avoids odd edge cases).
 */
function suggestionEditDistanceAllowed(distance: number, maxLen: number): boolean {
  if (distance <= 0) return false;
  if (distance === 1) return maxLen >= 3;
  if (distance === 2) return maxLen >= 10;
  return false;
}

/**
 * Single best roster name by lowest Levenshtein distance. Returns null if tie for best distance
 * or if the best distance fails the conservative threshold.
 */
function findConservativeEditDistanceSuggestion(
  normalizedQuery: string,
  merged: MentorNameLookupMergedRow[],
): { fullName: string; employeeNumber: string } | null {
  if (normalizedQuery.length < SUGGEST_MIN_NORMALIZED_QUERY_LEN) {
    return null;
  }

  type Scored = {
    distance: number;
    employeeNumber: string;
    fullName: string;
    norm: string;
  };

  const scored: Scored[] = [];
  for (const row of merged) {
    const norm = normalizeMentorLookupName(row.fullName);
    if (!norm) continue;
    scored.push({
      distance: levenshteinDistance(normalizedQuery, norm),
      employeeNumber: row.employeeNumber,
      fullName: row.fullName,
      norm,
    });
  }

  if (scored.length === 0) {
    return null;
  }

  let minDistance = Infinity;
  for (const s of scored) {
    if (s.distance < minDistance) minDistance = s.distance;
  }

  const tiedForBest = scored.filter((s) => s.distance === minDistance);
  if (tiedForBest.length !== 1) {
    return null;
  }

  const sole = tiedForBest[0];
  const maxLen = Math.max(normalizedQuery.length, sole.norm.length);
  if (!suggestionEditDistanceAllowed(sole.distance, maxLen)) {
    return null;
  }

  return { fullName: sole.fullName, employeeNumber: sole.employeeNumber };
}

function baseLookupForNormalizedName(
  index: Map<string, Map<string, string>>,
  normalizedQuery: string,
): { status: BaseStatus; matchedName: string | null; employeeNumber: string } {
  if (!normalizedQuery) {
    return { status: "Unknown", matchedName: null, employeeNumber: UNKNOWN };
  }

  const empMap = index.get(normalizedQuery);
  if (!empMap || empMap.size === 0) {
    return { status: "Unknown", matchedName: null, employeeNumber: UNKNOWN };
  }

  const entries = [...empMap.entries()];
  if (entries.length === 1) {
    const [emp, displayName] = entries[0];
    return { status: "Matched", matchedName: displayName, employeeNumber: emp };
  }

  return { status: "Review", matchedName: null, employeeNumber: UNKNOWN };
}

/**
 * Approved first-name variant groups (normalized lower-case tokens). Any member expands to the full set
 * for index lookup; remainder of the entered name must match exactly. Bidirectional within each group.
 */
const MENTOR_FIRST_NAME_VARIANT_GROUPS: readonly (readonly string[])[] = [
  ["chris", "christopher"],
  ["rich", "richard", "rick", "ricardo"],
  ["tim", "timothy"],
  ["mike", "michael"],
] as const;

function firstNameVariantGroupForToken(token: string): readonly string[] | null {
  for (const group of MENTOR_FIRST_NAME_VARIANT_GROUPS) {
    if (group.includes(token)) {
      return group;
    }
  }
  return null;
}

/**
 * After exact match fails: replace first token with each approved variant in the same group, require an
 * exact normalized remainder, then `index.get(candidateKey)` like exact lookup.
 * Exactly one unique employee across all variant candidates → DB display name + number (caller: Possible match).
 * Ambiguous inner map, zero hits, or multiple distinct employees → null.
 */
function tryNicknameVariantLookup(
  normalizedEntered: string,
  index: Map<string, Map<string, string>>,
): { fullName: string; employeeNumber: string } | null {
  if (!normalizedEntered) {
    return null;
  }

  const spaceIdx = normalizedEntered.indexOf(" ");
  const firstToken = spaceIdx === -1 ? normalizedEntered : normalizedEntered.slice(0, spaceIdx);
  const remainder = spaceIdx === -1 ? "" : normalizedEntered.slice(spaceIdx + 1);

  if (!firstToken) {
    return null;
  }

  const variantGroup = firstNameVariantGroupForToken(firstToken);
  if (!variantGroup?.length) {
    return null;
  }

  const hits: { employeeNumber: string; fullName: string }[] = [];

  for (const variant of variantGroup) {
    const candidateKey = remainder ? `${variant} ${remainder}` : variant;
    const empMap = index.get(candidateKey);
    if (!empMap || empMap.size === 0) {
      continue;
    }
    if (empMap.size > 1) {
      return null;
    }
    const entry = [...empMap.entries()][0];
    if (!entry) {
      continue;
    }
    const [employeeNumber, fullName] = entry;
    hits.push({ employeeNumber, fullName });
  }

  if (hits.length === 0) {
    return null;
  }

  const distinctEmp = new Set(hits.map((h) => h.employeeNumber));
  if (distinctEmp.size !== 1) {
    return null;
  }

  const employeeNumber = hits[0].employeeNumber;
  return { employeeNumber, fullName: hits[0].fullName };
}

/**
 * Exact match first (unchanged). If Unknown, approved first-name variants (Possible match), then edit-distance
 * suggestion (Possible match). Duplicate-input tagging unchanged.
 * Empty or whitespace-only lines are skipped (no output row, no duplicate tracking).
 */
export function runMentorNameLookup(
  lines: string[],
  merged: MentorNameLookupMergedRow[],
): MentorNameLookupOutputRow[] {
  const index = buildNormalizedNameIndex(merged);
  const seenEntered = new Set<string>();
  const out: MentorNameLookupOutputRow[] = [];

  for (const line of lines) {
    const enteredName = line.trim();
    if (enteredName === "") {
      continue;
    }

    const isDuplicate = seenEntered.has(enteredName);
    if (!isDuplicate) {
      seenEntered.add(enteredName);
    }

    const normalized = normalizeMentorLookupName(enteredName);
    const { status: base, matchedName, employeeNumber } = baseLookupForNormalizedName(
      index,
      normalized,
    );

    let resolvedMatchedName = matchedName;
    let resolvedEmployeeNumber = employeeNumber;
    let resolvedBase: BaseStatus | "Possible match" = base;

    if (base === "Unknown") {
      const nicknameHit = tryNicknameVariantLookup(normalized, index);
      if (nicknameHit) {
        resolvedBase = "Possible match";
        resolvedMatchedName = nicknameHit.fullName;
        resolvedEmployeeNumber = nicknameHit.employeeNumber;
      } else {
        const suggestion = findConservativeEditDistanceSuggestion(normalized, merged);
        if (suggestion) {
          resolvedBase = "Possible match";
          resolvedMatchedName = suggestion.fullName;
          resolvedEmployeeNumber = suggestion.employeeNumber;
        }
      }
    }

    const status: string = isDuplicate ? `${resolvedBase} · Duplicate input` : resolvedBase;

    out.push({
      enteredName,
      matchedName: resolvedMatchedName,
      employeeNumber: resolvedEmployeeNumber,
      status,
    });
  }

  return out;
}

export function formatMentorNameLookupEmployeeNumbersCopy(rows: MentorNameLookupOutputRow[]): string {
  return rows.map((r) => r.employeeNumber).join("\r\n");
}

export function formatMentorNameLookupNameAndNumberCopy(rows: MentorNameLookupOutputRow[]): string {
  return rows
    .map((r) => {
      const label = (r.matchedName ?? r.enteredName).trim() || "—";
      return `${label}\t${r.employeeNumber}`;
    })
    .join("\r\n");
}
