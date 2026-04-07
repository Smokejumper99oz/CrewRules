/**
 * Pure profile helper functions — no server imports, safe to use in Client Components.
 * Uses `import type` so the server-only parts of lib/profile.ts are never bundled here.
 */

import type { Profile } from "@/lib/profile";

/** Pro access: subscription_tier pro/enterprise, or valid trial not yet expired. */
export function isProActive(profile?: Profile | null): boolean {
  if (!profile) return false;
  const tier = profile.subscription_tier;
  if (tier === "pro" || tier === "enterprise") return true;
  const expiresAt = profile.pro_trial_expires_at;
  if (!expiresAt || typeof expiresAt !== "string") return false;
  const expiresMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresMs)) return false;
  return expiresMs > Date.now();
}

/**
 * Whether the "Start 14-Day PRO Trial" CTA should show.
 * Returns false if user has ever started a trial, or is already Pro/Enterprise.
 */
export function isEligibleForProTrialStartCta(profile?: Profile | null): boolean {
  if (!profile) return false;
  const tier = profile.subscription_tier;
  if (tier === "pro" || tier === "enterprise") return false;
  if (profile.pro_trial_started_at != null) return false;
  return true;
}
