/** Same emails as middleware: platform-owner access even if profiles row is missing. */
export const SUPER_ADMIN_EMAIL_ALLOWLIST = ["svenfolmer92@gmail.com"] as const;

export function isSuperAdminAllowlistedEmail(email: string): boolean {
  const normalized = email.toLowerCase().trim();
  return SUPER_ADMIN_EMAIL_ALLOWLIST.some((e) => e.toLowerCase() === normalized);
}
