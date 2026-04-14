/**
 * Mentor activity feed for tenant admin dashboard.
 * Shows each active mentor, their mentee count, and when they last
 * completed a milestone (proxy for "how active is this mentor?").
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type MentorActivityRow = {
  mentor_user_id: string;
  full_name: string | null;
  employee_number: string | null;
  mentee_count: number;
  last_milestone_at: string | null; // ISO timestamptz or date string
  last_milestone_milestone_type: string | null;
  last_milestone_mentee_name: string | null;
  activity_tier: "today" | "this_week" | "this_month" | "stale" | "never";
};

function classifyActivity(lastAt: string | null): MentorActivityRow["activity_tier"] {
  if (!lastAt) return "never";
  const then = new Date(lastAt).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const day = 86_400_000;
  if (diffMs < day) return "today";
  if (diffMs < 7 * day) return "this_week";
  if (diffMs < 30 * day) return "this_month";
  return "stale";
}

/** Parse `completed_at ?? completed_date` for ordering; null if unusable. */
function milestoneEffectiveMs(m: {
  completed_at: string | null;
  completed_date: string | null;
}): number | null {
  const at = m.completed_at?.trim();
  if (at) {
    const t = new Date(at).getTime();
    return Number.isNaN(t) ? null : t;
  }
  const ymd = m.completed_date?.trim().slice(0, 10);
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const t = new Date(`${ymd}T12:00:00.000Z`).getTime();
  return Number.isNaN(t) ? null : t;
}

function milestoneEffectiveTimestampString(m: {
  completed_at: string | null;
  completed_date: string | null;
}): string | null {
  const at = m.completed_at?.trim();
  if (at) return at;
  const ymd = m.completed_date?.trim().slice(0, 10);
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return ymd;
}

/** 1) mentee profile full_name, 2) mentor_assignments.mentee_display_name, 3) null */
function resolveMenteeDisplayName(
  menteeFullName: string | null | undefined,
  menteeDisplayName: string | null | undefined
): string | null {
  const fromProfile = menteeFullName?.trim();
  if (fromProfile) return fromProfile;
  const fromAssignment = menteeDisplayName?.trim();
  if (fromAssignment) return fromAssignment;
  return null;
}

type AssignmentRow = {
  id: string;
  mentor_user_id: string;
  mentee_user_id: string | null;
  mentee_display_name: string | null;
};

type MilestoneRow = {
  assignment_id: string;
  completed_at: string | null;
  completed_date: string | null;
  milestone_type: string;
};

type WinningMilestone = {
  assignment_id: string;
  completed_at: string | null;
  completed_date: string | null;
  milestone_type: string;
  effectiveMs: number;
};

function shouldReplaceWin(current: WinningMilestone | undefined, nextMs: number, nextAssignmentId: string): boolean {
  if (!current) return true;
  if (nextMs > current.effectiveMs) return true;
  if (nextMs < current.effectiveMs) return false;
  return nextAssignmentId > current.assignment_id;
}

