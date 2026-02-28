import { formatInTimeZone } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";

export type ProfilePosition = "captain" | "first_officer" | "flight_attendant";

export type Profile = {
  id: string;
  email: string | null;
  tenant: string;
  portal: string;
  role: "admin" | "member";
  crew_role: "pilot" | "flight_attendant";
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
  created_at: string;
  updated_at: string;
};

/**
 * Dashboard greeting: time-based (Good morning/afternoon/evening) + role prefix + name.
 * Time: 04:00–11:59 morning, 12:00–17:59 afternoon, 18:00–03:59 evening.
 * Role: Captain or First Officer prefixed before name. No exclamation mark.
 */
export function getDashboardGreeting(profile: Profile | null): { greetingPart: string; namePart: string } {
  const timezone = profile?.base_timezone ?? "America/Denver";
  const hour = parseInt(formatInTimeZone(new Date(), timezone, "HH"), 10);

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

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data as Profile | null;
}

export async function isAdmin(tenant = "frontier", portal = "pilots"): Promise<boolean> {
  const profile = await getProfile();
  if (!profile) return false;
  return profile.role === "admin" && profile.tenant === tenant && profile.portal === portal;
}
