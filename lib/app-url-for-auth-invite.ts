const PRODUCTION_APP_ORIGIN = "https://crewrules.com";

/**
 * App origin (scheme + host, no trailing slash) for Supabase auth invite `redirectTo`
 * and other invited-user links (e.g. accept-invite), without using the hostname
 * "localhost" as a hardcoded fallback.
 *
 * - Uses `NEXT_PUBLIC_APP_URL` when set.
 * - Else Vercel preview: `https://$VERCEL_URL`.
 * - Else in development: loopback on port 3000.
 * - Else production: `https://crewrules.com`.
 */
export function getAppOriginForAuthInvites(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "").trim();
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  }
  if (process.env.NODE_ENV === "development") {
    return "http://127.0.0.1:3000";
  }
  return PRODUCTION_APP_ORIGIN;
}
