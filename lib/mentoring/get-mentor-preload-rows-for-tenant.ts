import type { SupabaseClient } from "@supabase/supabase-js";

export type MentorPreloadRow = {
  id: string;
  employee_number: string;
  full_name: string | null;
  work_email: string | null;
  phone: string | null;
  active: boolean;
  matched_profile_id: string | null;
  updated_at: string;
  notes: string | null;
  profiles: {
    mentor_phone: string | null;
    mentor_contact_email: string | null;
  } | null;
};

/**
 * Service-role client; caller must gate access. Frontier / tenant admin pages only.
 */
export async function getMentorPreloadRowsForTenant(
  admin: SupabaseClient,
  tenant: string
): Promise<MentorPreloadRow[]> {
  const t = tenant?.trim();
  if (!t) return [];

  const { data, error } = await admin
    .from("mentor_preload")
    .select(
      `
      id,
      employee_number,
      full_name,
      work_email,
      phone,
      active,
      matched_profile_id,
      updated_at,
      notes,
      profiles:profiles!mentor_preload_matched_profile_id_fkey (
        mentor_phone,
        mentor_contact_email
      )
    `
    )
    .eq("tenant", t)
    .order("updated_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row): MentorPreloadRow => {
    const p = row.profiles as
      | { mentor_phone: string | null; mentor_contact_email: string | null }
      | { mentor_phone: string | null; mentor_contact_email: string | null }[]
      | null
      | undefined;
    const profiles =
      p == null ? null : Array.isArray(p) ? (p[0] ?? null) : p;
    return {
      id: row.id,
      employee_number: row.employee_number,
      full_name: row.full_name,
      work_email: row.work_email,
      phone: row.phone,
      active: row.active,
      matched_profile_id: row.matched_profile_id,
      updated_at: row.updated_at,
      notes: row.notes,
      profiles,
    };
  });
}
