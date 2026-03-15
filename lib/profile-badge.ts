/** Minimal profile shape for badge display. Avoids importing lib/profile (which uses server-only code). */
type ProfileForBadge = {
  subscription_tier?: "free" | "pro" | "enterprise";
  pro_trial_expires_at?: string | null;
  is_founding_pilot?: boolean;
} | null;

/** Plan badge label for display: Free, Pro, Enterprise, or Pro Trial — X days. Used by profile card and Commute Assist. */
export function getPlanBadgeLabel(profile: ProfileForBadge): string {
  if (!profile) return "Free";
  const tier = profile.subscription_tier;
  if (tier === "enterprise") return "Enterprise";
  if (tier === "pro") return "PRO";
  if (profile.pro_trial_expires_at) {
    const ms = new Date(profile.pro_trial_expires_at).getTime();
    if (!Number.isNaN(ms) && ms > Date.now()) {
      const daysLeft = Math.ceil((ms - Date.now()) / (24 * 60 * 60 * 1000));
      return `PRO Trial — ${daysLeft} days remaining`;
    }
  }
  return "Free";
}

/** Plan badge variant: slate (Free), gold/amber/red (Pro), emerald (Enterprise). */
export function getPlanBadgeVariant(profile: ProfileForBadge): "slate" | "gold" | "emerald" | "amber" | "red" {
  if (!profile) return "slate";
  const tier = profile.subscription_tier;
  if (tier === "enterprise") return "emerald";
  if (tier === "pro") return "gold";
  if (profile.pro_trial_expires_at) {
    const ms = new Date(profile.pro_trial_expires_at).getTime();
    if (!Number.isNaN(ms) && ms > Date.now()) {
      const daysRemaining = Math.ceil((ms - Date.now()) / (24 * 60 * 60 * 1000));
      if (daysRemaining > 7) return "gold";
      if (daysRemaining > 1) return "amber";
      return "red";
    }
  }
  return "slate";
}
