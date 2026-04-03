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

const EXISTING_SELECT =
  "id, hire_date, notes, mentee_display_name, mentee_user_id, active, mentee_personal_email, mentee_phone, mentor_user_id, mentor_employee_number" as const;

type MentorAssignmentExistingRow = {
  id: string;
  hire_date: string | null;
  notes: string | null;
  mentee_display_name: string | null;
  mentee_user_id: string | null;
  active: boolean | null;
  mentee_personal_email: string | null;
  mentee_phone: string | null;
  mentor_user_id: string | null;
  mentor_employee_number: string | null;
};

/**
 * Creates or updates mentor_assignments so the Mentoring portal (getMentorAssignments)
 * returns a row for this mentor. Uses mentee employee_number + tenant to resolve mentee profile.
 * Called from Super Admin user save when Mentor is enabled and mentee employee # is provided.
 *
 * When `mentorUserId` is null and `mentorEmployeeNumber` is empty after trim, the assignment is **unassigned** (no mentor).
 * When `mentorUserId` is null and `mentorEmployeeNumber` is non-empty, staged mentor rules apply.
 * When `mentorUserId` is set, `mentorEmployeeNumber` is optional and falls back to the mentor profile's `employee_number`.
 *
 * `allowMenteeWithoutProfile` (default false): when true, allows `mentee_user_id` null if no profile exists yet (CSV preload);
 * callers that must require a live mentee (admin user save) must omit this flag.
 */
export async function upsertMentorAssignmentFromSuperAdmin(
  admin: SupabaseClient,
  params: {
    mentorUserId: string | null;
    /** Required when `mentorUserId` is null. Optional when live; falls back to profile.employee_number. */
    mentorEmployeeNumber?: string | null;
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
    /** CSV / preload: allow assignment without a profiles row; mentee links on signup. */
    allowMenteeWithoutProfile?: boolean;
  }
): Promise<UpsertMentorAssignmentFromSuperAdminResult> {
  const menteeEmp = params.menteeEmployeeNumber.trim();
  if (!menteeEmp) {
    return { error: "Mentee employee number is required to create a mentoring assignment." };
  }

  const allowMenteeWithoutProfile = params.allowMenteeWithoutProfile === true;

  const { data: mentee, error: menteeErr } = await admin
    .from("profiles")
    .select("id")
    .eq("tenant", params.tenant)
    .eq("employee_number", menteeEmp)
    .maybeSingle();

  if (menteeErr) return { error: menteeErr.message };
  const menteeIdResolved = mentee?.id ?? null;
  if (!menteeIdResolved && !allowMenteeWithoutProfile) {
    return {
      error: `No profile in this tenant has employee number "${menteeEmp}".`,
    };
  }

  const mentorUserId = params.mentorUserId;

  let mentorEmpForRow: string | null = null;
  if (mentorUserId) {
    if (menteeIdResolved && menteeIdResolved === mentorUserId) {
      return { error: "Mentor and mentee cannot be the same user." };
    }
    const fromParam =
      params.mentorEmployeeNumber != null && String(params.mentorEmployeeNumber).trim() !== ""
        ? String(params.mentorEmployeeNumber).trim()
        : null;
    if (fromParam) {
      mentorEmpForRow = fromParam;
    } else {
      const { data: mp } = await admin
        .from("profiles")
        .select("employee_number")
        .eq("id", mentorUserId)
        .maybeSingle();
      const raw = (mp?.employee_number as string | null | undefined) ?? null;
      mentorEmpForRow = raw != null && String(raw).trim() !== "" ? String(raw).trim() : null;
    }
  } else {
    const raw = params.mentorEmployeeNumber;
    const me = raw != null ? String(raw).trim() : "";
    if (!me) {
      mentorEmpForRow = null;
    } else {
      mentorEmpForRow = me;
      if (me === menteeEmp) {
        return { error: "Mentor and mentee cannot be the same employee number." };
      }
    }
  }

  const assignedAt = new Date().toISOString();

  let existing: MentorAssignmentExistingRow | null = null;

  if (mentorUserId) {
    const { data, error: findErr } = await admin
      .from("mentor_assignments")
      .select(EXISTING_SELECT)
      .eq("mentor_user_id", mentorUserId)
      .eq("employee_number", menteeEmp)
      .maybeSingle();
    if (findErr) return { error: findErr.message };
    existing = data as MentorAssignmentExistingRow | null;
  } else if (mentorEmpForRow) {
    const { data, error: findErr } = await admin
      .from("mentor_assignments")
      .select(EXISTING_SELECT)
      .is("mentor_user_id", null)
      .eq("mentor_employee_number", mentorEmpForRow)
      .eq("employee_number", menteeEmp)
      .maybeSingle();
    if (findErr) return { error: findErr.message };
    existing = data as MentorAssignmentExistingRow | null;
  } else {
    const { data, error: findErr } = await admin
      .from("mentor_assignments")
      .select(EXISTING_SELECT)
      .is("mentor_user_id", null)
      .is("mentor_employee_number", null)
      .eq("employee_number", menteeEmp)
      .maybeSingle();
    if (findErr) return { error: findErr.message };
    existing = data as MentorAssignmentExistingRow | null;
  }

  const updatePayload: {
    mentee_user_id: string | null;
    active: boolean;
    assigned_at: string;
    mentor_user_id: string | null;
    mentor_employee_number: string | null;
    hire_date?: string | null;
    notes?: string | null;
    mentee_display_name?: string;
    mentee_personal_email?: string | null;
    mentee_phone?: string | null;
  } = {
    mentee_user_id: menteeIdResolved,
    active: true,
    assigned_at: assignedAt,
    mentor_user_id: mentorUserId,
    mentor_employee_number: mentorEmpForRow,
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
    mentor_user_id: string | null;
    mentor_employee_number: string | null;
    mentee_user_id: string | null;
    employee_number: string;
    active: boolean;
    assigned_at: string;
    hire_date?: string | null;
    notes?: string | null;
    mentee_display_name?: string;
    mentee_personal_email?: string | null;
    mentee_phone?: string | null;
  } = {
    mentor_user_id: mentorUserId,
    mentor_employee_number: mentorEmpForRow,
    mentee_user_id: menteeIdResolved,
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
      (existing.mentee_user_id ?? null) !== (menteeIdResolved ?? null) ||
      existing.active !== true ||
      existing.mentor_user_id !== mentorUserId ||
      !eqAssignmentField(existing.mentor_employee_number, mentorEmpForRow);

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
