import { formatInTimeZone } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/rbac";

export type ProfilePosition = "captain" | "first_officer" | "flight_attendant";

export type Profile = {
  id: string;
  email: string | null;
  tenant: string;
  portal: string;
  role: Role;
  plan?: "free" | "pro" | "enterprise";
  full_name?: string | null;
  employee_number?: string | null;
  date_of_hire?: string | null;
  position?: ProfilePosition | null;
  base_airport?: string | null;
  equipment?: string | null;
  base_timezone?: string;
  display_timezone_mode?: "base" | "device" | "toggle" | "both";
  time_format?: "24h" | "12h";
  show_timezone_label?: boolean;
  home_airport?: string | null;
  alternate_home_airport?: string | null;
  commute_arrival_buffer_minutes?: number;
  commute_release_buffer_minutes?: number;
  commute_nonstop_only?: boolean;
  commute_two_leg_enabled?: boolean | null;
  commute_two_leg_stop_1?: string | null;
  commute_two_leg_stop_2?: string | null;
  subscription_tier?: "free" | "pro" | "enterprise";
  pro_trial_started_at?: string | null;
  pro_trial_expires_at?: string | null;
  pro_trial_converted_at?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  subscription_status?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  billing_interval?: string | null;
  billing_source?: string | null;
  is_founding_pilot?: boolean;
  founding_pilot_started_at?: string | null;
  founding_pilot_number?: number | null;
  show_pay_projection?: boolean;
  family_view_enabled?: boolean;
  family_view_show_exact_times?: boolean;
  family_view_show_overnight_cities?: boolean;
  family_view_show_commute_estimates?: boolean;
  color_mode?: "dark" | "light" | "system";
  welcome_modal_version_seen?: number | null;
  is_admin?: boolean;
  is_mentor?: boolean;
  /** Shown on mentee Mentor Contact card when set; falls back to `phone` there if null. */
  mentor_phone?: string | null;
  /** Preferred email on mentee Mentor Contact card; not the login email. */
  mentor_contact_email?: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Dashboard greeting: time-based (Good morning/afternoon/evening) + role prefix + name.
 * Time: 04:00–11:59 morning, 12:00–17:59 afternoon, 18:00–03:59 evening.
 * Role: Captain or First Officer prefixed before name. No exclamation mark.
 */
const FALLBACK_TZ = "America/Denver";

export function getDashboardGreeting(profile: Profile | null): { greetingPart: string; namePart: string } {
  const tz = profile?.base_timezone?.trim() || FALLBACK_TZ;
  let hour = 12;
  try {
    hour = parseInt(formatInTimeZone(new Date(), tz, "HH"), 10);
    if (Number.isNaN(hour)) hour = 12;
  } catch {
    hour = parseInt(formatInTimeZone(new Date(), FALLBACK_TZ, "HH"), 10);
  }

  let greetingPart: string;
  if (hour >= 4 && hour < 12) greetingPart = "Good morning";
  else if (hour >= 12 && hour < 18) greetingPart = "Good afternoon";
  else greetingPart = "Good evening";

  const displayName = getDisplayName(profile);
  let namePart = displayName;
  if (profile?.position === "captain") namePart = `Captain ${displayName}`;
  else if (profile?.position === "first_officer") namePart = `First Officer ${displayName}`;

  return { greetingPart, namePart };
}

/** Display name: full_name if set, else derived from email. */
export function getDisplayName(profile: Profile | null): string {
  if (!profile) return "User";
  if (profile.full_name?.trim()) return profile.full_name.trim();
  const local = (profile.email ?? "").split("@")[0] || "";
  return local
    .split(/[._-]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(" ") || profile.email || "User";
}

/** Pro access: subscription_tier pro/enterprise, or valid trial not yet expired. */
export function isProActive(profile?: Profile | null): boolean {
  if (!profile) {
    return false;
  }

  const tier = profile.subscription_tier;
  if (tier === "pro" || tier === "enterprise") {
    return true;
  }

  const expiresAt = profile.pro_trial_expires_at;
  if (!expiresAt || typeof expiresAt !== "string") {
    return false;
  }

  const expiresMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresMs)) {
    return false;
  }

  return expiresMs > Date.now();
}

/** Subscription type for display: Free, Pro Trial, Pro, or Enterprise (effective status; trial uses pro_trial_expires_at). */
export function getSubscriptionDisplayType(
  profile?: Profile | null
): "Free" | "Pro" | "Pro Trial" | "Enterprise" {
  if (!profile) return "Free";
  const tier = profile.subscription_tier;
  if (tier === "enterprise") return "Enterprise";
  if (tier === "pro") return "Pro";
  const expiresAt = profile.pro_trial_expires_at;
  if (expiresAt) {
    const ms = new Date(expiresAt).getTime();
    if (!Number.isNaN(ms) && ms > Date.now()) return "Pro Trial";
  }
  return "Free";
}

