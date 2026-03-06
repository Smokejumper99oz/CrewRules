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
  commute_arrival_buffer_minutes?: number;
  commute_release_buffer_minutes?: number;
  commute_nonstop_only?: boolean;
  subscription_tier?: "free" | "pro" | "enterprise";
  pro_trial_started_at?: string | null;
  pro_trial_expires_at?: string | null;
  show_pay_projection?: boolean;
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

/** Subscription type for display: Free, Pro, or Enterprise. */
export function getSubscriptionDisplayType(profile?: Profile | null): "Free" | "Pro" | "Enterprise" {
  if (!profile) return "Free";
  const tier = profile.subscription_tier;
  if (tier === "enterprise") return "Enterprise";
  if (tier === "pro") return "Pro";
  return "Free";
}

/** Pro badge label: "Pro Active" or "Pro Trial — X days remaining", or null. */
export function getProBadgeLabel(profile: Profile | null): string | null {
  if (!profile) return null;
  const tier = profile.subscription_tier;
  if (tier === "pro" || tier === "enterprise") return "Pro Active";
  if (profile.pro_trial_expires_at) {
    const ms = new Date(profile.pro_trial_expires_at).getTime();
    if (!Number.isNaN(ms) && ms > Date.now()) {
      const daysLeft = Math.ceil((ms - Date.now()) / (24 * 60 * 60 * 1000));
      return `Pro Trial — ${daysLeft} days remaining`;
    }
  }
  return null;
}

/** Pro badge color variant: emerald (paid or >7 days), amber (2–7 days), red (≤1 day). */
export function getProBadgeVariant(profile: Profile | null): "emerald" | "amber" | "red" {
  if (!profile) return "emerald";
  const tier = profile.subscription_tier;
  if (tier === "pro" || tier === "enterprise") return "emerald";
  if (!profile.pro_trial_expires_at) return "emerald";
  const ms = new Date(profile.pro_trial_expires_at).getTime();
  if (Number.isNaN(ms) || ms <= Date.now()) return "emerald";
  const daysRemaining = Math.ceil((ms - Date.now()) / (24 * 60 * 60 * 1000));
  if (daysRemaining > 7) return "emerald";
  if (daysRemaining > 1) return "amber";
  return "red";
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
  if (profile.role !== "super_admin" && profile.role !== "tenant_admin") return false;
  if (profile.role === "tenant_admin" && (profile.tenant !== tenant || profile.portal !== portal))
    return false;
  return true;
}
