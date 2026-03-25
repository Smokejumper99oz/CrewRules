import type { SupabaseClient } from "@supabase/supabase-js";

export type SuperAdminMentoringTableRow = {
  id: string;
  mentor_name: string | null;
  mentee_name: string | null;
  employee_number: string | null;
  hire_date: string | null;
  /** Linked portal user present */
  is_matched: boolean;
  assignment_active: boolean;
  mentor_contact_ok: boolean;
};

function hasMentorContact(p: {
  mentor_contact_email?: string | null;
  mentor_phone?: string | null;
  phone?: string | null;
} | null): boolean {
  if (!p) return false;
  const email = (p.mentor_contact_email ?? "").trim();
  const mp = (p.mentor_phone ?? "").trim();
  const ph = (p.phone ?? "").trim();
  return Boolean(email || mp || ph);
}

/**
 * All mentor_assignments with mentor/mentee profile embeds. Service-role client; gate caller first.
 */
export async function getMentoringAssignmentTableForSuperAdmin(
  admin: SupabaseClient
): Promise<SuperAdminMentoringTableRow[]> {
  const { data, error } = await admin
    .from("mentor_assignments")
    .select(
      `
      id,
      mentee_user_id,
      employee_number,
      hire_date,
      active,
      mentor:profiles!mentor_assignments_mentor_user_id_fkey(full_name, phone, mentor_phone, mentor_contact_email),
      mentee:profiles!mentor_assignments_mentee_user_id_fkey(full_name)
    `
    )
    .order("assigned_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return (data as unknown as Array<{
    id: string;
    mentee_user_id: string | null;
    employee_number: string | null;
    hire_date: string | null;
    active: boolean | null;
    mentor: {
      full_name: string | null;
      phone: string | null;
      mentor_phone: string | null;
      mentor_contact_email: string | null;
    } | null;
    mentee: { full_name: string | null } | null;
  }>).map((row) => {
    const matched = Boolean(row.mentee_user_id);
    return {
      id: row.id,
      mentor_name: row.mentor?.full_name ?? null,
      mentee_name: row.mentee?.full_name ?? null,
      employee_number: row.employee_number?.trim() || null,
      hire_date: row.hire_date,
      is_matched: matched,
      assignment_active: row.active === true,
      mentor_contact_ok: hasMentorContact(row.mentor),
    };
  });
}
