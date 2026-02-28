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
