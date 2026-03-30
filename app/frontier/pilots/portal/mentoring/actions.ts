"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfile, type Profile } from "@/lib/profile";
import { fetchAuthLastSignInAtByUserId } from "@/lib/super-admin/auth-last-sign-in-map";
import { ROLES, type Role } from "@/lib/rbac";
import { linkMenteeToAssignments } from "@/lib/mentoring/link-mentee-to-assignments";
import { linkMentorToPreload } from "@/lib/mentoring/link-mentor-to-preload";
import { isMentorWorkspaceStatus } from "@/lib/mentoring/mentor-workspace-status";
import { isValidMentorNextCheckInYmd } from "@/lib/mentoring/mentor-next-check-in-date";
import {
  pickNextMilestoneAmongPending,
  sortMilestonesByProgramOrder,
} from "@/lib/mentoring/milestone-program-order";

export type MentorshipProgramRequestType =
  | "new_hire_help"
  | "mentor_interest"
  | "mentor_no_mentees";

/**
 * Pilot self-service: creates a row visible to tenant / platform admins via service role (no user SELECT RLS).
 */
export async function submitMentorshipProgramRequest(
  type: MentorshipProgramRequestType,
  _formData: FormData,
): Promise<void> {
  const profile = await getProfile();
  if (!profile) {
    redirect("/frontier/pilots/login?error=not_signed_in");
  }

  let message = "";
  if (type === "new_hire_help") {
    message = "User appears to be a new hire without a mentor assigned.";
  } else if (type === "mentor_interest") {
    message = "User expressed interest in becoming a mentor.";
  } else {
    message = "Mentor has no mentees assigned.";
  }

  const supabase = await createClient();
  const { error } = await supabase.from("mentorship_program_requests").insert({
    tenant: profile.tenant,
    portal: profile.portal,
    user_id: profile.id,
    request_type: type,
    message,
  });

  if (error) {
    redirect("/frontier/pilots/portal/mentoring?request=error");
  }

  revalidatePath("/frontier/pilots/portal/mentoring");
  revalidatePath("/frontier/pilots/admin/mentoring");
  revalidatePath("/super-admin/mentoring");
  redirect("/frontier/pilots/portal/mentoring?request=submitted");
}

export type MentorAssignmentRow = {
  id: string;
  mentor_user_id: string;
  mentee_user_id: string;
  isMentorView: boolean;
  mentee_full_name: string | null;
  mentor_full_name: string | null;
  /** Preferred contact for mentee card; never login email. */
  mentor_contact_email: string | null;
  /** mentor_phone if set, else profiles.phone. */
  mentor_phone_display: string | null;
  next_milestone_label: string | null;
  next_milestone_due_date: string | null;
  last_interaction_at: string | null;
  mentee_date_of_hire: string | null;
  mentee_status: string | null;
  /** From mentee profile; null until first-use welcome onboarding completed. */
  mentee_welcome_modal_version_seen: number | null;
  /**
   * Mentee Auth `last_sign_in_at` when `auth.admin.listUsers` succeeded for this load and the row has a linked
   * `mentee_user_id`. Omitted if listing failed (same pattern as Frontier admin users).
   */
  mentee_last_sign_in_at?: string | null;
  /** Mentor-only workspace; always null when `isMentorView` is false (not loaded for mentees). */
  mentor_workspace_mentoring_status: string | null;
  mentor_workspace_private_note: string | null;
  mentor_workspace_next_check_in_date: string | null;
  /** Active mentee rows only: mentor `Profile` fields for `SharedMentoringCardPreview` (same shape as settings preview). */
  mentor_shared_card_profile: Profile | null;
};

const TODAY_STR = new Date().toISOString().slice(0, 10);

function mentorProfileForSharedMentoringCard(
  mentorUserId: string,
  m: {
    full_name: string | null;
    position: string | null;
    base_airport: string | null;
    home_airport: string | null;
    date_of_hire: string | null;
    phone: string | null;
    mentor_phone: string | null;
    mentor_contact_email: string | null;
    tenant: string | null;
    portal: string | null;
    role: string | null;
    is_admin: boolean | null;
    is_mentor: boolean | null;
  },
  viewerPortal: string
): Profile {
  const roleStr = (m.role ?? "").trim();
  const role: Role = ROLES.includes(roleStr as Role) ? (roleStr as Role) : "pilot";
  return {
    id: mentorUserId,
    email: null,
    tenant: (m.tenant ?? "frontier").trim() || "frontier",
    portal: (m.portal ?? viewerPortal).trim() || viewerPortal,
    role,
    full_name: m.full_name,
    position: (m.position as Profile["position"]) ?? null,
    base_airport: m.base_airport,
    home_airport: m.home_airport,
    date_of_hire: m.date_of_hire,
    phone: m.phone,
    mentor_phone: m.mentor_phone,
    mentor_contact_email: m.mentor_contact_email,
    is_admin: m.is_admin ?? undefined,
    is_mentor: m.is_mentor ?? undefined,
    created_at: "1970-01-01T00:00:00.000Z",
    updated_at: "1970-01-01T00:00:00.000Z",
  };
}

