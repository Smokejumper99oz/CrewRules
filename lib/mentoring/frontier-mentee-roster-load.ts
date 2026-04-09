import { createAdminClient } from "@/lib/supabase/admin";
import { isWithinFirstYearSinceDateOfHire } from "@/lib/profile";
import { pickNextMilestoneAmongPending } from "@/lib/mentoring/milestone-program-order";
import type { MenteeRosterRow } from "@/app/frontier/pilots/admin/mentoring/mentee-roster-table";

const TENANT = "frontier";
const PORTAL = "pilots";
const IN_CHUNK = 120;

function chunk<T>(arr: T[], size: number): T[][] {
  if (arr.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const normalize = (v: string | null | undefined) => (v ?? "").trim();

/** Same normalization as mentee-roster-table Class filter (grouping key). TEMP: used only for DOH audit log. */
export function rosterAuditNormalizedDohKey(value: string | null | undefined): string {
  if (value == null || !String(value).trim()) return "(no DOH)";
  const raw = String(value).trim();
  const head = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
  const mdY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (mdY) {
    const m = Number(mdY[1]);
    const d = Number(mdY[2]);
    const y = Number(mdY[3]);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return `(unparsed:${raw.slice(0, 48)})`;
}

export type DohAuditEntry = {
  rowKind: "assignment" | "synthetic";
  assignment_id: string | null;
  name: string;
  employee_number: string;
  profiles_date_of_hire: string | null;
  mentor_assignments_hire_date: string | null;
  final_hire_date_used: string | null;
  source_won: string;
};

type MilestoneEmbed = {
  milestone_type: string;
  due_date: string;
  completed_date: string | null;
};

function getNextMilestone(milestones: MilestoneEmbed[] | null | undefined) {
  const pending = (milestones ?? []).filter((m) => !m.completed_date);
  return pickNextMilestoneAmongPending(pending) ?? null;
}

type WorkspaceEmbed = {
  mentoring_status: string;
};

type MenteeEmbed = {
  full_name: string | null;
  employee_number: string | null;
  date_of_hire: string | null;
  welcome_modal_version_seen: number | null;
  personal_email: string | null;
  phone: string | null;
} | null;

type MentorEmbed = {
  full_name: string | null;
  welcome_modal_version_seen: number | null;
  personal_email: string | null;
  phone: string | null;
} | null;

type AssignmentRosterRow = {
  id: string;
  employee_number: string | null;
  mentee_user_id: string | null;
  mentor_user_id: string | null;
  mentor_employee_number: string | null;
  assigned_at: string | null;
  active: boolean | null;
  hire_date: string | null;
  mentee_display_name: string | null;
  mentee_personal_email: string | null;
  mentee_phone: string | null;
  mentor: MentorEmbed;
  mentee: MenteeEmbed;
  workspace: WorkspaceEmbed | WorkspaceEmbed[] | null;
  milestones: MilestoneEmbed[] | null;
};

const ASSIGNMENT_SELECT = `
  id,
  employee_number,
  mentee_user_id,
  mentor_user_id,
  mentor_employee_number,
  assigned_at,
  active,
  hire_date,
  mentee_display_name,
  mentee_personal_email,
  mentee_phone,
  mentor:profiles!mentor_assignments_mentor_user_id_fkey(full_name, personal_email, phone, welcome_modal_version_seen),
  mentee:profiles!mentor_assignments_mentee_user_id_fkey(full_name, employee_number, date_of_hire, personal_email, phone, welcome_modal_version_seen),
  workspace:mentorship_mentor_workspace(mentoring_status),
  milestones:mentorship_milestones(milestone_type, due_date, completed_date)
`;

type TenantProfileRow = {
  id: string;
  full_name: string | null;
  employee_number: string | null;
  date_of_hire: string | null;
  personal_email: string | null;
  phone: string | null;
  welcome_modal_version_seen: number | null;
};

export type LoadFrontierMenteeRosterOptions = {
  /** When true, populate `dohAudit` using the same rules as MENTEE_ROSTER_DOH_AUDIT on the page. */
  collectDohAudit: boolean;
  /** When true, print the grouped audit to console (same output as the page). */
  emitDohAuditToConsole: boolean;
};

export async function loadFrontierPilotMenteeRosterPageData(options: LoadFrontierMenteeRosterOptions): Promise<{
  roster: MenteeRosterRow[];
  counts: { live: number; not_live: number; unassigned: number };
  dohAudit: DohAuditEntry[];
}> {
  const { collectDohAudit, emitDohAuditToConsole } = options;
  const admin = createAdminClient();

  const [{ data: mentorRows, error: mErr }, { data: profiles }] = await Promise.all([
    admin.from("profiles").select("id").eq("tenant", TENANT).eq("portal", PORTAL),
    admin
      .from("profiles")
      .select(
        "id, full_name, employee_number, date_of_hire, tenant, portal, personal_email, phone, welcome_modal_version_seen"
      )
      .eq("tenant", TENANT)
      .eq("portal", PORTAL)
      .is("deleted_at", null),
  ]);

  const mentorIds = [...new Set((mentorRows ?? []).map((r) => (r as { id: string }).id))];
  const profilesTyped = (profiles ?? []) as TenantProfileRow[];

  const profileByEmp = new Map<string, TenantProfileRow>();
  const tenantProfileIds: string[] = [];
  const tenantEmps: string[] = [];
  for (const p of profilesTyped) {
    tenantProfileIds.push(p.id);
    const emp = normalize(p.employee_number);
    if (emp) {
      tenantEmps.push(emp);
      if (!profileByEmp.has(emp)) profileByEmp.set(emp, p);
    }
  }

  const assignments: AssignmentRosterRow[] = [];
  if (!mErr && mentorIds.length > 0) {
    for (const part of chunk(mentorIds, IN_CHUNK)) {
      const { data, error } = await admin.from("mentor_assignments").select(ASSIGNMENT_SELECT).in("mentor_user_id", part);
      if (error) break;
      for (const r of data ?? []) {
        assignments.push(r as unknown as AssignmentRosterRow);
      }
    }
  }

  const assignmentIds = new Set(assignments.map((a) => a.id));

  if (tenantProfileIds.length > 0) {
    for (const part of chunk(tenantProfileIds, IN_CHUNK)) {
      const { data, error } = await admin
        .from("mentor_assignments")
        .select(ASSIGNMENT_SELECT)
        .is("mentor_user_id", null)
        .not("mentor_employee_number", "is", null)
        .eq("active", true)
        .in("mentee_user_id", part);
      if (error) break;
      for (const r of data ?? []) {
        const row = r as unknown as AssignmentRosterRow;
        if (assignmentIds.has(row.id)) continue;
        if (!normalize(row.mentor_employee_number)) continue;
        assignmentIds.add(row.id);
        assignments.push(row);
      }
    }
  }

  if (tenantEmps.length > 0) {
    for (const part of chunk([...new Set(tenantEmps)], IN_CHUNK)) {
      const { data, error } = await admin
        .from("mentor_assignments")
        .select(ASSIGNMENT_SELECT)
        .is("mentor_user_id", null)
        .not("mentor_employee_number", "is", null)
        .eq("active", true)
        .in("employee_number", part);
      if (error) break;
      for (const r of data ?? []) {
        const row = r as unknown as AssignmentRosterRow;
        if (assignmentIds.has(row.id)) continue;
        if (!normalize(row.mentor_employee_number)) continue;
        const rowEmp = normalize(row.employee_number);
        if (!rowEmp || !profileByEmp.has(rowEmp)) continue;
        assignmentIds.add(row.id);
        assignments.push(row);
      }
    }
  }

  const tenantStagedMentorEmps: string[] = [];
  {
    const { data: preloadEmpRows, error: preloadEmpErr } = await admin
      .from("mentor_preload")
      .select("employee_number")
      .eq("tenant", TENANT);
    if (!preloadEmpErr && preloadEmpRows?.length) {
      for (const raw of preloadEmpRows) {
        const e = normalize((raw as { employee_number: string | null }).employee_number);
        if (e) tenantStagedMentorEmps.push(e);
      }
    }
  }
  const tenantStagedMentorEmpChunks = [...new Set(tenantStagedMentorEmps)];
  if (tenantStagedMentorEmpChunks.length > 0) {
    for (const part of chunk(tenantStagedMentorEmpChunks, IN_CHUNK)) {
      const { data, error } = await admin
        .from("mentor_assignments")
        .select(ASSIGNMENT_SELECT)
        .is("mentor_user_id", null)
        .not("mentor_employee_number", "is", null)
        .is("mentee_user_id", null)
        .eq("active", true)
        .in("mentor_employee_number", part);
      if (error) break;
      for (const r of data ?? []) {
        const row = r as unknown as AssignmentRosterRow;
        if (assignmentIds.has(row.id)) continue;
        if (!normalize(row.employee_number)) continue;
        assignmentIds.add(row.id);
        assignments.push(row);
      }
    }
  }

  const { data: unassignedMentorRows, error: unassignedErr } = await admin
    .from("mentor_assignments")
    .select(ASSIGNMENT_SELECT)
    .is("mentor_user_id", null)
    .is("mentor_employee_number", null)
    .eq("active", true);

  if (!unassignedErr && unassignedMentorRows?.length) {
    for (const r of unassignedMentorRows) {
      const row = r as unknown as AssignmentRosterRow;
      if (assignmentIds.has(row.id)) continue;
      const rowEmp = normalize(row.employee_number);
      if (!rowEmp) continue;
      const mid = row.mentee_user_id;
      const scoped =
        profileByEmp.has(rowEmp) || (mid != null && tenantProfileIds.includes(mid)) || mid == null;
      if (!scoped) continue;
      assignmentIds.add(row.id);
      assignments.push(row);
    }
  }

  const mentorNumsToResolve = new Set<string>();
  for (const a of assignments) {
    const m = a.mentor;
    const me = normalize(a.mentor_employee_number);
    if (!me) continue;
    if (!normalize(m?.full_name ?? "")) mentorNumsToResolve.add(me);
  }

  const mentorByEmp = new Map<string, TenantProfileRow>();
  const mentorNumsList = [...mentorNumsToResolve];
  if (mentorNumsList.length > 0) {
    for (const part of chunk(mentorNumsList, IN_CHUNK)) {
      const { data, error } = await admin
        .from("profiles")
        .select(
          "id, full_name, employee_number, date_of_hire, tenant, portal, personal_email, phone, welcome_modal_version_seen"
        )
        .eq("tenant", TENANT)
        .eq("portal", PORTAL)
        .is("deleted_at", null)
        .in("employee_number", part);
      if (error) break;
      for (const raw of data ?? []) {
        const p = raw as TenantProfileRow;
        const emp = normalize(p.employee_number);
        if (emp) mentorByEmp.set(emp, p);
      }
    }
  }

  const mentorNumsForPreload = mentorNumsList.filter(
    (em) => !normalize(mentorByEmp.get(em)?.full_name ?? "")
  );
  const mentorPreloadNameByEmp = new Map<string, string>();
  if (mentorNumsForPreload.length > 0) {
    for (const part of chunk([...new Set(mentorNumsForPreload)], IN_CHUNK)) {
      const { data, error } = await admin
        .from("mentor_preload")
        .select("employee_number, full_name")
        .eq("tenant", TENANT)
        .in("employee_number", part);
      if (error) break;
      for (const raw of data ?? []) {
        const row = raw as { employee_number: string | null; full_name: string | null };
        const e = normalize(row.employee_number);
        const fn = normalize(row.full_name ?? "");
        if (e && fn) mentorPreloadNameByEmp.set(e, fn);
      }
    }
  }

  const assignmentEmpSet = new Set(
    (assignments ?? []).map((a) => normalize(a.employee_number)).filter(Boolean)
  );

  const formatMilestoneLabel = (type: string | null | undefined) => {
    if (!type) return null;

    const map: Record<string, string> = {
      type_rating: "Type Rating",
      initial_assignment: "Initial Assignment",
      oe_complete: "IOE Complete",
      three_month_online: "3 Month On Line",
    };

    return map[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const roster: MenteeRosterRow[] = [];
  const dohAudit: DohAuditEntry[] = [];

  for (const a of assignments) {
    const emp = normalize(a.employee_number);
    const menteeFromFk = a.mentee;
    const menteeProfile =
      menteeFromFk &&
      (menteeFromFk.full_name?.trim() || normalize(menteeFromFk.employee_number ?? ""))
        ? menteeFromFk
        : emp
          ? profileByEmp.get(emp) ?? null
          : null;
    const name =
      (menteeProfile?.full_name && menteeProfile.full_name.trim()) ||
      (a.mentee_display_name && a.mentee_display_name.trim()) ||
      "—";
    const hireDate = menteeProfile?.date_of_hire ?? a.hire_date ?? null;
    if (collectDohAudit) {
      const pRaw = menteeProfile?.date_of_hire;
      const aRaw = a.hire_date ?? null;
      let sourceWon: string;
      if (pRaw !== undefined && pRaw !== null) {
        sourceWon = "profiles.date_of_hire";
      } else if (aRaw !== undefined && aRaw !== null) {
        sourceWon = "mentor_assignments.hire_date";
      } else {
        sourceWon = "none";
      }
      dohAudit.push({
        rowKind: "assignment",
        assignment_id: a.id,
        name,
        employee_number: emp || "—",
        profiles_date_of_hire: menteeProfile?.date_of_hire ?? null,
        mentor_assignments_hire_date: aRaw,
        final_hire_date_used: hireDate,
        source_won: sourceWon,
      });
    }
    const ws = a.workspace;
    const workspaceRow = Array.isArray(ws) ? ws[0] : ws;
    const nextMilestone = getNextMilestone(a.milestones);
    let nextMilestoneLabel = formatMilestoneLabel(nextMilestone?.milestone_type);
    if (
      workspaceRow?.mentoring_status === "Military Leave" ||
      workspaceRow?.mentoring_status === "Paused"
    ) {
      nextMilestoneLabel = "Paused";
    }
    const m = a.mentor;
    const stagedMentorEmp = normalize(a.mentor_employee_number);
    const mentorResolved = mentorByEmp.get(stagedMentorEmp) ?? null;
    const mentorNameLive = normalize(m?.full_name ?? "");
    const mentorNameResolved = normalize(mentorResolved?.full_name ?? "");
    const mentorNamePreload = normalize(mentorPreloadNameByEmp.get(stagedMentorEmp) ?? "");
    const mentor_name =
      mentorNameLive ||
      mentorNameResolved ||
      mentorNamePreload ||
      (stagedMentorEmp ? `Emp. ${stagedMentorEmp}` : "—");
    const mentorEmail =
      m?.personal_email?.trim() || mentorResolved?.personal_email?.trim() || null;
    const mentorPhone = m?.phone?.trim() || mentorResolved?.phone?.trim() || null;
    const mentorWelcome =
      m?.welcome_modal_version_seen ?? mentorResolved?.welcome_modal_version_seen;
    const mentor_account: "active" | "not_joined" | null =
      !mentorNameLive && !mentorNameResolved && !mentorNamePreload && stagedMentorEmp
        ? null
        : mentorWelcome == null
          ? "not_joined"
          : "active";
    const hasMentorOnAssignment =
      normalize(a.mentor_user_id) !== "" ||
      normalize(a.mentor_employee_number) !== "" ||
      (mentor_name.trim() !== "" && mentor_name !== "—");
    const mentee_account: "active" | "not_joined" =
      menteeProfile?.welcome_modal_version_seen == null ? "not_joined" : "active";
    const rowStatus: "live" | "not_live" | "unassigned" = !hasMentorOnAssignment
      ? "unassigned"
      : mentee_account === "active" && mentor_account === "active"
        ? "live"
        : "not_live";
    roster.push({
      key: a.id,
      assignment_id: a.id,
      name,
      employee_number: emp || "—",
      hire_date: hireDate,
      mentor_name: mentor_name === "—" ? null : mentor_name,
      mentorship_status: workspaceRow?.mentoring_status ?? "Active",
      next_milestone: nextMilestoneLabel,
      mentor_account,
      mentee_account,
      status: rowStatus,
      mentee_email:
        menteeProfile?.personal_email?.trim() || (a.mentee_personal_email?.trim() ?? null) || null,
      mentee_phone: menteeProfile?.phone?.trim() || (a.mentee_phone?.trim() ?? null) || null,
      mentor_email: mentorEmail,
      mentor_phone: mentorPhone,
    });
  }

  for (const p of profilesTyped) {
    const emp = normalize(p.employee_number);
    if (!emp) continue;
    if (!isWithinFirstYearSinceDateOfHire(p.date_of_hire)) continue;
    if (assignmentEmpSet.has(emp)) continue;

    const pr = p as {
      id: string;
      full_name: string | null;
      personal_email: string | null;
      phone: string | null;
    };
    const synHire = p.date_of_hire ?? null;
    if (collectDohAudit) {
      dohAudit.push({
        rowKind: "synthetic",
        assignment_id: null,
        name: pr.full_name?.trim() || "—",
        employee_number: emp,
        profiles_date_of_hire: p.date_of_hire ?? null,
        mentor_assignments_hire_date: null,
        final_hire_date_used: synHire,
        source_won: "profiles.date_of_hire (synthetic; no assignment row)",
      });
    }
    roster.push({
      key: `unassigned-${pr.id}`,
      assignment_id: null,
      name: pr.full_name?.trim() || "—",
      employee_number: emp,
      hire_date: synHire,
      mentor_name: null,
      mentorship_status: null,
      next_milestone: null,
      mentor_account: null,
      mentee_account: "not_joined",
      status: "unassigned",
      mentee_email: pr.personal_email?.trim() || null,
      mentee_phone: pr.phone?.trim() || null,
      mentor_email: null,
      mentor_phone: null,
    });
  }

  if (emitDohAuditToConsole && dohAudit.length > 0) {
    const byKey = new Map<string, DohAuditEntry[]>();
    for (const row of dohAudit) {
      const k = rosterAuditNormalizedDohKey(row.final_hire_date_used);
      const list = byKey.get(k) ?? [];
      list.push(row);
      byKey.set(k, list);
    }
    const keys = [...byKey.keys()].sort();
    // eslint-disable-next-line no-console -- temporary env-gated audit
    console.log("\n========== MENTEE ROSTER DOH AUDIT (MENTEE_ROSTER_DOH_AUDIT=1) ==========");
    // eslint-disable-next-line no-console
    console.log(`Tenant: ${TENANT} portal: ${PORTAL} | audit rows: ${dohAudit.length}`);
    for (const k of keys) {
      const rows = byKey.get(k)!;
      // eslint-disable-next-line no-console
      console.log(`\n--- ${k} (${rows.length} row(s)) ---`);
      for (const r of rows) {
        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify({
            row_kind: r.rowKind,
            assignment_id: r.assignment_id,
            name: r.name,
            employee_number: r.employee_number,
            profiles_date_of_hire: r.profiles_date_of_hire,
            mentor_assignments_hire_date: r.mentor_assignments_hire_date,
            final_hire_date_used: r.final_hire_date_used,
            source_won: r.source_won,
          }),
        );
      }
    }
    // eslint-disable-next-line no-console
    console.log("\n========== END DOH AUDIT ==========\n");
  }

  const counts = {
    live: roster.filter((r) => r.status === "live").length,
    not_live: roster.filter((r) => r.status === "not_live").length,
    unassigned: roster.filter((r) => r.status === "unassigned").length,
  };

  const statusOrder = {
    unassigned: 0,
    not_live: 1,
    live: 2,
  };

  roster.sort((a, b) => {
    const s = statusOrder[a.status] - statusOrder[b.status];
    if (s !== 0) return s;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  return { roster, counts, dohAudit };
}
