import type { SupabaseClient } from "@supabase/supabase-js";
import { loadFrontierPilotMenteeRosterPageData } from "@/lib/mentoring/frontier-mentee-roster-load";

export type MentoringOverviewScope =
  | { kind: "platform" }
  | { kind: "tenant"; tenant: string; portal: string };

export type FrontierMenteeRosterPack = Awaited<ReturnType<typeof loadFrontierPilotMenteeRosterPageData>>;

export type GetMentoringOverviewStatsOptions = {
  /**
   * When provided for Frontier pilots tenant scope, `unmatchedMentees` and roster coverage totals
   * (`menteeRosterTotal`, `menteeRosterWithMentor`) are taken from this pack instead of loading the
   * mentee roster again (same counts as Mentee Roster).
   */
  frontierMenteeRosterPreloadPromise?: Promise<FrontierMenteeRosterPack>;
};

export type MentoringOverviewStats = {
  mentors: number;
  activeMentees: number;
  unmatchedMentees: number;
  /**
   * Frontier pilots tenant: mentee roster row count (`live` + `not_live` + `unassigned` from the same
   * roster loader as `unmatchedMentees`). Always 0 for platform and other tenants.
   */
  menteeRosterTotal: number;
  /**
   * Frontier pilots tenant: roster rows with a mentor assignment (`live` + `not_live`). Always 0 for
   * platform and other tenants.
   */
  menteeRosterWithMentor: number;
  /** Frontier pilots tenant: mentee roster rows in `live` status. Always 0 for platform and other tenants. */
  menteeRosterLive: number;
  /** Frontier pilots tenant: mentee roster rows in `not_live` (assigned, onboarding not complete). */
  menteeRosterNotLive: number;
  missingMentorContact: number;
  openMentorshipProgramRequests: number;
  /** mentor_preload rows with no linked profile yet (tenant-scoped when applicable). */
  stagedMentors: number;
  /** Active assignment rows whose mentee profile has completed welcome onboarding. */
  liveMentees: number;
  /**
   * Frontier pilots tenant only: distinct active assignments with ≥1 check-in
   * `follow_up_category = needs_admin_follow_up`. Always 0 for platform and other tenants.
   */
  menteesNeedingFollowUp: number;
  /**
   * Distinct active mentee assignments with any meaningful mentoring touch in the last 14 local calendar
   * days: check-ins (`mentorship_check_ins.occurred_on`), notes (`mentorship_notes.created_at`), completed
   * milestones (`completed_at` or `completed_date`), mentee milestone updates (`created_at`), or
   * `mentor_assignments.last_interaction_at`. Denominator for engagement % is usually `activeMentees`.
   */
  menteeAssignmentsWithCheckInLast14d: number;
  /**
   * Active mentee assignments with no check-in on or after “today − 21 days” (local calendar),
   * i.e. no logged activity in the rolling 21-day window (includes never checked in).
   */
  menteeAssignmentsAtRiskNoActivity21d: number;
  /**
   * `mentor_registry` rows whose `created_at` falls in the **current local calendar month** (local
   * window from `mentorJoinMonthLabel`). Scoped like inactive registry counts: tenant profile ids +
   * tenant `mentor_preload` ids, or platform-wide.
   */
  mentorRegistryOnboardedThisMonth: number;
  /** Long month name (e.g. "April") for the same local calendar window as registry month metrics. */
  mentorJoinMonthLabel: string;
  /**
   * `mentor_registry` rows with `mentor_status` in `non_active`, `former`, or `archived` whose `updated_at`
   * falls in the same local calendar month (Mentor Roster admin saves set `updated_at`). Scoped by tenant
   * profile ids + `mentor_preload` for that tenant, or platform-wide when `scope.kind === "platform"`.
   * Re-saving notes while already inactive can increment; clearing `is_mentor` without a registry update is not counted.
   */
  mentorRegistryMarkedInactiveThisMonth: number;
};

const IN_CHUNK = 120;
const CHECK_IN_ASSIGN_CHUNK = 100;

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function localYmdFromIsoTimestamptz(iso: string | null | undefined): string | null {
  if (iso == null || String(iso).trim() === "") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return toLocalYmd(d);
}