/**
 * Whole days until `pro_trial_expires_at` (ceiling), when the user is on an active Pro trial
 * (same conditions as `getSubscriptionDisplayType` → "Pro Trial": not Pro/Enterprise tier, future expiry).
 */
export function getActiveProTrialDaysRemaining(profile: Profile | null | undefined): number | null {
  if (!profile) return null;
  const tier = profile.subscription_tier;
  if (tier === "enterprise" || tier === "pro") return null;
  const expiresAt = profile.pro_trial_expires_at;
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime();
  if (Number.isNaN(ms) || ms <= Date.now()) return null;
  return Math.ceil((ms - Date.now()) / (24 * 60 * 60 * 1000));
}

/** Pro badge label: "Pro Active" or "Pro Trial — X days remaining", or null. */
export function getProBadgeLabel(profile: Profile | null): string | null {
  if (!profile) return null;
  const tier = profile.subscription_tier;
  if (tier === "pro" || tier === "enterprise") return "PRO Active";
  if (profile.pro_trial_expires_at) {
    const ms = new Date(profile.pro_trial_expires_at).getTime();
    if (!Number.isNaN(ms) && ms > Date.now()) {
      const daysLeft = Math.ceil((ms - Date.now()) / (24 * 60 * 60 * 1000));
      return `PRO Trial — ${daysLeft} days remaining`;
    }
  }
  return null;
}

/** Plan badge label for display: Free, Pro, Enterprise, or Pro Trial — X days. Used by profile card and Commute Assist. */
export function getPlanBadgeLabel(profile: Profile | null): string {
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
export function getPlanBadgeVariant(profile: Profile | null): "slate" | "gold" | "emerald" | "amber" | "red" {
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

/** Pro badge color variant: gold (paid or trial >7 days), amber (2–7 days), red (≤1 day). */
export function getProBadgeVariant(profile: Profile | null): "gold" | "emerald" | "amber" | "red" {
  if (!profile) return "gold";
  const tier = profile.subscription_tier;
  if (tier === "pro" || tier === "enterprise") return "gold";
  if (!profile.pro_trial_expires_at) return "gold";
  const ms = new Date(profile.pro_trial_expires_at).getTime();
  if (Number.isNaN(ms) || ms <= Date.now()) return "gold";
  const daysRemaining = Math.ceil((ms - Date.now()) / (24 * 60 * 60 * 1000));
  if (daysRemaining > 7) return "gold";
  if (daysRemaining > 1) return "amber";
  return "red";
}

/**
 * Pro trial upgrade banner status. Returns null when no banner should show.
 * expiring_urgent: 1–3 days left. expiring_soon: 4–7 days left.
 * Does not show for paid Pro/Enterprise, expired trials, no trial, or >7 days left.
 */
export function getProTrialBannerStatus(
  profile: { subscription_tier?: string | null; pro_trial_started_at?: string | null; pro_trial_expires_at?: string | null } | null
): { status: "expiring_soon"; daysRemaining: number } | { status: "expiring_urgent"; daysRemaining: number } | null {
  if (!profile) return null;
  const tier = profile.subscription_tier ?? "free";
  if (tier === "pro" || tier === "enterprise") return null;
  const startedAt = profile.pro_trial_started_at;
  const expiresAt = profile.pro_trial_expires_at;
  if (!startedAt || !expiresAt) return null;
  const expiresMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresMs)) return null;
  const nowMs = Date.now();
  if (expiresMs <= nowMs) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.ceil((expiresMs - nowMs) / msPerDay);
  if (daysRemaining > 7) return null;
  const in3DaysMs = nowMs + 3 * msPerDay;
  if (expiresMs <= in3DaysMs) {
    return { status: "expiring_urgent", daysRemaining };
  }
  return { status: "expiring_soon", daysRemaining };
}

export async function getProfile(): Promise<Profile | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) return null;
    return data as Profile | null;
  } catch {
    return null;
  }
}

export async function isAdmin(tenant = "frontier", portal = "pilots"): Promise<boolean> {
  const profile = await getProfile();
  if (!profile) return false;
  if (profile.role === "super_admin") return true;
  if (profile.role === "tenant_admin" && profile.tenant === tenant && profile.portal === portal)
    return true;
  if (profile.is_admin === true && profile.tenant === tenant && profile.portal === portal)
    return true;
  return false;
}
