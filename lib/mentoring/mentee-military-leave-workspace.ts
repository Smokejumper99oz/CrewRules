import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Profile IDs that are `mentee_user_id` on an **active** assignment whose
 * `mentorship_mentor_workspace.mentoring_status` is Military Leave.
 */
export async function getMenteeUserIdsWithMilitaryLeaveWorkspace(
  admin: SupabaseClient
): Promise<Set<string>> {
  const { data: wsRows, error: wsErr } = await admin
    .from("mentorship_mentor_workspace")
    .select("assignment_id")
    .eq("mentoring_status", "Military Leave");

  if (wsErr || !wsRows?.length) return new Set();

  const assignmentIds = (wsRows as { assignment_id: string }[])
    .map((r) => r.assignment_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (assignmentIds.length === 0) return new Set();

  const { data: maRows, error: maErr } = await admin
    .from("mentor_assignments")
    .select("mentee_user_id")
    .in("id", assignmentIds)
    .eq("active", true)
    .not("mentee_user_id", "is", null);

  if (maErr || !maRows?.length) return new Set();

  return new Set(
    (maRows as { mentee_user_id: string }[])
      .map((r) => r.mentee_user_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );
}