export async function getMentorActivityList(
  admin: SupabaseClient,
  tenant: string,
  portal: string
): Promise<MentorActivityRow[]> {
  const { data: assignments, error: aErr } = await admin
    .from("mentor_assignments")
    .select("mentor_user_id, id, mentee_user_id, mentee_display_name")
    .eq("active", true)
    .not("mentor_user_id", "is", null);

  if (aErr || !assignments || assignments.length === 0) return [];

  const mentorIds = [...new Set((assignments as AssignmentRow[]).map((r) => r.mentor_user_id))];

  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select("id, full_name, employee_number")
    .in("id", mentorIds)
    .eq("tenant", tenant)
    .eq("portal", portal);

  if (pErr || !profiles || profiles.length === 0) return [];

  type ProfileRow = { id: string; full_name: string | null; employee_number: string | null };
  const profileMap = new Map<string, ProfileRow>(
    (profiles as ProfileRow[]).map((p) => [p.id, p])
  );

  const scopedAssignments = (assignments as AssignmentRow[]).filter((a) =>
    profileMap.has(a.mentor_user_id)
  );

  const assignmentById = new Map<string, AssignmentRow>(scopedAssignments.map((a) => [a.id, a]));

  const menteeCounts = new Map<string, number>();
  for (const a of scopedAssignments) {
    menteeCounts.set(a.mentor_user_id, (menteeCounts.get(a.mentor_user_id) ?? 0) + 1);
  }

  const assignmentIds = scopedAssignments.map((a) => a.id);
  const winningByMentor = new Map<string, WinningMilestone>();

  const CHUNK = 100;
  for (let i = 0; i < assignmentIds.length; i += CHUNK) {
    const chunk = assignmentIds.slice(i, i + CHUNK);
    const { data: milestones } = await admin
      .from("mentorship_milestones")
      .select("assignment_id, completed_at, completed_date, milestone_type")
      .in("assignment_id", chunk)
      .not("completed_date", "is", null)
      .order("completed_at", { ascending: false, nullsFirst: false });

    if (!milestones) continue;
    for (const m of milestones as MilestoneRow[]) {
      const effectiveMs = milestoneEffectiveMs(m);
      if (effectiveMs == null) continue;
      const assignment = assignmentById.get(m.assignment_id);
      if (!assignment) continue;
      const mentorId = assignment.mentor_user_id;
      const prev = winningByMentor.get(mentorId);
      if (shouldReplaceWin(prev, effectiveMs, m.assignment_id)) {
        winningByMentor.set(mentorId, {
          assignment_id: m.assignment_id,
          completed_at: m.completed_at,
          completed_date: m.completed_date,
          milestone_type: m.milestone_type,
          effectiveMs,
        });
      }
    }
  }

  const menteeIdsForProfiles = new Set<string>();
  for (const win of winningByMentor.values()) {
    const a = assignmentById.get(win.assignment_id);
    const uid = a?.mentee_user_id?.trim();
    if (uid) menteeIdsForProfiles.add(uid);
  }

  const menteeProfileMap = new Map<string, { full_name: string | null }>();
  const menteeIdList = [...menteeIdsForProfiles];
  for (let i = 0; i < menteeIdList.length; i += CHUNK) {
    const chunk = menteeIdList.slice(i, i + CHUNK);
    const { data: menteeProfiles } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", chunk)
      .eq("tenant", tenant)
      .eq("portal", portal);
    if (!menteeProfiles) continue;
    for (const p of menteeProfiles as { id: string; full_name: string | null }[]) {
      menteeProfileMap.set(p.id, { full_name: p.full_name });
    }
  }

  const rows: MentorActivityRow[] = [];
  for (const [mentorId, profile] of profileMap.entries()) {
    const win = winningByMentor.get(mentorId);
    const lastAt = win ? milestoneEffectiveTimestampString(win) : null;
    const assign = win ? assignmentById.get(win.assignment_id) : undefined;
    const menteeUid = assign?.mentee_user_id?.trim();
    const menteeProfile = menteeUid ? menteeProfileMap.get(menteeUid) : undefined;
    const menteeName =
      assign != null
        ? resolveMenteeDisplayName(menteeProfile?.full_name, assign.mentee_display_name)
        : null;

    rows.push({
      mentor_user_id: mentorId,
      full_name: profile.full_name,
      employee_number: profile.employee_number,
      mentee_count: menteeCounts.get(mentorId) ?? 0,
      last_milestone_at: lastAt,
      last_milestone_milestone_type: win?.milestone_type ?? null,
      last_milestone_mentee_name: win ? menteeName : null,
      activity_tier: classifyActivity(lastAt),
    });
  }

  rows.sort((a, b) => {
    if (a.last_milestone_at && b.last_milestone_at) {
      return b.last_milestone_at.localeCompare(a.last_milestone_at);
    }
    if (a.last_milestone_at) return -1;
    if (b.last_milestone_at) return 1;
    return (a.full_name ?? "").localeCompare(b.full_name ?? "");
  });

  return rows;
}
