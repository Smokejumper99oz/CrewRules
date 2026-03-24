import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates or updates mentor_assignments so the Mentoring portal (getMentorAssignments)
 * returns a row for this mentor. Uses mentee employee_number + tenant to resolve mentee profile.
 * Called from Super Admin user save when Mentor is enabled and mentee employee # is provided.
 */
export async function upsertMentorAssignmentFromSuperAdmin(
  admin: SupabaseClient,
  params: { mentorUserId: string; menteeEmployeeNumber: string; tenant: string }
): Promise<{ error?: string }> {
  const menteeEmp = params.menteeEmployeeNumber.trim();
  if (!menteeEmp) return { error: "Mentee employee number is required to create a mentoring assignment." };

  const { data: mentee, error: menteeErr } = await admin
    .from("profiles")
    .select("id")
    .eq("tenant", params.tenant)
    .eq("employee_number", menteeEmp)
    .maybeSingle();

  if (menteeErr) return { error: menteeErr.message };
  if (!mentee?.id) {
    return {
      error: `No profile in this tenant has employee number "${menteeEmp}".`,
    };
  }
  if (mentee.id === params.mentorUserId) {
    return { error: "Mentor and mentee cannot be the same user." };
  }

  const assignedAt = new Date().toISOString();

  const { data: existing, error: findErr } = await admin
    .from("mentor_assignments")
    .select("id")
    .eq("mentor_user_id", params.mentorUserId)
    .eq("employee_number", menteeEmp)
    .maybeSingle();

  if (findErr) return { error: findErr.message };

  if (existing?.id) {
    const { error: updErr } = await admin
      .from("mentor_assignments")
      .update({
        mentee_user_id: mentee.id,
        active: true,
        assigned_at: assignedAt,
      })
      .eq("id", existing.id);
    if (updErr) return { error: updErr.message };
    return {};
  }

  const { error: insErr } = await admin.from("mentor_assignments").insert({
    mentor_user_id: params.mentorUserId,
    mentee_user_id: mentee.id,
    employee_number: menteeEmp,
    active: true,
    assigned_at: assignedAt,
  });

  if (insErr) return { error: insErr.message };
  return {};
}
