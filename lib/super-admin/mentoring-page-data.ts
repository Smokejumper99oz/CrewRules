import type { SupabaseClient } from "@supabase/supabase-js";

export type SuperAdminMentoringTableRow = {
  id: string;
  mentor_name: string | null;
  mentee_name: string | null;
  /** From mentor_assignments.mentee_display_name (e.g. CSV) when mentee_user_id is not linked yet. */
  staged_mentee_name: string | null;
  employee_number: string | null;
  hire_date: string | null;
  /** Linked portal user present */
  is_matched: boolean;
  assignment_active: boolean;
  mentor_contact_ok: boolean;
  mentor_contact_email: string | null;
  mentor_phone: string | null;
  mentor_profile_phone: string | null;
};

function hasMentorContact(p: {
  mentor_contact_email?: string | null;
  mentor_phone?: string | null;
} | null): boolean {
  if (!p) return false;
  const email = (p.mentor_contact_email ?? "").trim();
  const mp = (p.mentor_phone ?? "").trim();
  return Boolean(email && mp);
}

const ASSIGNMENT_LIST_SELECT = `
      id,
      mentee_user_id,
      mentee_display_name,
      employee_number,
      hire_date,
      active,
      assigned_at,
      mentor:profiles!mentor_assignments_mentor_user_id_fkey(full_name, phone, mentor_phone, mentor_contact_email),
      mentee:profiles!mentor_assignments_mentee_user_id_fkey(full_name)
    `;

type AssignmentQueryRow = {
  id: string;
  mentee_user_id: string | null;
  mentee_display_name: string | null;
  employee_number: string | null;
  hire_date: string | null;
  active: boolean | null;
  assigned_at: string | null;
  mentor: {
    full_name: string | null;
    phone: string | null;
    mentor_phone: string | null;
    mentor_contact_email: string | null;
  } | null;
  mentee: { full_name: string | null } | null;
};

function toMentoringTableRow(row: AssignmentQueryRow): SuperAdminMentoringTableRow {
  const matched = Boolean(row.mentee_user_id);
  return {
    id: row.id,
    mentor_name: row.mentor?.full_name ?? null,
    mentee_name: row.mentee?.full_name ?? null,
    staged_mentee_name: row.mentee_display_name?.trim() || null,
    employee_number: row.employee_number?.trim() || null,
    hire_date: row.hire_date,
    is_matched: matched,
    assignment_active: row.active === true,
    mentor_contact_ok: hasMentorContact(row.mentor),
    mentor_contact_email: row.mentor?.mentor_contact_email?.trim() || null,
    mentor_phone: row.mentor?.mentor_phone?.trim() || null,
    mentor_profile_phone: row.mentor?.phone?.trim() || null,
  };
}

const IN_CHUNK = 120;

function chunk<T>(arr: T[], size: number): T[][] {
  if (arr.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * All mentor_assignments with mentor/mentee profile embeds. Service-role client; gate caller first.
 */
export async function getMentoringAssignmentTableForSuperAdmin(
  admin: SupabaseClient
): Promise<SuperAdminMentoringTableRow[]> {
  const { data, error } = await admin
    .from("mentor_assignments")
    .select(ASSIGNMENT_LIST_SELECT)
    .order("assigned_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return (data as unknown as AssignmentQueryRow[]).map(toMentoringTableRow);
}

/**
 * Assignments whose mentor profile is in the given tenant + portal. Service-role client; gate caller first.
 */
export async function getMentoringAssignmentTableForTenant(
  admin: SupabaseClient,
  params: { tenant: string; portal: string }
): Promise<SuperAdminMentoringTableRow[]> {
  const { data: mentorRows, error: mErr } = await admin
    .from("profiles")
    .select("id")
    .eq("tenant", params.tenant)
    .eq("portal", params.portal);

  if (mErr || !mentorRows?.length) {
    return [];
  }

  const mentorIds = [...new Set(mentorRows.map((r) => (r as { id: string }).id))];
  const combined: AssignmentQueryRow[] = [];

  for (const part of chunk(mentorIds, IN_CHUNK)) {
    const { data, error } = await admin
      .from("mentor_assignments")
      .select(ASSIGNMENT_LIST_SELECT)
      .in("mentor_user_id", part);

    if (error) {
      return [];
    }
    for (const r of data ?? []) {
      combined.push(r as unknown as AssignmentQueryRow);
    }
  }

  combined.sort((a, b) =>
    String(b.assigned_at ?? "").localeCompare(String(a.assigned_at ?? ""))
  );
  return combined.map(toMentoringTableRow);
}

/** Status badge labels for assignment tables (e.g. Frontier admin Pairing Review). */
export function statusLabel(row: {
  is_matched: boolean;
  assignment_active: boolean;
  staged_mentee_name: string | null;
  employee_number: string | null;
}): { text: string; warn: boolean } {
  if (!row.is_matched) {
    if (row.staged_mentee_name?.trim() || row.employee_number?.trim()) {
      return { text: "Awaiting Sign-Up", warn: true };
    }
    return { text: "Unmatched", warn: true };
  }
  if (row.assignment_active) return { text: "Active", warn: false };
  return { text: "Inactive", warn: false };
}
