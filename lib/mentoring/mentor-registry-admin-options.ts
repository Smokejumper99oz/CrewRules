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
