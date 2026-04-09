import type { MenteeRosterRow } from "@/app/frontier/pilots/admin/mentoring/mentee-roster-table";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadFrontierPilotMenteeRosterPageData,
  type DohAuditEntry,
  type LoadFrontierMenteeRosterOptions,
} from "@/lib/mentoring/frontier-mentee-roster-load";

const TENANT = "frontier";
const PORTAL = "pilots";
const IN_CHUNK = 120;

function chunk<T>(arr: T[], size: number): T[][] {
  if (arr.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalizeEmp(value: string | null | undefined): string | null {
  const t = value != null ? String(value).trim() : "";
  return t.length > 0 ? t : null;
}

export type FrontierMentoringEmailCenterResolvedSource =
  | "mentor_contact_email"
  | "personal_email"
  | "email"
  | "preload_personal_email"
  | "preload_work_email"
  | null;

export type FrontierMentoringEmailCenterRow = MenteeRosterRow & {
  resolved_mentor_email: string | null;
  resolved_mentor_email_source: FrontierMentoringEmailCenterResolvedSource;
};

type ProfileEmailFields = {
  mentor_contact_email: string | null;
  personal_email: string | null;
  email: string | null;
};

type PreloadEmailFields = {
  personal_email: string | null;
  work_email: string | null;
};

function resolveLiveMentorEmail(p: ProfileEmailFields): {
  email: string | null;
  source: FrontierMentoringEmailCenterResolvedSource;
} {
  const mc = p.mentor_contact_email?.trim();
  if (mc) return { email: mc, source: "mentor_contact_email" };
  const pe = p.personal_email?.trim();
  if (pe) return { email: pe, source: "personal_email" };
  const em = p.email?.trim();
  if (em) return { email: em, source: "email" };
  return { email: null, source: null };
}

function resolveStagedMentorEmail(p: PreloadEmailFields): {
  email: string | null;
  source: FrontierMentoringEmailCenterResolvedSource;
} {
  const pe = p.personal_email?.trim();
  if (pe) return { email: pe, source: "preload_personal_email" };
  const we = p.work_email?.trim();
  if (we) return { email: we, source: "preload_work_email" };
  return { email: null, source: null };
}

type AssignmentMentorKeys = {
  mentor_user_id: string | null;
  mentor_employee_number: string | null;
};

/**
 * Email Center only: reuses `loadFrontierPilotMenteeRosterPageData` and enriches mentor send preview.
 * Does not change roster loader behavior or `MenteeRosterRow.mentor_email`.
 */
export async function loadFrontierMentoringEmailCenterPageData(
  options: LoadFrontierMenteeRosterOptions
): Promise<{
  roster: FrontierMentoringEmailCenterRow[];
  counts: { live: number; not_live: number; unassigned: number };
  dohAudit: DohAuditEntry[];
}> {
  const base = await loadFrontierPilotMenteeRosterPageData(options);
  const { roster: baseRoster, counts, dohAudit } = base;

  const assignmentIds = [
    ...new Set(
      baseRoster.map((r) => r.assignment_id).filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];

  if (assignmentIds.length === 0) {
    return {
      roster: baseRoster.map((r) => ({
        ...r,
        resolved_mentor_email: null,
        resolved_mentor_email_source: null,
      })),
      counts,
      dohAudit,
    };
  }

  const admin = createAdminClient();
  const assignmentById = new Map<string, AssignmentMentorKeys>();

  for (const part of chunk(assignmentIds, IN_CHUNK)) {
    const { data, error } = await admin
      .from("mentor_assignments")
      .select("id, mentor_user_id, mentor_employee_number")
      .in("id", part);
    if (error) break;
    for (const raw of data ?? []) {
      const row = raw as {
        id: string;
        mentor_user_id: string | null;
        mentor_employee_number: string | null;
      };
      assignmentById.set(row.id, {
        mentor_user_id: row.mentor_user_id != null ? String(row.mentor_user_id).trim() || null : null,
        mentor_employee_number: normalizeEmp(row.mentor_employee_number),
      });
    }
  }

  const mentorUserIds = new Set<string>();
  const mentorEmps = new Set<string>();
  for (const id of assignmentIds) {
    const m = assignmentById.get(id);
    if (!m) continue;
    if (m.mentor_user_id) mentorUserIds.add(m.mentor_user_id);
    if (m.mentor_employee_number) mentorEmps.add(m.mentor_employee_number);
  }

  const profileById = new Map<string, ProfileEmailFields>();
  for (const part of chunk([...mentorUserIds], IN_CHUNK)) {
    if (part.length === 0) continue;
    const { data, error } = await admin
      .from("profiles")
      .select("id, mentor_contact_email, personal_email, email")
      .in("id", part)
      .eq("tenant", TENANT)
      .eq("portal", PORTAL)
      .is("deleted_at", null);
    if (error) break;
    for (const raw of data ?? []) {
      const p = raw as ProfileEmailFields & { id: string };
      profileById.set(p.id, {
        mentor_contact_email: p.mentor_contact_email,
        personal_email: p.personal_email,
        email: p.email,
      });
    }
  }

  const profileByEmp = new Map<string, ProfileEmailFields>();
  for (const part of chunk([...mentorEmps], IN_CHUNK)) {
    if (part.length === 0) continue;
    const { data, error } = await admin
      .from("profiles")
      .select("employee_number, mentor_contact_email, personal_email, email")
      .eq("tenant", TENANT)
      .eq("portal", PORTAL)
      .is("deleted_at", null)
      .in("employee_number", part);
    if (error) break;
    for (const raw of data ?? []) {
      const p = raw as ProfileEmailFields & { employee_number: string | null };
      const emp = normalizeEmp(p.employee_number);
      if (!emp) continue;
      if (!profileByEmp.has(emp)) {
        profileByEmp.set(emp, {
          mentor_contact_email: p.mentor_contact_email,
          personal_email: p.personal_email,
          email: p.email,
        });
      }
    }
  }

  const preloadByEmp = new Map<string, PreloadEmailFields>();
  for (const part of chunk([...mentorEmps], IN_CHUNK)) {
    if (part.length === 0) continue;
    const { data, error } = await admin
      .from("mentor_preload")
      .select("employee_number, personal_email, work_email")
      .eq("tenant", TENANT)
      .in("employee_number", part);
    if (error) break;
    for (const raw of data ?? []) {
      const row = raw as PreloadEmailFields & { employee_number: string | null };
      const emp = normalizeEmp(row.employee_number);
      if (!emp) continue;
      if (!preloadByEmp.has(emp)) {
        preloadByEmp.set(emp, {
          personal_email: row.personal_email,
          work_email: row.work_email,
        });
      }
    }
  }

  function resolveMentorForAssignment(keys: AssignmentMentorKeys | undefined): {
    email: string | null;
    source: FrontierMentoringEmailCenterResolvedSource;
  } {
    if (!keys) return { email: null, source: null };
    const uid = keys.mentor_user_id;
    const emp = keys.mentor_employee_number;

    if (uid) {
      const byId = profileById.get(uid);
      if (byId) return resolveLiveMentorEmail(byId);
    }
    if (emp) {
      const byEmp = profileByEmp.get(emp);
      if (byEmp) return resolveLiveMentorEmail(byEmp);
      const preload = preloadByEmp.get(emp);
      if (preload) return resolveStagedMentorEmail(preload);
    }
    return { email: null, source: null };
  }

  const enriched: FrontierMentoringEmailCenterRow[] = baseRoster.map((r) => {
    if (!r.assignment_id) {
      return {
        ...r,
        resolved_mentor_email: null,
        resolved_mentor_email_source: null,
      };
    }
    const keys = assignmentById.get(r.assignment_id);
    const { email, source } = resolveMentorForAssignment(keys);
    return {
      ...r,
      resolved_mentor_email: email,
      resolved_mentor_email_source: source,
    };
  });

  return { roster: enriched, counts, dohAudit };
}

/**
 * Single-row lookup for server actions: reuses `loadFrontierMentoringEmailCenterPageData` so mentor email
 * resolution matches the Email Center table exactly.
 */
export async function loadFrontierMentoringEmailCenterRowByAssignmentId(
  assignmentId: string
): Promise<FrontierMentoringEmailCenterRow | null> {
  const id = assignmentId.trim();
  if (!id) return null;
  const { roster } = await loadFrontierMentoringEmailCenterPageData({
    collectDohAudit: false,
    emitDohAuditToConsole: false,
  });
  return roster.find((r) => r.assignment_id === id) ?? null;
}
