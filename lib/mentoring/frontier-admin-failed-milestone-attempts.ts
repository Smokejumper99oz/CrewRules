import type { SupabaseClient } from "@supabase/supabase-js";
import type { MentoringOverviewScope } from "@/lib/mentoring/admin-overview-stats";

const FRONTIER_PILOT_TENANT = "frontier";
const FRONTIER_PILOT_PORTAL = "pilots";
const IN_CHUNK = 120;

/** Max rows returned for the Frontier pilot admin dashboard review section. */
export const FRONTIER_ADMIN_FAILED_MILESTONE_ATTEMPTS_LIMIT = 25;

export type FrontierAdminFailedMilestoneAttemptRow = {
  attempt_id: string;
  assignment_id: string;
  milestone_id: string;
  milestone_type: string;
  occurred_on: string;
  note: string | null;
  created_at: string;
  mentee_display_name: string | null;
  mentor_display_name: string | null;
  employee_number: string | null;
};

function isFrontierPilotTenantScope(scope: MentoringOverviewScope): boolean {
  return (
    scope.kind === "tenant" &&
    scope.tenant === FRONTIER_PILOT_TENANT &&
    scope.portal === FRONTIER_PILOT_PORTAL
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  if (arr.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

type AttemptQueryRow = {
  id: string;
  assignment_id: string;
  milestone_id: string;
  milestone_type: string;
  occurred_on: string;
  note: string | null;
  created_at: string;
  outcome: string;
  mentor_assignments: {
    id: string;
    employee_number: string | null;
    mentee: { full_name: string | null } | null;
    mentor: { full_name: string | null } | null;
  } | null;
  mentorship_milestone_attempt_reviews:
    | { status: string }
    | { status: string }[]
    | null;
};

function reviewStatusOpen(r: AttemptQueryRow): boolean {
  const rev = r.mentorship_milestone_attempt_reviews;
  if (rev == null) return false;
  const status = Array.isArray(rev) ? rev[0]?.status : rev.status;
  return String(status ?? "").trim() === "open";
}

function toRow(r: AttemptQueryRow): FrontierAdminFailedMilestoneAttemptRow {
  const ma = r.mentor_assignments;
  return {
    attempt_id: r.id,
    assignment_id: r.assignment_id,
    milestone_id: r.milestone_id,
    milestone_type: r.milestone_type,
    occurred_on: String(r.occurred_on ?? "").trim().slice(0, 10),
    note: r.note != null && String(r.note).trim() !== "" ? String(r.note).trim() : null,
    created_at: r.created_at,
    mentee_display_name: ma?.mentee?.full_name?.trim() || null,
    mentor_display_name: ma?.mentor?.full_name?.trim() || null,
    employee_number: ma?.employee_number?.trim() || null,
  };
}

/**
 * Open admin-review rows for failed milestone attempts (Frontier pilots tenant admin, service-role).
 * Only includes attempts with `mentorship_milestone_attempt_reviews.status = 'open'`.
 * Scoped to active assignments whose mentor profile is in the given tenant + portal.
 * Non-Frontier scopes return [].
 */
export async function loadFrontierAdminFailedMilestoneAttempts(
  admin: SupabaseClient,
  scope: MentoringOverviewScope
): Promise<FrontierAdminFailedMilestoneAttemptRow[]> {
  if (scope.kind !== "tenant" || !isFrontierPilotTenantScope(scope)) {
    return [];
  }

  const { data: mentorsRows, error: mErr } = await admin
    .from("profiles")
    .select("id")
    .eq("tenant", scope.tenant)
    .eq("portal", scope.portal);

  if (mErr || !mentorsRows?.length) {
    return [];
  }

  const mentorIdsInScope = [...new Set((mentorsRows as { id: string }[]).map((r) => r.id))];

  const assignmentIds = new Set<string>();
  for (const part of chunk(mentorIdsInScope, IN_CHUNK)) {
    const { data, error } = await admin
      .from("mentor_assignments")
      .select("id")
      .in("mentor_user_id", part)
      .eq("active", true);
    if (error) return [];
    for (const r of data ?? []) {
      assignmentIds.add(String((r as { id: string }).id));
    }
  }

  if (assignmentIds.size === 0) {
    return [];
  }

  const assignmentIdList = [...assignmentIds];
  const collected: AttemptQueryRow[] = [];

  for (const part of chunk(assignmentIdList, IN_CHUNK)) {
    const { data, error } = await admin
      .from("mentorship_milestone_attempts")
      .select(
        `
        id,
        assignment_id,
        milestone_id,
        milestone_type,
        occurred_on,
        note,
        created_at,
        outcome,
        mentor_assignments (
          id,
          employee_number,
          mentee:profiles!mentor_assignments_mentee_user_id_fkey (full_name),
          mentor:profiles!mentor_assignments_mentor_user_id_fkey (full_name)
        ),
        mentorship_milestone_attempt_reviews!inner (
          status
        )
      `
      )
      .eq("outcome", "failed")
      .in("assignment_id", part);

    if (error) {
      return [];
    }
    for (const raw of data ?? []) {
      collected.push(raw as unknown as AttemptQueryRow);
    }
  }

  const openReviewsOnly = collected.filter(reviewStatusOpen);
  const mapped = openReviewsOnly.map(toRow);
  mapped.sort((a, b) => {
    const oa = a.occurred_on;
    const ob = b.occurred_on;
    if (oa !== ob) return ob.localeCompare(oa);
    const ca = a.created_at;
    const cb = b.created_at;
    return cb.localeCompare(ca);
  });

  return mapped.slice(0, FRONTIER_ADMIN_FAILED_MILESTONE_ATTEMPTS_LIMIT);
}
