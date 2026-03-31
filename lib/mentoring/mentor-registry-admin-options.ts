/**
 * Allowed mentor_registry values for Frontier Admin Mentor Roster (V1).
 * DB columns remain plain text; we validate against these sets in server actions.
 */

export const MENTOR_REGISTRY_TYPE_VALUES = [
  "nh_mentor",
  "captain_mentor",
  "potential_mentor",
  "company_mentor",
] as const;

export type MentorRegistryTypeValue = (typeof MENTOR_REGISTRY_TYPE_VALUES)[number];

export const MENTOR_REGISTRY_TYPE_LABELS: Record<MentorRegistryTypeValue, string> = {
  nh_mentor: "NH Mentor",
  captain_mentor: "Captain Mentor",
  potential_mentor: "Potential Mentor",
  company_mentor: "Company Mentor",
};

export const MENTOR_REGISTRY_STATUS_VALUES = [
  "active",
  "non_active",
  "former",
  "archived",
] as const;

export type MentorRegistryStatusValue = (typeof MENTOR_REGISTRY_STATUS_VALUES)[number];

export const MENTOR_REGISTRY_STATUS_LABELS: Record<MentorRegistryStatusValue, string> = {
  active: "Active",
  non_active: "Non Active",
  former: "Former Mentor",
  archived: "Archived",
};

export function isMentorRegistryTypeValue(v: string): v is MentorRegistryTypeValue {
  return (MENTOR_REGISTRY_TYPE_VALUES as readonly string[]).includes(v);
}

export function isMentorRegistryStatusValue(v: string): v is MentorRegistryStatusValue {
  return (MENTOR_REGISTRY_STATUS_VALUES as readonly string[]).includes(v);
}

export const MENTOR_REGISTRY_ADMIN_NOTES_MAX_LEN = 4000;

/** Canonical order for displaying and storing mentor categories. */
const MENTOR_CATEGORY_ORDER_IDX: Record<MentorRegistryTypeValue, number> = {
  nh_mentor: 0,
  captain_mentor: 1,
  potential_mentor: 2,
  company_mentor: 3,
};

/** Dedupe, validate, and sort category keys (stable product order). */
export function sortMentorRegistryCategories(
  raw: readonly string[],
): MentorRegistryTypeValue[] {
  const seen = new Set<string>();
  const valid: MentorRegistryTypeValue[] = [];
  for (const c of raw) {
    const t = String(c).trim();
    if (!isMentorRegistryTypeValue(t) || seen.has(t)) continue;
    seen.add(t);
    valid.push(t);
  }
  return valid.sort((a, b) => MENTOR_CATEGORY_ORDER_IDX[a] - MENTOR_CATEGORY_ORDER_IDX[b]);
}

/**
 * Effective categories for UI: DB array when non-empty, else legacy single mentor_type.
 */
export function mentorCategoriesFromRow(
  categories: string[] | null | undefined,
  legacyType: string | null | undefined,
): MentorRegistryTypeValue[] {
  const fromDb = Array.isArray(categories) ? categories : [];
  const sorted = sortMentorRegistryCategories(fromDb);
  if (sorted.length > 0) return sorted;
  const legacy = String(legacyType ?? "").trim();
  return isMentorRegistryTypeValue(legacy) ? [legacy] : [];
}

/**
 * Phase 1 sync: one category → same mentor_type; multiple → mentor_type null (categories are source of truth).
 */
export function deriveLegacyMentorTypeForSync(
  categories: MentorRegistryTypeValue[],
): string | null {
  if (categories.length === 1) return categories[0];
  return null;
}

/** Short label for Program pill (drops trailing " Mentor"). */
export function shortenMentorCategoryLabelForPill(mappedTypeLabel: string): string {
  const t = mappedTypeLabel.trim();
  if (!t || t === "—") return "—";
  const withoutSuffix = t.replace(/\s+mentor$/i, "").trim();
  return withoutSuffix.length > 0 ? withoutSuffix : t;
}

export function mentorProgramTypePillParts(cats: MentorRegistryTypeValue[]): {
  pillPart: string;
  titlePart: string;
} {
  if (cats.length === 0) return { pillPart: "—", titlePart: "—" };
  const titlePart = cats.map((c) => MENTOR_REGISTRY_TYPE_LABELS[c]).join(" · ");
  const shorts = cats.map((c) =>
    shortenMentorCategoryLabelForPill(MENTOR_REGISTRY_TYPE_LABELS[c]),
  );
  const pillPart = shorts.join("/");
  return { pillPart, titlePart };
}
