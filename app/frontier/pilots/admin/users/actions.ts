"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile, isAdmin, isWithinFirstYearSinceDateOfHire } from "@/lib/profile";
import {
  upsertMentorAssignmentFromSuperAdmin,
} from "@/lib/mentoring/super-admin-sync-assignment";
import { getMenteeUserIdsWithMilitaryLeaveWorkspace } from "@/lib/mentoring/mentee-military-leave-workspace";
import { fetchAuthLastSignInAtByUserId } from "@/lib/super-admin/auth-last-sign-in-map";
import type {
  SuperAdminUserRow,
  UpdateSuperAdminUserAccessInput,
} from "@/lib/super-admin/actions";

const TENANT = "frontier";
const PORTAL = "pilots";

const USERS_PAGE = "/frontier/pilots/admin/users";

export async function getFrontierPilotAdminUsers(): Promise<SuperAdminUserRow[]> {
  const profile = await getProfile();
  if (!profile || !(await isAdmin(TENANT, PORTAL))) {
    return [];
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, full_name, email, tenant, role, employee_number, phone, mentor_phone, mentor_contact_email, is_admin, is_mentor, welcome_modal_version_seen, deleted_at, deletion_scheduled_for, date_of_hire"
    )
    .eq("tenant", TENANT)
    .eq("portal", PORTAL)
    .neq("role", "super_admin")
    .order("created_at", { ascending: false });

  if (error) {
    return [];
  }

  const userIds = new Set((data ?? []).map((p: { id: string }) => p.id));

  const { data: assignRows } = await admin
    .from("mentor_assignments")
    .select("mentee_user_id, mentor_user_id")
    .eq("active", true)
    .not("mentee_user_id", "is", null);

  const isMenteeIds = new Set<string>();
  for (const r of assignRows ?? []) {
    const mid = (r as { mentee_user_id: string | null }).mentee_user_id;
    const mur = (r as { mentor_user_id: string }).mentor_user_id;
    if (mid && userIds.has(mid) && userIds.has(mur)) {
      isMenteeIds.add(mid);
    }
  }

  const militaryLeaveMenteeIds = await getMenteeUserIdsWithMilitaryLeaveWorkspace(admin);

  const authSignInMap = await fetchAuthLastSignInAtByUserId(admin);

  return (data ?? []).map((p) => {
    const row = p as { id: string; date_of_hire: string | null };
    const dateOfHire = row.date_of_hire ?? null;
    return {
    id: row.id,
    full_name: (p as { full_name: string | null }).full_name ?? null,
    email: (p as { email: string | null }).email ?? null,
    tenant: (p as { tenant: string }).tenant ?? "unknown",
    role: (p as { role: string }).role ?? "pilot",
    employee_number: (p as { employee_number: string | null }).employee_number ?? null,
    phone: (p as { phone: string | null }).phone ?? null,
    mentor_phone: (p as { mentor_phone: string | null }).mentor_phone ?? null,
    mentor_contact_email: (p as { mentor_contact_email: string | null }).mentor_contact_email ?? null,
    is_admin: (p as { is_admin: boolean | null }).is_admin ?? false,
    is_mentor: (p as { is_mentor: boolean | null }).is_mentor ?? false,
    isMentee: isMenteeIds.has(row.id),
    mentoring_first_year_hire: isWithinFirstYearSinceDateOfHire(dateOfHire),
    mentoring_military_leave: militaryLeaveMenteeIds.has(row.id),
    welcome_modal_version_seen:
      (p as { welcome_modal_version_seen: number | null | undefined }).welcome_modal_version_seen ??
      null,
    ...(authSignInMap != null
      ? { last_sign_in_at: authSignInMap.get(row.id) ?? null }
      : {}),
    deleted_at: (p as { deleted_at: string | null }).deleted_at ?? null,
    deletion_scheduled_for:
      (p as { deletion_scheduled_for: string | null }).deletion_scheduled_for ?? null,
  };
  });
}

/**
 * Frontier pilots tenant admins: update profiles in this tenant only. Cannot modify Platform Owners;
 * cannot modify tenant admins unless the actor is Platform Owner.
 */
export async function updateFrontierPilotAdminUserAccess(
  userId: string,
  data: UpdateSuperAdminUserAccessInput
): Promise<{ error?: string }> {
  const actor = await getProfile();
  if (!actor) {
    return { error: "Not signed in" };
  }
  if (!(await isAdmin(TENANT, PORTAL))) {
    return { error: "Unauthorized" };
  }

  const admin = createAdminClient();
  const { data: target, error: fetchErr } = await admin
    .from("profiles")
    .select("role, tenant, portal")
    .eq("id", userId)
    .single();

  if (fetchErr || !target) {
    return { error: "User not found" };
  }

  if (target.tenant !== TENANT || target.portal !== PORTAL) {
    return { error: "User is not in this tenant scope." };
  }

  if (target.role === "super_admin") {
    return { error: "Cannot edit Platform Owner accounts here." };
  }

  const actorIsSuperAdmin = actor.role === "super_admin";
  if (target.role === "tenant_admin" && !actorIsSuperAdmin) {
    return { error: "Only Platform Owner can edit tenant admin accounts." };
  }

  let effectiveRole: string;
  if (target.role === "tenant_admin") {
    effectiveRole = "tenant_admin";
  } else {
    effectiveRole = data.role;
  }

  const { error } = await admin
    .from("profiles")
    .update({
      role: effectiveRole,
      is_admin: data.is_admin,
      is_mentor: data.is_mentor,
      phone: data.phone ?? null,
      mentor_phone: data.mentor_phone ?? null,
      mentor_contact_email: data.mentor_contact_email ?? null,
      employee_number: data.employee_number ?? null,
    })
    .eq("id", userId);

  if (error) {
    return { error: error.message };
  }

  const menteeEmpTrimmed = data.mentee_employee_number?.trim() ?? "";
  if (data.is_mentor && menteeEmpTrimmed) {
    const syncResult = await upsertMentorAssignmentFromSuperAdmin(admin, {
      mentorUserId: userId,
      menteeEmployeeNumber: menteeEmpTrimmed,
      tenant: TENANT,
    });
    if ("error" in syncResult) {
      return { error: syncResult.error };
    }
  }

  revalidatePath(USERS_PAGE);
  return {};
}
