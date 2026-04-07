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

export async function getMentorActivityList(
  admin: SupabaseClient,
  tenant: string,
  portal: string
): Promise<MentorActivityRow[]> {
  // 1. Get all active assignments for this tenant
  const { data: assignments, error: aErr } = await admin
    .from("mentor_assignments")
    .select("mentor_user_id, id")
    .eq("active", true)
    .not("mentor_user_id", "is", null);

  if (aErr || !assignments || assignments.length === 0) return [];

  // Filter to mentor profiles in scope
  type AssignRow = { mentor_user_id: string; id: string };
  const mentorIds = [...new Set((assignments as AssignRow[]).map((r) => r.mentor_user_id))];

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

  // Scoped assignments
  const scopedAssignments = (assignments as AssignRow[]).filter((a) =>
    profileMap.has(a.mentor_user_id)
  );

  // Count mentees per mentor
  const menteeCounts = new Map<string, number>();
  for (const a of scopedAssignments) {
    menteeCounts.set(a.mentor_user_id, (menteeCounts.get(a.mentor_user_id) ?? 0) + 1);
  }

  // 2. Get the most-recent completed milestone per assignment
  const assignmentIds = scopedAssignments.map((a) => a.id);
  const lastActivityByMentor = new Map<string, string>();

  // Process in chunks to avoid URL limits
  const CHUNK = 100;
  for (let i = 0; i < assignmentIds.length; i += CHUNK) {
    const chunk = assignmentIds.slice(i, i + CHUNK);
    const { data: milestones } = await admin
      .from("mentorship_milestones")
      .select("assignment_id, completed_at, completed_date")
      .in("assignment_id", chunk)
      .not("completed_date", "is", null)
      .order("completed_at", { ascending: false, nullsFirst: false });

    if (!milestones) continue;
    type MilestoneRow = { assignment_id: string; completed_at: string | null; completed_date: string | null };
    for (const m of milestones as MilestoneRow[]) {
      const assignment = (scopedAssignments as AssignRow[]).find((a) => a.id === m.assignment_id);
      if (!assignment) continue;
      const mentorId = assignment.mentor_user_id;
      const ts = m.completed_at ?? m.completed_date;
      if (!ts) continue;
      const existing = lastActivityByMentor.get(mentorId);
      if (!existing || ts > existing) {
        lastActivityByMentor.set(mentorId, ts);
      }
    }
  }

  // 3. Build result list
  const rows: MentorActivityRow[] = [];
  for (const [mentorId, profile] of profileMap.entries()) {
    const lastAt = lastActivityByMentor.get(mentorId) ?? null;
    rows.push({
      mentor_user_id: mentorId,
      full_name: profile.full_name,
      employee_number: profile.employee_number,
      mentee_count: menteeCounts.get(mentorId) ?? 0,
      last_milestone_at: lastAt,
      activity_tier: classifyActivity(lastAt),
    });
  }

  // Sort: most recently active first, then alphabetically
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
