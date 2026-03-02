export const RECENT_QA_LEGACY_KEY = "crewrules-ask-recent";

export function getRecentQAStorageKey(
  tenant: string,
  portal: string,
  userId?: string | null
): string {
  return `crewrules-ask-recent:${tenant}:${portal}:${userId || "anon"}`;
}