/** Parses `get_mentor_profile_for_mentee_card` JSON when PostgREST mentor embed is null for mentees. */
function mentorProfileFromMenteeCardRpc(data: unknown): Parameters<typeof mentorProfileForSharedMentoringCard>[1] | null {
  if (data == null || typeof data !== "object" || Array.isArray(data)) return null;
  const o = data as Record<string, unknown>;
  const s = (k: string): string | null => {
    const v = o[k];
    if (v == null) return null;
    if (typeof v === "string") return v;
    return String(v);
  };
  const b = (k: string): boolean | null => {
    const v = o[k];
    if (v == null) return null;
    if (typeof v === "boolean") return v;
    return null;
  };
  const doh = o.date_of_hire;
  const date_of_hire =
    doh == null ? null : typeof doh === "string" ? doh.trim().slice(0, 10) : String(doh).slice(0, 10);
  return {
    full_name: s("full_name"),
    position: s("position"),
    base_airport: s("base_airport"),
    home_airport: s("home_airport"),
    date_of_hire: date_of_hire && /^\d{4}-\d{2}-\d{2}$/.test(date_of_hire) ? date_of_hire : null,
    phone: s("phone"),
    mentor_phone: s("mentor_phone"),
    mentor_contact_email: s("mentor_contact_email"),
    tenant: s("tenant"),
    portal: s("portal"),
    role: s("role"),
    is_admin: b("is_admin"),
    is_mentor: b("is_mentor"),
  };
}

/** Calendar YMD + N days (UTC noon anchor), ISO YYYY-MM-DD. */
function addDaysToYmd(ymd: string, days: number): string | null {
  const t = ymd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * IOE `due_date` must be at least Type Rating `completed_date` + 14 days (same as completion cascade).
 * Fixes stale hire-schedule IOE dues when TR is already marked complete (e.g. imported / pre-cascade data).
 */
async function repairIoeDueDateAfterTypeRatingIfNeeded(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assignmentId: string,
  milestones: MenteeMilestoneRow[]
): Promise<boolean> {
  const tr = milestones.find((m) => m.milestone_type === "type_rating");
  const oe = milestones.find((m) => m.milestone_type === "oe_complete");
  if (!tr || !oe) return false;

  const trCd = String(tr.completed_date ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trCd)) return false;

  const oeCompleted = String(oe.completed_date ?? "").trim();
  if (oeCompleted !== "") return false;

  const minOeDue = addDaysToYmd(trCd, 14);
  if (!minOeDue) return false;

  const oeDue = String(oe.due_date ?? "").trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(oeDue) && oeDue >= minOeDue) return false;

  const { error } = await supabase.rpc("apply_mentorship_milestone_downstream_due_cascade", {
    p_assignment_id: assignmentId,
    p_completed_milestone_type: "type_rating",
    p_completed_date: trCd,
  });
  if (error) {
    console.error("[mentoring] repair IOE due after type rating failed:", error.message);
    return false;
  }
  return true;
}

/** Resolves optional user-supplied calendar date to YYYY-MM-DD; empty uses UTC today. */
function resolveMilestoneCompletedDate(
  completedDate: string | null | undefined
): { date: string } | { error: string } {
  const trimmed = completedDate?.trim() ?? "";
  if (!trimmed) {
    return { date: new Date().toISOString().slice(0, 10) };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return { error: "Invalid completion date." };
  }
  const t = new Date(`${trimmed}T12:00:00.000Z`).getTime();
  if (Number.isNaN(t)) {
    return { error: "Invalid completion date." };
  }
  return { date: trimmed };
}

/** ISO 8601 instant string for `completed_at` (timestamptz). */
function resolveMilestoneCompletedAtIso(
  completedAtIso: string | null | undefined
): { iso: string } | { error: string } {
  const t = (completedAtIso ?? "").trim();
  if (!t) {
    return { error: "Completion date and time required." };
  }
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) {
    return { error: "Invalid completion date and time." };
  }
  return { iso: new Date(ms).toISOString() };
}

function interactionTimestampToMs(s: string): number {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return new Date(`${t}T12:00:00.000Z`).getTime();
  }
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? -Infinity : ms;
}

/** Latest stored moment among assignment column, interaction rows, notes, milestone completions. */
function latestInteractionTimestamp(...candidates: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const c of candidates) {
    const raw = c?.trim();
    if (!raw) continue;
    const ms = interactionTimestampToMs(raw);
    if (ms > bestMs) {
      bestMs = ms;
      best = raw;
    }
  }
  return best;
}

