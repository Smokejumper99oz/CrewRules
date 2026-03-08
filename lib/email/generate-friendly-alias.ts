/**
 * Generates a human-friendly inbound email alias.
 * Format: firstlast (e.g. svenfolmer), with numeric suffix if needed for uniqueness.
 */

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Build base alias from first name, last name, and user id.
 * - Preferred: firstlast (e.g. svenfolmer)
 * - Fallback: first + last if available
 * - Fallback: short user id (first 8 chars without dashes)
 */
export function generateFriendlyAliasBase(
  firstName: string,
  lastName: string,
  userId: string
): string {
  const first = normalize(firstName);
  const last = normalize(lastName);

  if (first && last) {
    return first + last;
  }
  if (first) {
    return first;
  }
  if (last) {
    return last;
  }

  const short = userId.replace(/-/g, "").slice(0, 8);
  return short || "user";
}
