"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { linkMenteeToAssignments } from "@/lib/mentoring/link-mentee-to-assignments";

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
};

const TODAY_STR = new Date().toISOString().slice(0, 10);

/** Get mentor assignments for the current user (as mentor). Returns mentee profile data joined.
 * Next milestone from mentorship_milestones (milestone_type + due_date, completed_date is null).
 * Last interaction from mentorship_interactions (interaction_date).
 * Hire date from mentor_assignments.hire_date.
 */
export async function getMentorAssignments(): Promise<{
  assignments: MentorAssignmentRow[];
  error?: string;
}> {
  const profile = await getProfile();
  if (!profile) return { assignments: [], error: "Not signed in" };

  await linkMenteeToAssignments(profile.id, profile.employee_number);

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
        mentee:profiles!mentor_assignments_mentee_user_id_fkey(full_name),
        mentor:profiles!mentor_assignments_mentor_user_id_fkey(full_name,phone,mentor_phone,mentor_contact_email)
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
      mentee: { full_name: string | null } | null;
      mentor: {
        full_name: string | null;
        phone: string | null;
        mentor_phone: string | null;
        mentor_contact_email: string | null;
      } | null;
    }>;

    if (rows.length === 0) return { assignments: [] };

    const assignmentIds = rows.map((r) => r.id);

    // Query 2: next upcoming milestone (milestone_type + due_date where completed_date is null)
    const { data: milestonesData } = await supabase
      .from("mentorship_milestones")
      .select("assignment_id, milestone_type, due_date")
      .in("assignment_id", assignmentIds)
      .gte("due_date", TODAY_STR)
      .is("completed_date", null)
      .order("due_date", { ascending: true });

    // Query 3: last interaction per assignment (most recent interaction_date)
    const { data: interactionsData } = await supabase
      .from("mentorship_interactions")
      .select("assignment_id, interaction_date")
      .in("assignment_id", assignmentIds)
      .order("interaction_date", { ascending: false });

    // Build next milestone map: one per assignment (first/earliest upcoming)
    const nextMilestoneByAssignment = new Map<string, { milestone_type: string; due_date: string }>();
    for (const m of milestonesData ?? []) {
      const aid = (m as { assignment_id: string }).assignment_id;
      if (!nextMilestoneByAssignment.has(aid)) {
        nextMilestoneByAssignment.set(aid, {
          milestone_type: (m as { milestone_type: string }).milestone_type ?? "",
          due_date: (m as { due_date: string }).due_date ?? "",
        });
      }
    }

    // Build last interaction map: most recent per assignment
    const lastInteractionByAssignment = new Map<string, string>();
    for (const i of interactionsData ?? []) {
      const aid = (i as { assignment_id: string }).assignment_id;
      if (!lastInteractionByAssignment.has(aid)) {
        lastInteractionByAssignment.set(aid, (i as { interaction_date: string }).interaction_date);
      }
    }

    const assignments: MentorAssignmentRow[] = rows.map((row) => {
      const isMentorView = row.mentor_user_id === profile.id;
      const next = nextMilestoneByAssignment.get(row.id);
      const lastInt = lastInteractionByAssignment.get(row.id);
      const m = row.mentor;
      const mp = m?.mentor_phone?.trim();
      const p = m?.phone?.trim();
      const mentorPhone = mp || p || null;
      const mentorEmail = m?.mentor_contact_email?.trim() || null;
      return {
        id: row.id,
        mentor_user_id: row.mentor_user_id,
        mentee_user_id: row.mentee_user_id,
        isMentorView,
        mentee_full_name: row.mentee?.full_name ?? null,
        mentor_full_name: row.mentor?.full_name ?? null,
        mentor_contact_email: mentorEmail,
        mentor_phone_display: mentorPhone,
        next_milestone_label: next?.milestone_type ?? null,
        next_milestone_due_date: next?.due_date ?? null,
        last_interaction_at: lastInt ?? null,
        mentee_date_of_hire: row.hire_date ?? null,
        mentee_status: row.active === true ? "active" : "inactive",
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
};

export type MenteeMilestoneRow = {
  assignment_id: string;
  milestone_type: string;
  due_date: string;
  completed_date: string | null;
};

/** Get mentee detail for a single assignment. Verifies current user is the mentor. */
export async function getMenteeDetail(assignmentId: string): Promise<{
  detail: MenteeDetailRow | null;
  milestones: MenteeMilestoneRow[];
  error?: string;
}> {
  const profile = await getProfile();
  if (!profile) return { detail: null, milestones: [], error: "Not signed in" };

  await linkMenteeToAssignments(profile.id, profile.employee_number);

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
        mentee:profiles!mentor_assignments_mentee_user_id_fkey(full_name),
        mentor:profiles!mentor_assignments_mentor_user_id_fkey(full_name,phone,mentor_phone,mentor_contact_email)
      `
      )
      .eq("id", assignmentId)
      .or(`mentor_user_id.eq.${profile.id},mentee_user_id.eq.${profile.id}`)
      .single();

    if (assignmentError || !assignmentData) {
      return { detail: null, milestones: [], error: assignmentError?.message ?? "Not found" };
    }

    const row = assignmentData as unknown as {
      id: string;
      mentor_user_id: string;
      mentee_user_id: string;
      hire_date: string | null;
      active: boolean | null;
      mentee: { full_name: string | null } | null;
      mentor: {
        full_name: string | null;
        phone: string | null;
        mentor_phone: string | null;
        mentor_contact_email: string | null;
      } | null;
    };

    const [milestonesRes, interactionsRes] = await Promise.all([
      supabase
        .from("mentorship_milestones")
        .select("assignment_id, milestone_type, due_date, completed_date")
        .eq("assignment_id", assignmentId)
        .order("due_date", { ascending: true }),
      supabase
        .from("mentorship_interactions")
        .select("interaction_date")
        .eq("assignment_id", assignmentId)
        .order("interaction_date", { ascending: false })
        .limit(1),
    ]);

    const milestones = (milestonesRes.data ?? []) as MenteeMilestoneRow[];
    const lastInteraction =
      (interactionsRes.data?.[0] as { interaction_date: string } | undefined)?.interaction_date ?? null;

    const nextUpcoming = milestones.find((m) => !m.completed_date && m.due_date >= TODAY_STR);

    const isMentorView = row.mentor_user_id === profile.id;
    const mentorProf = row.mentor;
    const mp = mentorProf?.mentor_phone?.trim();
    const p = mentorProf?.phone?.trim();
    const mentorPhone = mp || p || null;
    const mentorEmail = mentorProf?.mentor_contact_email?.trim() || null;
    const detail: MenteeDetailRow = {
      id: row.id,
      mentor_user_id: row.mentor_user_id,
      mentee_user_id: row.mentee_user_id,
      isMentorView,
      mentee_full_name: row.mentee?.full_name ?? null,
      mentor_full_name: row.mentor?.full_name ?? null,
      mentor_contact_email: mentorEmail,
      mentor_phone_display: mentorPhone,
      hire_date: row.hire_date ?? null,
      active: row.active === true,
      next_milestone_label: nextUpcoming?.milestone_type ?? null,
      next_milestone_due_date: nextUpcoming?.due_date ?? null,
      last_interaction_at: lastInteraction,
    };

    return { detail, milestones };
  } catch (e) {
    return {
      detail: null,
      milestones: [],
      error: e instanceof Error ? e.message : "Unknown error",
    };
  }
}