/** Calendar date from mentor check-in (`occurred_on` YMD), not `created_at`. */
function checkInOccurredOnToInteractionInstant(occurredOn: string | null | undefined): string | null {
  const ymd = String(occurredOn ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  if (Number.isNaN(new Date(`${ymd}T12:00:00.000Z`).getTime())) return null;
  return `${ymd}T12:00:00.000Z`;
}

function milestoneCompletionTimestampForLastInteraction(m: {
  completed_date: string | null;
  completed_at: string | null;
}): string | null {
  if (!m.completed_date) return null;
  const at = m.completed_at?.trim();
  if (at) return at;
  const ymd = String(m.completed_date).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return `${ymd}T12:00:00.000Z`;
  return null;
}

/** Get mentor assignments for the current user (as mentor). Returns mentee profile data joined.
 * Next milestone: first incomplete row in fixed program order (`lib/mentoring/milestone-program-order.ts`).
 * Last Interaction: latest of mentor_assignments.last_interaction_at, mentorship_interactions,
 * completed milestones, mentorship_notes, and mentorship_check_ins (`occurred_on`, not created_at).
 * Hire date from mentor_assignments.hire_date.
 */
export async function getMentorAssignments(): Promise<{
  assignments: MentorAssignmentRow[];
  error?: string;
}> {
  const profile = await getProfile();
  if (!profile) return { assignments: [], error: "Not signed in" };

  await linkMenteeToAssignments(profile.id, profile.employee_number);
  if (profile.employee_number?.trim() && profile.tenant?.trim()) {
    await linkMentorToPreload(profile.id, profile.employee_number, profile.tenant);
  }

  try {
    const supabase = await createClient();

    // Query 1: mentor_assignments where user is mentor OR mentee + both profiles
    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from("mentor_assignments")
      .select(
        `
        id,
        mentor_user_id,
        mentee_user_id,
        hire_date,
        active,
        assigned_at,
        last_interaction_at,
        mentee_display_name,
        mentee:profiles!mentor_assignments_mentee_user_id_fkey(full_name,welcome_modal_version_seen),
        mentor:profiles!mentor_assignments_mentor_user_id_fkey(full_name,position,base_airport,home_airport,date_of_hire,phone,mentor_phone,mentor_contact_email,tenant,portal,role,is_admin,is_mentor)
      `
      )
      .or(`mentor_user_id.eq.${profile.id},mentee_user_id.eq.${profile.id}`)
      .order("assigned_at", { ascending: true });

    if (assignmentsError) return { assignments: [], error: assignmentsError.message };
    const rows = (assignmentsData ?? []) as unknown as Array<{
      id: string;
      mentor_user_id: string;
      mentee_user_id: string;
      hire_date: string | null;
      active: boolean | null;
      last_interaction_at: string | null;
      mentee_display_name: string | null;
      mentee: { full_name: string | null; welcome_modal_version_seen: number | null } | null;
      mentor: {
        full_name: string | null;
        position: string | null;
        base_airport: string | null;
        home_airport: string | null;
        date_of_hire: string | null;
        phone: string | null;
        mentor_phone: string | null;
        mentor_contact_email: string | null;
        tenant: string | null;
        portal: string | null;
        role: string | null;
        is_admin: boolean | null;
        is_mentor: boolean | null;
      } | null;
    }>;

    if (rows.length === 0) return { assignments: [] };

    const menteeUserIds = [
      ...new Set(
        rows
          .map((r) => r.mentee_user_id?.trim())
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      ),
    ];
    const authSignInMap =
      menteeUserIds.length > 0 ? await fetchAuthLastSignInAtByUserId(createAdminClient()) : null;

    const assignmentIds = rows.map((r) => r.id);

    const rpcMentorByUserId = new Map<string, NonNullable<Parameters<typeof mentorProfileForSharedMentoringCard>[1]>>();
    const mentorIdsNeedingRpc = new Set<string>();
    for (const row of rows) {
      const isMentorViewRow = row.mentor_user_id === profile.id;
      const mentorLooksMissing =
        row.mentor == null || !String(row.mentor.full_name ?? "").trim();
      if (!isMentorViewRow && row.active === true && row.mentor_user_id && mentorLooksMissing) {
        mentorIdsNeedingRpc.add(row.mentor_user_id);
      }
    }
    for (const mentorId of mentorIdsNeedingRpc) {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("get_mentor_profile_for_mentee_card", {
        p_mentor_user_id: mentorId,
      });
      if (rpcErr) continue;
      const parsed = mentorProfileFromMenteeCardRpc(rpcData);
      if (parsed) rpcMentorByUserId.set(mentorId, parsed);
    }

    // Query 2: next upcoming milestone (milestone_type + due_date where completed_date is null)
    const { data: milestonesData } = await supabase
      .from("mentorship_milestones")
      .select("assignment_id, milestone_type, due_date")
      .in("assignment_id", assignmentIds)
      .is("completed_date", null);

    // Query 3: last interaction per assignment (most recent interaction_date)
    const { data: interactionsData } = await supabase
      .from("mentorship_interactions")
      .select("assignment_id, interaction_date")
      .in("assignment_id", assignmentIds)
      .order("interaction_date", { ascending: false });

    const [{ data: completedMilestonesData }, { data: notesActivityData }, { data: checkInsActivityData }] =
      await Promise.all([
        supabase
          .from("mentorship_milestones")
          .select("assignment_id, completed_at, completed_date")
          .in("assignment_id", assignmentIds)
          .not("completed_date", "is", null),
        supabase
          .from("mentorship_notes")
          .select("assignment_id, created_at")
          .in("assignment_id", assignmentIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("mentorship_check_ins")
          .select("assignment_id, occurred_on")
          .in("assignment_id", assignmentIds)
          .order("created_at", { ascending: false }),
      ]);

    // Next milestone: first incomplete in fixed program order (not earliest due_date).
    const pendingByAssignment = new Map<string, { milestone_type: string; due_date: string }[]>();
    for (const m of milestonesData ?? []) {
      const aid = (m as { assignment_id: string }).assignment_id;
      const candidate = {
        milestone_type: (m as { milestone_type: string }).milestone_type ?? "",
        due_date: (m as { due_date: string }).due_date ?? "",
      };
      if (!pendingByAssignment.has(aid)) pendingByAssignment.set(aid, []);
      pendingByAssignment.get(aid)!.push(candidate);
    }
    const nextMilestoneByAssignment = new Map<string, { milestone_type: string; due_date: string }>();
    for (const [aid, cands] of pendingByAssignment) {
      const best = pickNextMilestoneAmongPending(cands);
      if (best) nextMilestoneByAssignment.set(aid, best);
    }

    // Build last interaction map: most recent per assignment
    const lastInteractionByAssignment = new Map<string, string>();
    for (const i of interactionsData ?? []) {
      const aid = (i as { assignment_id: string }).assignment_id;
      if (!lastInteractionByAssignment.has(aid)) {
        lastInteractionByAssignment.set(aid, (i as { interaction_date: string }).interaction_date);
      }
    }

    const latestMilestoneByAssignment = new Map<string, string>();
    for (const m of completedMilestonesData ?? []) {
      const aid = (m as { assignment_id: string }).assignment_id;
      const ts = milestoneCompletionTimestampForLastInteraction(
        m as { completed_date: string; completed_at: string | null }
      );
      if (!ts) continue;
      const prev = latestMilestoneByAssignment.get(aid);
      if (!prev || interactionTimestampToMs(ts) > interactionTimestampToMs(prev)) {
        latestMilestoneByAssignment.set(aid, ts);
      }
    }

    const latestNoteByAssignment = new Map<string, string>();
    for (const n of notesActivityData ?? []) {
      const aid = (n as { assignment_id: string }).assignment_id;
      if (!latestNoteByAssignment.has(aid)) {
        latestNoteByAssignment.set(aid, (n as { created_at: string }).created_at);
      }
    }

    const latestCheckInByAssignment = new Map<string, string>();
    for (const c of checkInsActivityData ?? []) {
      const row = c as { assignment_id: string; occurred_on?: string | null };
      const aid = row.assignment_id;
      const ts = checkInOccurredOnToInteractionInstant(row.occurred_on);
      if (!ts) continue;
      const prev = latestCheckInByAssignment.get(aid);
      if (!prev || interactionTimestampToMs(ts) > interactionTimestampToMs(prev)) {
        latestCheckInByAssignment.set(aid, ts);
      }
    }

    const mentorAssignmentIds = rows
      .filter((r) => r.mentor_user_id === profile.id)
      .map((r) => r.id);
    const workspaceByAssignment = new Map<
      string,
      { mentoring_status: string; private_note: string; next_check_in_date: string | null }
    >();
    if (mentorAssignmentIds.length > 0) {
      const { data: workspaceRows } = await supabase
        .from("mentorship_mentor_workspace")
        .select("assignment_id, mentoring_status, private_note, next_check_in_date")
        .in("assignment_id", mentorAssignmentIds);
      for (const w of workspaceRows ?? []) {
        const wid = (w as { assignment_id: string }).assignment_id;
        workspaceByAssignment.set(wid, {
          mentoring_status: String((w as { mentoring_status: string }).mentoring_status ?? "Active"),
          private_note: String((w as { private_note: string }).private_note ?? ""),
          next_check_in_date: (w as { next_check_in_date: string | null }).next_check_in_date ?? null,
        });
      }
    }

    const assignments: MentorAssignmentRow[] = rows.map((row) => {
      const isMentorView = row.mentor_user_id === profile.id;
      const next = nextMilestoneByAssignment.get(row.id);
      const lastInt = latestInteractionTimestamp(
        row.last_interaction_at,
        lastInteractionByAssignment.get(row.id),
        latestMilestoneByAssignment.get(row.id),
        latestNoteByAssignment.get(row.id),
        latestCheckInByAssignment.get(row.id)
      );
      const embedM = row.mentor;
      const rpcM = rpcMentorByUserId.get(row.mentor_user_id) ?? null;
      const m =
        embedM && String(embedM.full_name ?? "").trim()
          ? embedM
          : rpcM ?? embedM ?? null;
      const mp = m?.mentor_phone?.trim();
      const p = m?.phone?.trim();
      const mentorPhone = mp || p || null;
      const mentorEmail = m?.mentor_contact_email?.trim() || null;
      const ws = isMentorView ? workspaceByAssignment.get(row.id) : undefined;
      const mentor_shared_card_profile =
        !isMentorView && row.active === true && row.mentor_user_id && m
          ? mentorProfileForSharedMentoringCard(row.mentor_user_id, m, profile.portal)
          : null;
      return {
        id: row.id,
        mentor_user_id: row.mentor_user_id,
        mentee_user_id: row.mentee_user_id,
        isMentorView,
        mentee_full_name:
          row.mentee?.full_name?.trim() || row.mentee_display_name?.trim() || null,
        mentor_full_name: m?.full_name ?? null,
        mentor_contact_email: mentorEmail,
        mentor_phone_display: mentorPhone,
        next_milestone_label: next?.milestone_type ?? null,
        next_milestone_due_date: next?.due_date ?? null,
        last_interaction_at: lastInt ?? null,
        mentee_date_of_hire: row.hire_date ?? null,
        mentee_status: row.active === true ? "active" : "inactive",
        mentee_welcome_modal_version_seen: row.mentee?.welcome_modal_version_seen ?? null,
        ...(authSignInMap != null && row.mentee_user_id?.trim()
          ? { mentee_last_sign_in_at: authSignInMap.get(row.mentee_user_id) ?? null }
          : {}),
        mentor_workspace_mentoring_status: ws ? ws.mentoring_status : null,
        mentor_workspace_private_note: ws ? ws.private_note : null,
        mentor_workspace_next_check_in_date: ws?.next_check_in_date ?? null,
        mentor_shared_card_profile,
      };
    });

    return { assignments };
  } catch (e) {
    return {
      assignments: [],
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

export type MenteeDetailRow = {
  id: string;
  mentor_user_id: string;
  mentee_user_id: string;
  isMentorView: boolean;
  mentee_full_name: string | null;
  mentor_full_name: string | null;
  mentor_contact_email: string | null;
  mentor_phone_display: string | null;
  hire_date: string | null;
  active: boolean;
  next_milestone_label: string | null;
  next_milestone_due_date: string | null;
  last_interaction_at: string | null;
  /** From linked profile, else assignment `employee_number` when pending. */
  mentee_employee_number: string | null;
  mentee_personal_email: string | null;
  mentee_phone: string | null;
  /** From linked mentee profile; used for onboarding vs active when Auth sign-in is known. */
  mentee_welcome_modal_version_seen: number | null;
  /** Mentee Auth `last_sign_in_at` when `getUserById` succeeded; omitted on failure (Frontier admin users pattern). */
  mentee_last_sign_in_at?: string | null;
  /** Mentee profile IATA crew base; only meaningful after linked profile + welcome completed. */
  mentee_base_airport: string | null;
  /** Mentor-only workspace; null for mentee view or when row missing. */
  mentor_workspace_mentoring_status: string | null;
  mentor_workspace_next_check_in_date: string | null;
};

export type MenteeMilestoneRow = {
  assignment_id: string;
  milestone_type: string;
  due_date: string;
  completed_date: string | null;
  completion_note: string | null;
  completed_at: string | null;
};

export type MentorshipCheckInRow = {
  id: string;
  occurred_on: string;
  note: string;
  created_at: string;
};

/** Get mentee detail for a single assignment. Verifies current user is the mentor. */
export async function getMenteeDetail(assignmentId: string): Promise<{
  detail: MenteeDetailRow | null;
  milestones: MenteeMilestoneRow[];
  checkIns: MentorshipCheckInRow[];
  error?: string;
}> {
  const profile = await getProfile();
  if (!profile) return { detail: null, milestones: [], checkIns: [], error: "Not signed in" };

  await linkMenteeToAssignments(profile.id, profile.employee_number);
  if (profile.employee_number?.trim() && profile.tenant?.trim()) {
    await linkMentorToPreload(profile.id, profile.employee_number, profile.tenant);
  }

  try {
    const supabase = await createClient();

    const { data: assignmentData, error: assignmentError } = await supabase
      .from("mentor_assignments")
      .select(
        `
        id,
        mentor_user_id,
        mentee_user_id,
        hire_date,
        active,
        last_interaction_at,
        mentee_display_name,
        employee_number,
        mentee_personal_email,
        mentee_phone,
        mentee:profiles!mentor_assignments_mentee_user_id_fkey(full_name,employee_number,personal_email,phone,welcome_modal_version_seen,base_airport),
        mentor:profiles!mentor_assignments_mentor_user_id_fkey(full_name,phone,mentor_phone,mentor_contact_email)
      `
      )
      .eq("id", assignmentId)
      .or(`mentor_user_id.eq.${profile.id},mentee_user_id.eq.${profile.id}`)
      .single();

    if (assignmentError || !assignmentData) {
      return { detail: null, milestones: [], checkIns: [], error: assignmentError?.message ?? "Not found" };
    }

    const row = assignmentData as unknown as {
      id: string;
      mentor_user_id: string;
      mentee_user_id: string;
      hire_date: string | null;
      active: boolean | null;
      last_interaction_at: string | null;
      mentee_display_name: string | null;
      employee_number: string | null;
      mentee_personal_email: string | null;
      mentee_phone: string | null;
      mentee: {
        full_name: string | null;
        employee_number: string | null;
        personal_email: string | null;
        phone: string | null;
        welcome_modal_version_seen: number | null;
        base_airport: string | null;
      } | null;
      mentor: {
        full_name: string | null;
        phone: string | null;
        mentor_phone: string | null;
        mentor_contact_email: string | null;
      } | null;
    };

    const [milestonesResInitial, interactionsRes, notesRes, checkInsRes] = await Promise.all([
      supabase
        .from("mentorship_milestones")
        .select("assignment_id, milestone_type, due_date, completed_date, completion_note, completed_at")
        .eq("assignment_id", assignmentId)
        .order("due_date", { ascending: true }),
      supabase
        .from("mentorship_interactions")
        .select("interaction_date")
        .eq("assignment_id", assignmentId)
        .order("interaction_date", { ascending: false })
        .limit(1),
      supabase
        .from("mentorship_notes")
        .select("created_at")
        .eq("assignment_id", assignmentId)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("mentorship_check_ins")
        .select("id, occurred_on, note, created_at")
        .eq("assignment_id", assignmentId)
        .order("occurred_on", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    let milestonesRaw: MenteeMilestoneRow[];
    if (!milestonesResInitial.error && milestonesResInitial.data) {
      milestonesRaw = milestonesResInitial.data as MenteeMilestoneRow[];
    } else if (milestonesResInitial.error) {
      const fallback = await supabase
        .from("mentorship_milestones")
        .select("assignment_id, milestone_type, due_date, completed_date, completion_note")
        .eq("assignment_id", assignmentId)
        .order("due_date", { ascending: true });
      milestonesRaw =
        fallback.error || !fallback.data
          ? []
          : (fallback.data as Omit<MenteeMilestoneRow, "completed_at">[]).map((row) => ({
              ...row,
              completed_at: null,
            }));
    } else {
      milestonesRaw = [];
    }

    const repairedIoeDue = await repairIoeDueDateAfterTypeRatingIfNeeded(
      supabase,
      assignmentId,
      milestonesRaw
    );
    if (repairedIoeDue) {
      const { data: refetched, error: refetchErr } = await supabase
        .from("mentorship_milestones")
        .select("assignment_id, milestone_type, due_date, completed_date, completion_note, completed_at")
        .eq("assignment_id", assignmentId);
      if (!refetchErr && refetched) {
        milestonesRaw = refetched as MenteeMilestoneRow[];
      }
    }

    const milestones = sortMilestonesByProgramOrder(milestonesRaw);
    const checkIns: MentorshipCheckInRow[] =
      !checkInsRes.error && checkInsRes.data
        ? (checkInsRes.data as MentorshipCheckInRow[])
        : [];

    const fromInteractions =
      (interactionsRes.data?.[0] as { interaction_date: string } | undefined)?.interaction_date ?? null;
    const fromNotes =
      (notesRes.data?.[0] as { created_at: string } | undefined)?.created_at ?? null;
    let fromCheckIns: string | null = null;
    for (const c of checkIns) {
      const ts = checkInOccurredOnToInteractionInstant(c.occurred_on);
      if (!ts) continue;
      if (!fromCheckIns || interactionTimestampToMs(ts) > interactionTimestampToMs(fromCheckIns)) {
        fromCheckIns = ts;
      }
    }
    let latestFromMilestone: string | null = null;
    for (const m of milestones) {
      const ts = milestoneCompletionTimestampForLastInteraction(m);
      if (!ts) continue;
      if (
        !latestFromMilestone ||
        interactionTimestampToMs(ts) > interactionTimestampToMs(latestFromMilestone)
      ) {
        latestFromMilestone = ts;
      }
    }
    const lastInteraction = latestInteractionTimestamp(
      row.last_interaction_at,
      fromInteractions,
      latestFromMilestone,
      fromNotes,
      fromCheckIns
    );

    const nextUpcoming = milestones.find((m) => !m.completed_date);

    const isMentorView = row.mentor_user_id === profile.id;

    let mentorWorkspaceMentoringStatus: string | null = null;
    let mentorWorkspaceNextCheckInDate: string | null = null;
    if (isMentorView) {
      const { data: ws } = await supabase
        .from("mentorship_mentor_workspace")
        .select("mentoring_status, next_check_in_date")
        .eq("assignment_id", assignmentId)
        .maybeSingle();
      if (ws) {
        mentorWorkspaceMentoringStatus = String(
          (ws as { mentoring_status: string }).mentoring_status ?? ""
        ).trim() || null;
        mentorWorkspaceNextCheckInDate =
          (ws as { next_check_in_date: string | null }).next_check_in_date ?? null;
      }
    }
    const mentorProf = row.mentor;
    const mp = mentorProf?.mentor_phone?.trim();
    const p = mentorProf?.phone?.trim();
    const mentorPhone = mp || p || null;
    const mentorEmail = mentorProf?.mentor_contact_email?.trim() || null;
    const menteeProf = row.mentee;
    let menteeAuthLastSignIn: string | null | undefined;
    const menteeIdForAuth = row.mentee_user_id?.trim();
    if (menteeIdForAuth) {
      const admin = createAdminClient();
      const { data: menteeAuthData, error: menteeAuthErr } = await admin.auth.admin.getUserById(menteeIdForAuth);
      if (!menteeAuthErr && menteeAuthData?.user) {
        menteeAuthLastSignIn = menteeAuthData.user.last_sign_in_at ?? null;
      }
    }
    const empFromProfile = menteeProf?.employee_number?.trim() || null;
    const empFromAssignment = row.employee_number?.trim() || null;
    const emailFromProfile = menteeProf?.personal_email?.trim() || null;
    const emailFromAssignment = row.mentee_personal_email?.trim() || null;
    const phoneFromProfile = menteeProf?.phone?.trim() || null;
    const phoneFromAssignment = row.mentee_phone?.trim() || null;
    const detail: MenteeDetailRow = {
      id: row.id,
      mentor_user_id: row.mentor_user_id,
      mentee_user_id: row.mentee_user_id,
      isMentorView,
      mentee_full_name:
        row.mentee?.full_name?.trim() || row.mentee_display_name?.trim() || null,
      mentor_full_name: row.mentor?.full_name ?? null,
      mentor_contact_email: mentorEmail,
      mentor_phone_display: mentorPhone,
      hire_date: row.hire_date ?? null,
      active: row.active === true,
      next_milestone_label: nextUpcoming?.milestone_type ?? null,
      next_milestone_due_date: nextUpcoming?.due_date ?? null,
      last_interaction_at: lastInteraction,
      mentee_employee_number: empFromProfile || empFromAssignment || null,
      mentee_personal_email: emailFromProfile || emailFromAssignment || null,
      mentee_phone: phoneFromProfile || phoneFromAssignment || null,
      mentee_welcome_modal_version_seen: row.mentee?.welcome_modal_version_seen ?? null,
      ...(menteeAuthLastSignIn !== undefined ? { mentee_last_sign_in_at: menteeAuthLastSignIn } : {}),
      mentee_base_airport: row.mentee?.base_airport?.trim() || null,
      mentor_workspace_mentoring_status: mentorWorkspaceMentoringStatus,
      mentor_workspace_next_check_in_date: mentorWorkspaceNextCheckInDate,
    };

    return { detail, milestones, checkIns };
  } catch (e) {
    return {
      detail: null,
      milestones: [],
      checkIns: [],
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

export async function createMentorshipCheckIn(
  assignmentId: string,
  occurredOnYmd: string,
  note: string
): Promise<{ ok?: true; error?: string }> {
  const trimmedNote = note.trim();
  if (!trimmedNote) return { error: "Note cannot be empty." };

  const ymd = occurredOnYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return { error: "Invalid date." };
  if (Number.isNaN(new Date(`${ymd}T12:00:00.000Z`).getTime())) {
    return { error: "Invalid date." };
  }

  const profile = await getProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();

  const { data: row, error: fetchErr } = await supabase
    .from("mentor_assignments")
    .select("id, mentor_user_id")
    .eq("id", assignmentId)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!row?.id) return { error: "Assignment not found." };
  if (row.mentor_user_id !== profile.id) {
    return { error: "Only the assigned mentor can add check-ins." };
  }

  const { error: insErr } = await supabase.from("mentorship_check_ins").insert({
    assignment_id: assignmentId,
    occurred_on: ymd,
    note: trimmedNote,
  });

  if (insErr) return { error: insErr.message };

  revalidatePath("/frontier/pilots/portal/mentoring");
  revalidatePath(`/frontier/pilots/portal/mentoring/${assignmentId}`);
  return { ok: true };
}

export async function updateMentorshipCheckIn(
  assignmentId: string,
  checkInId: string,
  occurredOnYmd: string,
  note: string
): Promise<{ ok?: true; error?: string }> {
  const trimmedNote = note.trim();
  if (!trimmedNote) return { error: "Note cannot be empty." };

  const ymd = occurredOnYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return { error: "Invalid date." };
  if (Number.isNaN(new Date(`${ymd}T12:00:00.000Z`).getTime())) {
    return { error: "Invalid date." };
  }

  const profile = await getProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();

  const { data: assignment, error: assignmentErr } = await supabase
    .from("mentor_assignments")
    .select("id, mentor_user_id")
    .eq("id", assignmentId)
    .maybeSingle();

  if (assignmentErr) return { error: assignmentErr.message };
  if (!assignment?.id) return { error: "Assignment not found." };
  if (assignment.mentor_user_id !== profile.id) {
    return { error: "Only the assigned mentor can edit check-ins." };
  }

  const { data: existing, error: fetchCiErr } = await supabase
    .from("mentorship_check_ins")
    .select("id, assignment_id")
    .eq("id", checkInId)
    .maybeSingle();

  if (fetchCiErr) return { error: fetchCiErr.message };
  if (!existing?.id || existing.assignment_id !== assignmentId) {
    return { error: "Check-in not found." };
  }

  const { error: updErr } = await supabase
    .from("mentorship_check_ins")
    .update({ occurred_on: ymd, note: trimmedNote })
    .eq("id", checkInId);

  if (updErr) return { error: updErr.message };

  revalidatePath("/frontier/pilots/portal/mentoring");
  revalidatePath(`/frontier/pilots/portal/mentoring/${assignmentId}`);
  return { ok: true };
}

export async function deleteMentorshipCheckIn(
  assignmentId: string,
  checkInId: string
): Promise<{ ok?: true; error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Not signed in" };

  const supabase = await createClient();

  const { data: assignment, error: assignmentErr } = await supabase
    .from("mentor_assignments")
    .select("id, mentor_user_id")
    .eq("id", assignmentId)
    .maybeSingle();

  if (assignmentErr) return { error: assignmentErr.message };
  if (!assignment?.id) return { error: "Assignment not found." };
  if (assignment.mentor_user_id !== profile.id) {
    return { error: "Only the assigned mentor can delete check-ins." };
  }

  const { data: existing, error: fetchCiErr } = await supabase
    .from("mentorship_check_ins")
    .select("id, assignment_id")
    .eq("id", checkInId)
    .maybeSingle();

  if (fetchCiErr) return { error: fetchCiErr.message };
  if (!existing?.id || existing.assignment_id !== assignmentId) {
    return { error: "Check-in not found." };
  }

  const { error: delErr } = await supabase.from("mentorship_check_ins").delete().eq("id", checkInId);

  if (delErr) return { error: delErr.message };

  revalidatePath("/frontier/pilots/portal/mentoring");
  revalidatePath(`/frontier/pilots/portal/mentoring/${assignmentId}`);
  return { ok: true };
}

function milestoneCompletionErrorMessage(raw: string): string {
  if (!raw) return "Something went wrong. Please try again.";

  const msg = raw.toLowerCase();

  if (
    msg.includes("cannot set completed_date") ||
    msg.includes("is not completed") ||
    msg.includes("requires predecessor row")
  ) {
    return "Complete the previous milestone first.";
  }

  if (msg.includes("completed_date") && msg.includes("before predecessor")) {
    return "This milestone date cannot be earlier than the previous completed milestone.";
  }

  if (
    msg.includes("due_date") &&
    msg.includes("before predecessor") &&
    msg.includes("completed_date")
  ) {
    return "This milestone date conflicts with a previously completed milestone.";
  }

  if (
    msg.includes("due_date") &&
    msg.includes("before predecessor") &&
    msg.includes("due_date")
  ) {
    return "Timeline updated dates conflict with an earlier milestone.";
  }

  if (
    msg.includes("not signed in") ||
    msg.includes("assignment not found") ||
    msg.includes("milestone not found")
  ) {
    return "Unable to save changes. Please refresh and try again.";
  }

  if (msg.includes("missing oe_complete") && msg.includes("generate missing milestones")) {
    return "IOE Complete milestone is missing for this assignment. A platform admin should run “Generate missing milestones” on the super-admin Mentoring page, then try again.";
  }

  return raw; // fallback for debugging
}

export type MilestoneCompleteFormState = { error: string | null };

/** For `useActionState` on the mentoring detail page; delegates to `completeMentorshipMilestone`. */
export async function completeMentorshipMilestoneFormState(
  _prev: MilestoneCompleteFormState,
  formData: FormData
): Promise<MilestoneCompleteFormState> {
  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  const milestoneType = String(formData.get("milestoneType") ?? "").trim();
  const completedDate = String(formData.get("completedDate") ?? "").trim();
  const completionNote = String(formData.get("completionNote") ?? "");
  const result = await completeMentorshipMilestone(
    assignmentId,
    milestoneType,
    completedDate || null,
    completionNote
  );
  if (result.error) {
    return { error: result.error };
  }
  return { error: null };
}

export async function completeMentorshipMilestone(
  assignmentId: string,
  milestoneType: string,
  completedDate?: string | null,
  completionNote?: string | null,
  completedAtIso?: string | null
): Promise<{ ok?: true; error?: string }> {
  const aid = assignmentId.trim();
  const mtype = milestoneType.trim();
  if (!aid) return { error: "Assignment not found." };
  if (!mtype) return { error: "Milestone not found." };

  const resolved = resolveMilestoneCompletedDate(completedDate);
  if ("error" in resolved) return { error: resolved.error };

  let completedAtValue: string | null = null;
  const rawAt = (completedAtIso ?? "").trim();
  if (rawAt) {
    const atRes = resolveMilestoneCompletedAtIso(rawAt);
    if ("error" in atRes) return { error: atRes.error };
    completedAtValue = atRes.iso;
  } else {
    completedAtValue = `${resolved.date}T12:00:00.000Z`;
  }

  const noteTrim = (completionNote ?? "").trim();
  const completionNoteValue = noteTrim.length > 0 ? noteTrim : null;

  const profile = await getProfile();
  if (!profile) return { error: "Not signed in" };

  await linkMenteeToAssignments(profile.id, profile.employee_number);
  if (profile.employee_number?.trim() && profile.tenant?.trim()) {
    await linkMentorToPreload(profile.id, profile.employee_number, profile.tenant);
  }

  const supabase = await createClient();

  const { error: rpcErr } = await supabase.rpc("complete_mentorship_milestone_with_cascade", {
    p_assignment_id: aid,
    p_milestone_type: mtype,
    p_completed_date: resolved.date,
    p_completion_note: completionNoteValue,
    p_completed_at: completedAtValue,
  });

  if (rpcErr) return { error: milestoneCompletionErrorMessage(rpcErr.message) };

  revalidatePath("/frontier/pilots/portal/mentoring");
  revalidatePath(`/frontier/pilots/portal/mentoring/${aid}`);
  return { ok: true };
}

/** Mentor only: change `completion_note` and/or `completed_date` + `completed_at` for an already-completed milestone. */
export async function updateCompletedMentorshipMilestone(
  assignmentId: string,
  milestoneType: string,
  completedDate?: string | null,
  completionNote?: string | null
): Promise<{ ok?: true; error?: string }> {
  const aid = assignmentId.trim();
  const mtype = milestoneType.trim();
  if (!aid) return { error: "Assignment not found." };
  if (!mtype) return { error: "Milestone not found." };

  const resolved = resolveMilestoneCompletedDate(completedDate);
  if ("error" in resolved) return { error: resolved.error };

  const noteTrim = (completionNote ?? "").trim();
  const completionNoteValue = noteTrim.length > 0 ? noteTrim : null;
  const completedAtValue = `${resolved.date}T12:00:00.000Z`;

  const profile = await getProfile();
  if (!profile) return { error: "Not signed in" };

  await linkMenteeToAssignments(profile.id, profile.employee_number);
  if (profile.employee_number?.trim() && profile.tenant?.trim()) {
    await linkMentorToPreload(profile.id, profile.employee_number, profile.tenant);
  }

  const supabase = await createClient();

  const { data: assignmentRow, error: assignmentError } = await supabase
    .from("mentor_assignments")
    .select("id, mentor_user_id")
    .eq("id", aid)
    .or(`mentor_user_id.eq.${profile.id},mentee_user_id.eq.${profile.id}`)
    .maybeSingle();

  if (assignmentError) return { error: assignmentError.message };
  if (!assignmentRow?.id) return { error: "Assignment not found." };
  if (assignmentRow.mentor_user_id !== profile.id) {
    return { error: "Only the assigned mentor can edit milestone completion." };
  }

  const { data: milestoneRow, error: milestoneFetchErr } = await supabase
    .from("mentorship_milestones")
    .select("completed_date")
    .eq("assignment_id", aid)
    .eq("milestone_type", mtype)
    .maybeSingle();

  if (milestoneFetchErr) return { error: milestoneFetchErr.message };
  if (!milestoneRow) return { error: "Milestone not found." };
  const existing = milestoneRow.completed_date;
  if (existing == null || String(existing).trim() === "") {
    return { error: "Milestone is not completed yet." };
  }

  const { error: updateErr } = await supabase
    .from("mentorship_milestones")
    .update({
      completed_date: resolved.date,
      completion_note: completionNoteValue,
      completed_at: completedAtValue,
    })
    .eq("assignment_id", aid)
    .eq("milestone_type", mtype);

  if (updateErr) return { error: updateErr.message };

  const { error: cascadeErr } = await supabase.rpc("apply_mentorship_milestone_downstream_due_cascade", {
    p_assignment_id: aid,
    p_completed_milestone_type: mtype,
    p_completed_date: resolved.date,
  });

  if (cascadeErr) return { error: milestoneCompletionErrorMessage(cascadeErr.message) };

  revalidatePath("/frontier/pilots/portal/mentoring");
  revalidatePath(`/frontier/pilots/portal/mentoring/${aid}`);
  return { ok: true };
}

const MENTOR_NOTE_MAX_LEN = 4000;

export async function saveMentorWorkspaceFields(input: {
  assignmentId: string;
  mentoringStatus: string;
  privateNote: string;
  nextCheckInDate: string | null;
}): Promise<{ error?: string }> {
  const profile = await getProfile();
  if (!profile) return { error: "Not signed in." };

  const aid = input.assignmentId.trim();
  if (!aid) return { error: "Invalid assignment." };

  if (!isMentorWorkspaceStatus(input.mentoringStatus)) {
    return { error: "Invalid mentoring status." };
  }

  const note = input.privateNote.slice(0, MENTOR_NOTE_MAX_LEN);
  let nextDate: string | null = input.nextCheckInDate?.trim() || null;
  if (nextDate && !isValidMentorNextCheckInYmd(nextDate)) {
    return { error: "Check-in date must use a year between 1900 and 2100." };
  }

  const supabase = await createClient();
  const { data: row, error: fetchErr } = await supabase
    .from("mentor_assignments")
    .select("id, mentor_user_id")
    .eq("id", aid)
    .maybeSingle();

  if (fetchErr) return { error: fetchErr.message };
  if (!row?.id) return { error: "Assignment not found." };
  if (row.mentor_user_id !== profile.id) {
    return { error: "Only the mentor can update this workspace." };
  }

  const { error: upsertErr } = await supabase.from("mentorship_mentor_workspace").upsert(
    {
      assignment_id: aid,
      mentoring_status: input.mentoringStatus,
      private_note: note,
      next_check_in_date: nextDate,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "assignment_id" }
  );

  if (upsertErr) return { error: upsertErr.message };

  revalidatePath("/frontier/pilots/portal/mentoring");
  return {};
}
