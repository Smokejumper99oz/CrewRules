import type { SupabaseClient } from "@supabase/supabase-js";

export type MentoringOverviewScope =
  | { kind: "platform" }
  | { kind: "tenant"; tenant: string; portal: string };

export type MentoringOverviewStats = {
  mentors: number;
  activeMentees: number;
  unmatchedMentees: number;
  missingMentorContact: number;
  openMentorshipProgramRequests: number;
  /** mentor_preload rows with no linked profile yet (tenant-scoped when applicable). */
  stagedMentors: number;
  /** Active assignment rows whose mentee profile has completed welcome onboarding. */
  liveMentees: number;
};

const IN_CHUNK = 120;

function chunk<T>(arr: T[], size: number): T[][] {
  if (arr.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function hasMentorContactRow(p: {
  mentor_contact_email: string | null;
  mentor_phone: string | null;
}): boolean {
  const email = (p.mentor_contact_email ?? "").trim();
  const mp = (p.mentor_phone ?? "").trim();
  return Boolean(email && mp);
}

/**
 * Read-only aggregates for Super Admin (platform) or tenant Admin dashboards.
 * Uses service-role client; callers must gate access first.
 */
export async function getMentoringOverviewStats(
  admin: SupabaseClient,
  scope: MentoringOverviewScope
): Promise<MentoringOverviewStats> {
  const empty: MentoringOverviewStats = {
    mentors: 0,
    activeMentees: 0,
    unmatchedMentees: 0,
    missingMentorContact: 0,
    openMentorshipProgramRequests: 0,
    stagedMentors: 0,
    liveMentees: 0,
  };

  let mentorIdsInScope: string[] | null = null;

  if (scope.kind === "tenant") {
    const { data: mentorsRows, error: mErr } = await admin
      .from("profiles")
      .select("id")
      .eq("tenant", scope.tenant)
      .eq("portal", scope.portal);
    if (mErr) return empty;
    mentorIdsInScope = [...new Set((mentorsRows ?? []).map((r) => (r as { id: string }).id))];
  }

  const mentorsQuery = admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_mentor", true);

  if (scope.kind === "tenant") {
    mentorsQuery.eq("tenant", scope.tenant).eq("portal", scope.portal);
  }

  let programRequestsQuery = admin
    .from("mentorship_program_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");
  if (scope.kind === "tenant") {
    programRequestsQuery = programRequestsQuery.eq("tenant", scope.tenant).eq("portal", scope.portal);
  }

  const [{ count: mentorsCount, error: mentorsErr }, { count: programRequestsCount, error: programRequestsErr }] =
    await Promise.all([mentorsQuery, programRequestsQuery]);
  const openMentorshipProgramRequests = programRequestsErr ? 0 : (programRequestsCount ?? 0);

  if (mentorsErr) return empty;

  const fetchStagedMentors = async (): Promise<number> => {
    let q = admin
      .from("mentor_preload")
      .select("id", { count: "exact", head: true })
      .is("matched_profile_id", null);
    if (scope.kind === "tenant") {
      q = q.eq("tenant", scope.tenant);
    }
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  };

  const fetchLiveMentees = async (): Promise<number> => {
    type MenteeRow = { welcome_modal_version_seen?: number | null } | null;
    const rowCountsAsLive = (row: { mentee?: MenteeRow }): boolean => {
      const m = row.mentee;
      return m != null && m.welcome_modal_version_seen != null;
    };

    if (scope.kind === "platform") {
      const { data, error } = await admin
        .from("mentor_assignments")
        .select("mentee:profiles!mentor_assignments_mentee_user_id_fkey(welcome_modal_version_seen)")
        .eq("active", true)
        .not("mentee_user_id", "is", null);
      if (error) return 0;
      let n = 0;
      for (const row of data ?? []) {
        if (rowCountsAsLive(row as { mentee?: MenteeRow })) n += 1;
      }
      return n;
    }

    const ids = mentorIdsInScope ?? [];
    if (ids.length === 0) return 0;
    let total = 0;
    for (const part of chunk(ids, IN_CHUNK)) {
      const { data, error } = await admin
        .from("mentor_assignments")
        .select("mentee:profiles!mentor_assignments_mentee_user_id_fkey(welcome_modal_version_seen)")
        .in("mentor_user_id", part)
        .eq("active", true)
        .not("mentee_user_id", "is", null);
      if (error) return 0;
      for (const row of data ?? []) {
        if (rowCountsAsLive(row as { mentee?: MenteeRow })) total += 1;
      }
    }
    return total;
  };

  const [stagedMentors, liveMentees] = await Promise.all([fetchStagedMentors(), fetchLiveMentees()]);

  const countAssignments = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase filter builder chain
    applyFilters: (q: any) => any
  ): Promise<number> => {
    if (scope.kind === "platform") {
      let query = admin
        .from("mentor_assignments")
        .select("id", { count: "exact", head: true });
      query = applyFilters(query);
      const { count, error } = await query;
      if (error) return 0;
      return count ?? 0;
    }

    const ids = mentorIdsInScope ?? [];
    if (ids.length === 0) return 0;
    let total = 0;
    for (const part of chunk(ids, IN_CHUNK)) {
      let query = admin
        .from("mentor_assignments")
        .select("id", { count: "exact", head: true })
        .in("mentor_user_id", part);
      query = applyFilters(query);
      const { count, error } = await query;
      if (error) return 0;
      total += count ?? 0;
    }
    return total;
  };

  const [activeMentees, unmatchedMentees] = await Promise.all([
    countAssignments((q) =>
      q.not("mentee_user_id", "is", null).eq("active", true)
    ),
    countAssignments((q) => q.is("mentee_user_id", null)),
  ]);

  const assignmentMentorRows: { mentor_user_id: string }[] = [];
  if (scope.kind === "platform") {
    const { data, error: amErr } = await admin.from("mentor_assignments").select("mentor_user_id");
    if (amErr) {
      return {
        mentors: mentorsCount ?? 0,
        activeMentees,
        unmatchedMentees,
        missingMentorContact: 0,
        openMentorshipProgramRequests,
        stagedMentors,
        liveMentees,
      };
    }
    for (const r of data ?? []) {
      assignmentMentorRows.push(r as { mentor_user_id: string });
    }
  } else {
    const ids = mentorIdsInScope ?? [];
    if (ids.length === 0) {
      return {
        mentors: mentorsCount ?? 0,
        activeMentees,
        unmatchedMentees,
        missingMentorContact: 0,
        openMentorshipProgramRequests,
        stagedMentors,
        liveMentees,
      };
    }
    for (const part of chunk(ids, IN_CHUNK)) {
      const { data, error: amErr } = await admin
        .from("mentor_assignments")
        .select("mentor_user_id")
        .in("mentor_user_id", part);
      if (amErr) {
        return {
          mentors: mentorsCount ?? 0,
          activeMentees,
          unmatchedMentees,
          missingMentorContact: 0,
          openMentorshipProgramRequests,
          stagedMentors,
          liveMentees,
        };
      }
      for (const r of data ?? []) {
        assignmentMentorRows.push(r as { mentor_user_id: string });
      }
    }
  }

  const candidates = [
    ...new Set(assignmentMentorRows.map((r) => r.mentor_user_id).filter(Boolean)),
  ];

  if (candidates.length === 0) {
    return {
      mentors: mentorsCount ?? 0,
      activeMentees,
      unmatchedMentees,
      missingMentorContact: 0,
      openMentorshipProgramRequests,
      stagedMentors,
      liveMentees,
    };
  }

  let missingMentorContact = 0;
  for (const part of chunk(candidates, IN_CHUNK)) {
    const { data: profs, error: pErr } = await admin
      .from("profiles")
      .select("id, mentor_contact_email, mentor_phone, tenant, portal")
      .in("id", part);

    if (pErr) continue;

    for (const row of profs ?? []) {
      const p = row as {
        id: string;
        mentor_contact_email: string | null;
        mentor_phone: string | null;
        tenant: string;
        portal: string;
      };
      if (scope.kind === "tenant") {
        if (p.tenant !== scope.tenant || p.portal !== scope.portal) continue;
      }
      if (!hasMentorContactRow(p)) {
        missingMentorContact += 1;
      }
    }
  }

  return {
    mentors: mentorsCount ?? 0,
    activeMentees,
    unmatchedMentees,
    missingMentorContact,
    openMentorshipProgramRequests,
    stagedMentors,
    liveMentees,
  };
}