function localYmdInInclusive14d(ymd: string | null, ymd14: string, ymdToday: string): boolean {
  return ymd != null && /^\d{4}-\d{2}-\d{2}$/.test(ymd) && ymd >= ymd14 && ymd <= ymdToday;
}

/**
 * Local calendar month bounds as ISO strings for mentor registry month metrics, plus a display month
 * label derived from the same `start` instant so UI copy matches the counted range.
 */
function localCalendarMonthStartEndIso(): {
  startIso: string;
  endExclusiveIso: string;
  monthLabel: string;
} {
  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth();
  const start = new Date(y, mo, 1, 0, 0, 0, 0);
  const endExclusive = new Date(y, mo + 1, 1, 0, 0, 0, 0);
  const monthLabel = start.toLocaleString(undefined, { month: "long" });
  return { startIso: start.toISOString(), endExclusiveIso: endExclusive.toISOString(), monthLabel };
}

/** Active `mentor_assignments.id` with a linked mentee (same notion as `activeMentees` count). */
async function fetchActiveMenteeAssignmentIds(
  admin: SupabaseClient,
  scope: MentoringOverviewScope,
  mentorIdsInScope: string[] | null
): Promise<string[]> {
  const out: string[] = [];
  if (scope.kind === "platform") {
    const { data, error } = await admin
      .from("mentor_assignments")
      .select("id")
      .eq("active", true)
      .not("mentee_user_id", "is", null);
    if (error) return [];
    for (const r of data ?? []) out.push(String((r as { id: string }).id));
    return [...new Set(out)];
  }

  const ids = mentorIdsInScope ?? [];
  if (ids.length === 0) return [];
  for (const part of chunk(ids, IN_CHUNK)) {
    const { data, error } = await admin
      .from("mentor_assignments")
      .select("id")
      .in("mentor_user_id", part)
      .eq("active", true)
      .not("mentee_user_id", "is", null);
    if (error) continue;
    for (const r of data ?? []) out.push(String((r as { id: string }).id));
  }
  return [...new Set(out)];
}

/**
 * At-risk (`withCheckIn21d`) still uses only `mentorship_check_ins` in the inclusive 21 local-day window.
 * Engagement numerator (`withCheckIn14d`) is distinct assignments with **any** meaningful touch in the
 * inclusive 14 local-day window: check-ins, notes, milestone completion, mentee milestone updates,
 * or `mentor_assignments.last_interaction_at` (local calendar day for timestamps; same `ymd14`/`ymdToday`
 * bounds as check-in `occurred_on`).
 */
