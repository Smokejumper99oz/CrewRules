import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  email: string | null;
  tenant: string;
  portal: string;
  role: "admin" | "member";
  crew_role: "pilot" | "flight_attendant";
  created_at: string;
  updated_at: string;
};

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
