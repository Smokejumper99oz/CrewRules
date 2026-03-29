import type { SupabaseClient } from "@supabase/supabase-js";

function eqAssignmentField(
  existing: string | null | undefined,
  next: string | null | undefined
): boolean {
  const a = existing == null || String(existing).trim() === "" ? null : String(existing).trim();
  const b = next == null || String(next).trim() === "" ? null : String(next).trim();
  return a === b;
}

export type UpsertMentorAssignmentFromSuperAdminResult =
  | { error: string }
  | { created: boolean; updated: boolean };

/**
 * Creates or updates mentor_assignments so the Mentoring portal (getMentorAssignments)
 * returns a row for this mentor. Uses mentee employee_number + tenant to resolve mentee profile.
 * Called from Super Admin user save when Mentor is enabled and mentee employee # is provided.
 */
export async function upsertMentorAssignmentFromSuperAdmin(
  admin: SupabaseClient,
  params: {
    mentorUserId: string;
    menteeEmployeeNumber: string;
    tenant: string;
    hireDate?: string | null;
    notes?: string | null;
    /** When set and non-empty after trim, stored on the assignment; empty omits field so existing value is not cleared. */
    menteeDisplayName?: string | null;
    /** When defined, persisted on assignment (trimmed; empty string → null). Omitted when undefined. */
    menteePersonalEmail?: string | null;
    /** When defined, persisted on assignment (trimmed; empty string → null). Omitted when undefined. */
    menteePhone?: string | null;
  }
): Promise<UpsertMentorAssignmentFromSuperAdminResult> {
  const menteeEmp = params.menteeEmployeeNumber.trim();
  if (!menteeEmp) {
    return { error: "Mentee employee number is required to create a mentoring assignment." };
  }

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
    .select(
      "id, hire_date, notes, mentee_display_name, mentee_user_id, active, mentee_personal_email, mentee_phone"
    )
    .eq("mentor_user_id", params.mentorUserId)
    .eq("employee_number", menteeEmp)
    .maybeSingle();

  if (findErr) return { error: findErr.message };

  const updatePayload: {
    mentee_user_id: string;
    active: boolean;
    assigned_at: string;
    hire_date?: string | null;
    notes?: string | null;
    mentee_display_name?: string;
    mentee_personal_email?: string | null;
    mentee_phone?: string | null;
  } = {
    mentee_user_id: mentee.id,
    active: true,
    assigned_at: assignedAt,
  };
  if (params.hireDate !== undefined) {
    const h = params.hireDate ?? "";
    updatePayload.hire_date = h.trim() ? h.trim() : null;
  }
  if (params.notes !== undefined && (params.notes ?? "").trim().length > 0) {
    updatePayload.notes = (params.notes ?? "").trim();
  }
  if (params.menteeDisplayName !== undefined) {
    const dn = (params.menteeDisplayName ?? "").trim();
    if (dn) updatePayload.mentee_display_name = dn;
  }
  if (params.menteePersonalEmail !== undefined) {
    const e = (params.menteePersonalEmail ?? "").trim();
    updatePayload.mentee_personal_email = e.length > 0 ? e : null;
  }
  if (params.menteePhone !== undefined) {
    const ph = (params.menteePhone ?? "").trim();
    updatePayload.mentee_phone = ph.length > 0 ? ph : null;
  }

  const insertPayload: {
    mentor_user_id: string;
    mentee_user_id: string;
    employee_number: string;
    active: boolean;
    assigned_at: string;
    hire_date?: string | null;
    notes?: string | null;
    mentee_display_name?: string;
    mentee_personal_email?: string | null;
    mentee_phone?: string | null;
  } = {
    mentor_user_id: params.mentorUserId,
    mentee_user_id: mentee.id,
    employee_number: menteeEmp,
    active: true,
    assigned_at: assignedAt,
  };
  if (params.hireDate !== undefined) {
    const h = params.hireDate ?? "";
    insertPayload.hire_date = h.trim() ? h.trim() : null;
  }
  if (params.notes !== undefined) {
    const n = params.notes ?? "";
    insertPayload.notes = n.trim() ? n.trim() : null;
  }
  if (params.menteeDisplayName !== undefined) {
    const dn = (params.menteeDisplayName ?? "").trim();
    if (dn) insertPayload.mentee_display_name = dn;
  }
  if (params.menteePersonalEmail !== undefined) {
    const e = (params.menteePersonalEmail ?? "").trim();
    insertPayload.mentee_personal_email = e.length > 0 ? e : null;
  }
  if (params.menteePhone !== undefined) {
    const ph = (params.menteePhone ?? "").trim();
    insertPayload.mentee_phone = ph.length > 0 ? ph : null;
  }

  if (existing?.id) {
    let dataChanged =
      existing.mentee_user_id !== mentee.id || existing.active !== true;

    if (!dataChanged) {
      if ("hire_date" in updatePayload && !eqAssignmentField(existing.hire_date, updatePayload.hire_date)) {
        dataChanged = true;
      }
      if (!dataChanged && "notes" in updatePayload && !eqAssignmentField(existing.notes, updatePayload.notes)) {
        dataChanged = true;
      }
      if (
        !dataChanged &&
        "mentee_display_name" in updatePayload &&
        !eqAssignmentField(existing.mentee_display_name, updatePayload.mentee_display_name)
      ) {
        dataChanged = true;
      }
      if (
        !dataChanged &&
        "mentee_personal_email" in updatePayload &&
        !eqAssignmentField(existing.mentee_personal_email, updatePayload.mentee_personal_email)
      ) {
        dataChanged = true;
      }
      if (
        !dataChanged &&
        "mentee_phone" in updatePayload &&
        !eqAssignmentField(existing.mentee_phone, updatePayload.mentee_phone)
      ) {
        dataChanged = true;
      }
    }

    const { error: updErr } = await admin
      .from("mentor_assignments")
      .update(updatePayload)
      .eq("id", existing.id);
    if (updErr) return { error: updErr.message };
    return { created: false, updated: dataChanged };
  }

  const { error: insErr } = await admin.from("mentor_assignments").insert(insertPayload);

  if (insErr) return { error: insErr.message };
  return { created: true, updated: false };
}