async function fetchMenteeCheckInEngagementMetrics(
  admin: SupabaseClient,
  assignmentIds: string[]
): Promise<{ withCheckIn14d: number; withCheckIn21d: number; atRiskNoActivity21d: number }> {
  if (assignmentIds.length === 0) {
    return { withCheckIn14d: 0, withCheckIn21d: 0, atRiskNoActivity21d: 0 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start14 = new Date(today);
  start14.setDate(start14.getDate() - 13);
  const start21 = new Date(today);
  start21.setDate(start21.getDate() - 21);
  const ymd14 = toLocalYmd(start14);
  const ymd21 = toLocalYmd(start21);
  const ymdToday = toLocalYmd(today);

  const endOfTodayLocal = new Date(today);
  endOfTodayLocal.setHours(23, 59, 59, 999);
  const start14Iso = start14.toISOString();
  const endTodayIso = endOfTodayLocal.toISOString();

  const with21 = new Set<string>();
  const meaningful14 = new Set<string>();
  const assignmentIdSet = new Set(assignmentIds);

  for (const part of chunk(assignmentIds, CHECK_IN_ASSIGN_CHUNK)) {
    const [checkInsRes, notesRes, milestonesRes, menteeUpdatesRes, assignmentsRes] = await Promise.all([
      admin
        .from("mentorship_check_ins")
        .select("assignment_id, occurred_on")
        .in("assignment_id", part)
        .gte("occurred_on", ymd21),
      admin
        .from("mentorship_notes")
        .select("assignment_id, created_at")
        .in("assignment_id", part)
        .gte("created_at", start14Iso)
        .lte("created_at", endTodayIso),
      admin
        .from("mentorship_milestones")
        .select("assignment_id, completed_at, completed_date")
        .in("assignment_id", part)
        .or("completed_date.not.is.null,completed_at.not.is.null"),
      admin
        .from("mentorship_mentee_milestone_updates")
        .select("assignment_id, created_at")
        .in("assignment_id", part)
        .gte("created_at", start14Iso)
        .lte("created_at", endTodayIso),
      admin
        .from("mentor_assignments")
        .select("id, last_interaction_at")
        .in("id", part)
        .not("last_interaction_at", "is", null)
        .gte("last_interaction_at", start14Iso)
        .lte("last_interaction_at", endTodayIso),
    ]);

    if (!checkInsRes.error && checkInsRes.data) {
      for (const r of checkInsRes.data) {
        const aid = String((r as { assignment_id: string }).assignment_id ?? "");
        const occ = String((r as { occurred_on: string }).occurred_on ?? "").slice(0, 10);
        if (!aid || !assignmentIdSet.has(aid) || !/^\d{4}-\d{2}-\d{2}$/.test(occ)) continue;
        with21.add(aid);
        if (occ >= ymd14) meaningful14.add(aid);
      }
    }

    if (!notesRes.error && notesRes.data) {
      for (const r of notesRes.data) {
        const aid = String((r as { assignment_id: string }).assignment_id ?? "");
        if (!aid || !assignmentIdSet.has(aid)) continue;
        const y = localYmdFromIsoTimestamptz((r as { created_at: string }).created_at);
        if (localYmdInInclusive14d(y, ymd14, ymdToday)) meaningful14.add(aid);
      }
    }

    if (!milestonesRes.error && milestonesRes.data) {
      for (const r of milestonesRes.data) {
        const aid = String((r as { assignment_id: string }).assignment_id ?? "");
        if (!aid || !assignmentIdSet.has(aid)) continue;
        const row = r as { completed_at: string | null; completed_date: string | null };
        let actYmd: string | null = null;
        if (row.completed_at) {
          actYmd = localYmdFromIsoTimestamptz(row.completed_at);
        }
        if (actYmd == null && row.completed_date) {
          const head = String(row.completed_date).slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(head)) actYmd = head;
        }
        if (localYmdInInclusive14d(actYmd, ymd14, ymdToday)) meaningful14.add(aid);
      }
    }

    if (!menteeUpdatesRes.error && menteeUpdatesRes.data) {
      for (const r of menteeUpdatesRes.data) {
        const aid = String((r as { assignment_id: string }).assignment_id ?? "");
        if (!aid || !assignmentIdSet.has(aid)) continue;
        const y = localYmdFromIsoTimestamptz((r as { created_at: string }).created_at);
        if (localYmdInInclusive14d(y, ymd14, ymdToday)) meaningful14.add(aid);
      }
    }

    if (!assignmentsRes.error && assignmentsRes.data) {
      for (const r of assignmentsRes.data) {
        const aid = String((r as { id: string }).id ?? "");
        if (!aid || !assignmentIdSet.has(aid)) continue;
        const y = localYmdFromIsoTimestamptz((r as { last_interaction_at: string }).last_interaction_at);
        if (localYmdInInclusive14d(y, ymd14, ymdToday)) meaningful14.add(aid);
      }
    }
  }

  const atRiskNoActivity21d = Math.max(0, assignmentIds.length - with21.size);
  return { withCheckIn14d: meaningful14.size, withCheckIn21d: with21.size, atRiskNoActivity21d };
}

/** Mentee roster loader is tenant-scoped to Frontier pilots; keep in sync with `frontier-mentee-roster-load.ts`. */
const FRONTIER_PILOT_TENANT = "frontier";
const FRONTIER_PILOT_PORTAL = "pilots";

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

const MENTOR_REGISTRY_INACTIVE_STATUSES = ["non_active", "former", "archived"] as const;

async function fetchMentorRegistryMarkedInactiveThisMonth(
  admin: SupabaseClient,
  scope: MentoringOverviewScope,
  tenantProfileIds: string[] | null,
  monthStartIso: string,
  monthEndExclusiveIso: string
): Promise<number> {
  const statusList = [...MENTOR_REGISTRY_INACTIVE_STATUSES] as string[];

  if (scope.kind === "platform") {
    const { count, error } = await admin
      .from("mentor_registry")
      .select("id", { count: "exact", head: true })
      .in("mentor_status", statusList)
      .gte("updated_at", monthStartIso)
      .lt("updated_at", monthEndExclusiveIso);
    return error ? 0 : (count ?? 0);
  }

  const ids = tenantProfileIds ?? [];
  let total = 0;

  for (const part of chunk(ids, IN_CHUNK)) {
    const { count, error } = await admin
      .from("mentor_registry")
      .select("id", { count: "exact", head: true })
      .not("profile_id", "is", null)
      .in("profile_id", part)
      .in("mentor_status", statusList)
      .gte("updated_at", monthStartIso)
      .lt("updated_at", monthEndExclusiveIso);
    if (!error) total += count ?? 0;
  }

  const { data: preloadRows, error: preIdErr } = await admin
    .from("mentor_preload")
    .select("id")
    .eq("tenant", scope.tenant);
  if (!preIdErr && preloadRows && preloadRows.length > 0) {
    const preloadIds = preloadRows.map((r) => String((r as { id: string }).id));
    for (const part of chunk(preloadIds, IN_CHUNK)) {
      const { count, error } = await admin
        .from("mentor_registry")
        .select("id", { count: "exact", head: true })
        .not("preload_id", "is", null)
        .in("preload_id", part)
        .in("mentor_status", statusList)
        .gte("updated_at", monthStartIso)
        .lt("updated_at", monthEndExclusiveIso);
      if (!error) total += count ?? 0;
    }
  }

  return total;
}

async function fetchMentorRegistryCreatedThisMonth(
  admin: SupabaseClient,
  scope: MentoringOverviewScope,
  tenantProfileIds: string[] | null,
  monthStartIso: string,
  monthEndExclusiveIso: string
): Promise<number> {
  if (scope.kind === "platform") {
    const { count, error } = await admin
      .from("mentor_registry")
      .select("id", { count: "exact", head: true })
      .gte("created_at", monthStartIso)
      .lt("created_at", monthEndExclusiveIso);
    return error ? 0 : (count ?? 0);
  }

  const ids = tenantProfileIds ?? [];
  let total = 0;

  for (const part of chunk(ids, IN_CHUNK)) {
    const { count, error } = await admin
      .from("mentor_registry")
      .select("id", { count: "exact", head: true })
      .not("profile_id", "is", null)
      .in("profile_id", part)
      .gte("created_at", monthStartIso)
      .lt("created_at", monthEndExclusiveIso);
    if (!error) total += count ?? 0;
  }

  const { data: preloadRows, error: preIdErr } = await admin
    .from("mentor_preload")
    .select("id")
    .eq("tenant", scope.tenant);
  if (!preIdErr && preloadRows && preloadRows.length > 0) {
    const preloadIds = preloadRows.map((r) => String((r as { id: string }).id));
    for (const part of chunk(preloadIds, IN_CHUNK)) {
      const { count, error } = await admin
        .from("mentor_registry")
        .select("id", { count: "exact", head: true })
        .not("preload_id", "is", null)
        .in("preload_id", part)
        .gte("created_at", monthStartIso)
        .lt("created_at", monthEndExclusiveIso);
      if (!error) total += count ?? 0;
    }
  }

  return total;
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
 * Frontier pilots admin: count distinct active `mentor_assignments.id` whose mentor is in tenant scope
 * and that have at least one `mentorship_check_ins` row with `follow_up_category = needs_admin_follow_up`.
 * Platform and non-Frontier tenants: 0.
 */
async function fetchMenteesNeedingFollowUpCount(
  admin: SupabaseClient,
  scope: MentoringOverviewScope,
  mentorIdsInScope: string[] | null
): Promise<number> {
  if (scope.kind !== "tenant" || !isFrontierPilotTenantScope(scope)) {
    return 0;
  }
  const ids = mentorIdsInScope ?? [];
  if (ids.length === 0) return 0;

  const assignmentIds = new Set<string>();
  for (const part of chunk(ids, IN_CHUNK)) {
    const { data, error } = await admin
      .from("mentor_assignments")
      .select("id")
      .in("mentor_user_id", part)
      .eq("active", true);
    if (error) return 0;
    for (const r of data ?? []) {
      assignmentIds.add(String((r as { id: string }).id));
    }
  }
  if (assignmentIds.size === 0) return 0;

  const distinctWithFlag = new Set<string>();
  const assignmentIdList = [...assignmentIds];
  for (const part of chunk(assignmentIdList, IN_CHUNK)) {
    const { data, error } = await admin
      .from("mentorship_check_ins")
      .select("assignment_id")
      .eq("follow_up_category", "needs_admin_follow_up")
      .in("assignment_id", part);
    if (error) return 0;
    for (const r of data ?? []) {
      const aid = String((r as { assignment_id: string }).assignment_id ?? "");
      if (aid) distinctWithFlag.add(aid);
    }
  }
  return distinctWithFlag.size;
}

/**
 * Read-only aggregates for Super Admin (platform) or tenant Admin dashboards.
 * Uses service-role client; callers must gate access first.
 */
export async function getMentoringOverviewStats(
  admin: SupabaseClient,
  scope: MentoringOverviewScope,
  statsOptions?: GetMentoringOverviewStatsOptions
): Promise<MentoringOverviewStats> {
  const mentorJoinMonthBounds = localCalendarMonthStartEndIso();

  const empty: MentoringOverviewStats = {
    mentors: 0,
    activeMentees: 0,
    unmatchedMentees: 0,
    menteeRosterTotal: 0,
    menteeRosterWithMentor: 0,
    menteeRosterLive: 0,
    menteeRosterNotLive: 0,
    missingMentorContact: 0,
    openMentorshipProgramRequests: 0,
    stagedMentors: 0,
    liveMentees: 0,
    menteesNeedingFollowUp: 0,
    menteeAssignmentsWithCheckInLast14d: 0,
    menteeAssignmentsAtRiskNoActivity21d: 0,
    mentorRegistryOnboardedThisMonth: 0,
    mentorJoinMonthLabel: mentorJoinMonthBounds.monthLabel,
    mentorRegistryMarkedInactiveThisMonth: 0,
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

  const mentorJoinMonthStartIso = mentorJoinMonthBounds.startIso;
  const mentorJoinMonthEndExclusiveIso = mentorJoinMonthBounds.endExclusiveIso;
  const mentorRegistryOnboardedThisMonthPromise = fetchMentorRegistryCreatedThisMonth(
    admin,
    scope,
    mentorIdsInScope,
    mentorJoinMonthStartIso,
    mentorJoinMonthEndExclusiveIso
  );

  const [
    { count: mentorsCount, error: mentorsErr },
    { count: programRequestsCount, error: programRequestsErr },
    mentorRegistryOnboardedThisMonth,
  ] = await Promise.all([mentorsQuery, programRequestsQuery, mentorRegistryOnboardedThisMonthPromise]);
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

  const [stagedMentors, liveMentees, menteesNeedingFollowUp, mentorRegistryMarkedInactiveThisMonth] =
    await Promise.all([
      fetchStagedMentors(),
      fetchLiveMentees(),
      fetchMenteesNeedingFollowUpCount(admin, scope, mentorIdsInScope),
      fetchMentorRegistryMarkedInactiveThisMonth(
        admin,
        scope,
        mentorIdsInScope,
        mentorJoinMonthBounds.startIso,
        mentorJoinMonthBounds.endExclusiveIso
      ),
    ]);

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

  const activeMenteesPromise = countAssignments((q) =>
    q.not("mentee_user_id", "is", null).eq("active", true)
  );

  /** Unmatched + roster coverage: same single roster load / preload as Mentee Roster `counts`. */
  const unmatchedAndRosterPromise: Promise<
    | {
        frontier: true;
        unmatched: number;
        menteeRosterTotal: number;
        menteeRosterWithMentor: number;
        menteeRosterLive: number;
        menteeRosterNotLive: number;
      }
    | { frontier: false; unmatched: number }
  > = isFrontierPilotTenantScope(scope)
    ? (statsOptions?.frontierMenteeRosterPreloadPromise != null
        ? statsOptions.frontierMenteeRosterPreloadPromise
        : loadFrontierPilotMenteeRosterPageData({
            collectDohAudit: false,
            emitDohAuditToConsole: false,
          })
      ).then((pack) => {
        const c = pack.counts;
        return {
          frontier: true as const,
          unmatched: c.unassigned,
          menteeRosterTotal: c.live + c.not_live + c.unassigned,
          menteeRosterWithMentor: c.live + c.not_live,
          menteeRosterLive: c.live,
          menteeRosterNotLive: c.not_live,
        };
      })
    : countAssignments((q) => q.is("mentee_user_id", null)).then((unmatched) => ({
        frontier: false as const,
        unmatched,
      }));

  const [activeMentees, unmatchedAndRoster] = await Promise.all([
    activeMenteesPromise,
    unmatchedAndRosterPromise,
  ]);

  const unmatchedMentees = unmatchedAndRoster.unmatched;
  const menteeRosterTotal = unmatchedAndRoster.frontier ? unmatchedAndRoster.menteeRosterTotal : 0;
  const menteeRosterWithMentor = unmatchedAndRoster.frontier
    ? unmatchedAndRoster.menteeRosterWithMentor
    : 0;
  const menteeRosterLive = unmatchedAndRoster.frontier ? unmatchedAndRoster.menteeRosterLive : 0;
  const menteeRosterNotLive = unmatchedAndRoster.frontier ? unmatchedAndRoster.menteeRosterNotLive : 0;

  const activeMenteeAssignmentIds = await fetchActiveMenteeAssignmentIds(admin, scope, mentorIdsInScope);
  const checkInM = await fetchMenteeCheckInEngagementMetrics(admin, activeMenteeAssignmentIds);
  const checkInStats = {
    menteeAssignmentsWithCheckInLast14d: checkInM.withCheckIn14d,
    menteeAssignmentsAtRiskNoActivity21d: checkInM.atRiskNoActivity21d,
    mentorRegistryOnboardedThisMonth,
    mentorJoinMonthLabel: mentorJoinMonthBounds.monthLabel,
    mentorRegistryMarkedInactiveThisMonth,
  };

  const assignmentMentorRows: { mentor_user_id: string }[] = [];
  if (scope.kind === "platform") {
    const { data, error: amErr } = await admin.from("mentor_assignments").select("mentor_user_id");
    if (amErr) {
      return {
        mentors: mentorsCount ?? 0,
        activeMentees,
        unmatchedMentees,
        menteeRosterTotal,
        menteeRosterWithMentor,
        menteeRosterLive,
        menteeRosterNotLive,
        missingMentorContact: 0,
        openMentorshipProgramRequests,
        stagedMentors,
        liveMentees,
        menteesNeedingFollowUp,
        ...checkInStats,
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
        menteeRosterTotal,
        menteeRosterWithMentor,
        menteeRosterLive,
        menteeRosterNotLive,
        missingMentorContact: 0,
        openMentorshipProgramRequests,
        stagedMentors,
        liveMentees,
        menteesNeedingFollowUp,
        ...checkInStats,
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
          menteeRosterTotal,
          menteeRosterWithMentor,
          menteeRosterLive,
          menteeRosterNotLive,
          missingMentorContact: 0,
          openMentorshipProgramRequests,
          stagedMentors,
          liveMentees,
          menteesNeedingFollowUp,
          ...checkInStats,
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
      menteeRosterTotal,
      menteeRosterWithMentor,
      menteeRosterLive,
      menteeRosterNotLive,
      missingMentorContact: 0,
      openMentorshipProgramRequests,
      stagedMentors,
      liveMentees,
      menteesNeedingFollowUp,
      ...checkInStats,
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
    menteeRosterTotal,
    menteeRosterWithMentor,
    menteeRosterLive,
    menteeRosterNotLive,
    missingMentorContact,
    openMentorshipProgramRequests,
    stagedMentors,
    liveMentees,
    menteesNeedingFollowUp,
    ...checkInStats,
  };
}
