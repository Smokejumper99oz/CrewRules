import { createAdminClient } from "@/lib/supabase/admin";

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

export type MentorEmailDetailRow = {
  resendEmailId: string;
  classDate: string | null;
  mentorName: string;
  menteeName: string;
  email: string;
  sentAt: string | null;
  openedAt: string | null;
  status: "opened" | "pending";
  assignmentId: string | null;
};

type EmailEventRow = {
  id: string;
  assignment_id: string;
  email: string;
  event_type: string;
  resend_email_id: string;
  created_at: string;
};

type AssignmentRow = {
  id: string;
  hire_date: string | null;
  employee_number: string | null;
  mentee_user_id: string | null;
  mentor_user_id: string | null;
  mentor_employee_number: string | null;
  mentee_display_name: string | null;
};

function hireDateToIsoString(value: string | null | undefined): string | null {
  if (value == null || !String(value).trim()) return null;
  const s = String(value).trim();
  const head = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head;
  return s;
}

/**
 * Message-level mentor assignment email rows (one per Resend message id).
 * Server-only; uses service role. Scoped to Frontier pilots profiles / preload when resolving names.
 */
export async function getMentorEmailDetailRows(): Promise<MentorEmailDetailRow[]> {
  const admin = createAdminClient();

  const { data: eventRows, error: evErr } = await admin
    .from("mentor_email_events")
    .select("id, assignment_id, email, event_type, resend_email_id, created_at")
    .not("assignment_id", "is", null)
    .not("resend_email_id", "is", null)
    .order("created_at", { ascending: true });

  if (evErr) {
    console.error("[mentor_email_detail_rows] mentor_email_events:", evErr);
    return [];
  }

  const events = (eventRows ?? []) as EmailEventRow[];
  if (events.length === 0) return [];

  const byResend = new Map<string, EmailEventRow[]>();
  for (const e of events) {
    const rid = String(e.resend_email_id ?? "").trim();
    if (!rid) continue;
    if (!byResend.has(rid)) byResend.set(rid, []);
    byResend.get(rid)!.push(e);
  }

  type GroupAgg = {
    resendEmailId: string;
    sentAt: string | null;
    openedAt: string | null;
    email: string;
    assignmentId: string | null;
  };

  const groups: GroupAgg[] = [];
  for (const [resendEmailId, list] of byResend) {
    const sorted = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const sentRows = sorted.filter((r) => r.event_type === "sent");
    const openedRows = sorted.filter((r) => r.event_type === "opened");
    const firstSent = sentRows[0];
    const firstOpened = openedRows[0];

    const sentAt = firstSent?.created_at ?? null;
    const openedAt = firstOpened?.created_at ?? null;

    const emailFromSent = firstSent?.email?.trim() ?? "";
    const emailFallback = sorted.map((r) => r.email?.trim()).find((x) => x && x.length > 0) ?? "";
    const email = emailFromSent || emailFallback;

    const assignmentFromSent = firstSent?.assignment_id != null ? String(firstSent.assignment_id).trim() : "";
    const assignmentFallback =
      sorted.map((r) => (r.assignment_id != null ? String(r.assignment_id).trim() : "")).find((x) => x.length > 0) ??
      "";
    const assignmentIdRaw = assignmentFromSent || assignmentFallback;
    const assignmentId = assignmentIdRaw.length > 0 ? assignmentIdRaw : null;

    groups.push({
      resendEmailId,
      sentAt,
      openedAt,
      email,
      assignmentId,
    });
  }

  const assignmentIds = [...new Set(groups.map((g) => g.assignmentId).filter((id): id is string => Boolean(id)))];
  const assignmentById = new Map<string, AssignmentRow>();

  for (const part of chunk(assignmentIds, IN_CHUNK)) {
    if (part.length === 0) continue;
    const { data, error } = await admin
      .from("mentor_assignments")
      .select(
        "id, hire_date, employee_number, mentee_user_id, mentor_user_id, mentor_employee_number, mentee_display_name"
      )
      .in("id", part);
    if (error) {
      console.error("[mentor_email_detail_rows] mentor_assignments:", error);
      continue;
    }
    for (const raw of data ?? []) {
      const a = raw as AssignmentRow;
      assignmentById.set(String(a.id), a);
    }
  }

  const mentorUserIds = new Set<string>();
  const menteeUserIds = new Set<string>();
  const mentorEmps = new Set<string>();
  for (const id of assignmentIds) {
    const a = assignmentById.get(id);
    if (!a) continue;
    const muid = a.mentor_user_id != null ? String(a.mentor_user_id).trim() : "";
    if (muid) mentorUserIds.add(muid);
    const meuid = a.mentee_user_id != null ? String(a.mentee_user_id).trim() : "";
    if (meuid) menteeUserIds.add(meuid);
    const me = normalizeEmp(a.mentor_employee_number);
    if (me) mentorEmps.add(me);
  }

  const profileById = new Map<string, { full_name: string | null }>();
  const profileByEmp = new Map<string, { full_name: string | null }>();

  const allProfileIds = [...new Set([...mentorUserIds, ...menteeUserIds])];
  for (const part of chunk(allProfileIds, IN_CHUNK)) {
    if (part.length === 0) continue;
    const { data, error } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", part)
      .eq("tenant", TENANT)
      .eq("portal", PORTAL)
      .is("deleted_at", null);
    if (error) continue;
    for (const raw of data ?? []) {
      const p = raw as { id: string; full_name: string | null };
      profileById.set(p.id, { full_name: p.full_name });
    }
  }

  for (const part of chunk([...mentorEmps], IN_CHUNK)) {
    if (part.length === 0) continue;
    const { data, error } = await admin
      .from("profiles")
      .select("employee_number, full_name")
      .eq("tenant", TENANT)
      .eq("portal", PORTAL)
      .is("deleted_at", null)
      .in("employee_number", part);
    if (error) continue;
    for (const raw of data ?? []) {
      const p = raw as { employee_number: string | null; full_name: string | null };
      const emp = normalizeEmp(p.employee_number);
      if (emp && !profileByEmp.has(emp)) {
        profileByEmp.set(emp, { full_name: p.full_name });
      }
    }
  }

  const preloadNameByEmp = new Map<string, string | null>();
  for (const part of chunk([...mentorEmps], IN_CHUNK)) {
    if (part.length === 0) continue;
    const { data, error } = await admin
      .from("mentor_preload")
      .select("employee_number, full_name")
      .eq("tenant", TENANT)
      .in("employee_number", part);
    if (error) continue;
    for (const raw of data ?? []) {
      const r = raw as { employee_number: string | null; full_name: string | null };
      const emp = normalizeEmp(r.employee_number);
      if (emp && !preloadNameByEmp.has(emp)) {
        preloadNameByEmp.set(emp, r.full_name);
      }
    }
  }

  function resolveMentorName(a: AssignmentRow | undefined): string {
    if (!a) return "Unassigned mentor";
    const uid = a.mentor_user_id != null ? String(a.mentor_user_id).trim() : "";
    if (uid) {
      const fn = profileById.get(uid)?.full_name?.trim();
      if (fn) return fn;
    }
    const emp = normalizeEmp(a.mentor_employee_number);
    if (emp) {
      const byEmp = profileByEmp.get(emp)?.full_name?.trim();
      if (byEmp) return byEmp;
      const pre = preloadNameByEmp.get(emp)?.trim();
      if (pre) return pre;
      return `Emp. ${emp}`;
    }
    return "Unassigned mentor";
  }

  function resolveMenteeName(a: AssignmentRow | undefined): string {
    if (!a) return "Unknown mentee";
    const menteeUid = a.mentee_user_id != null ? String(a.mentee_user_id).trim() : "";
    if (menteeUid) {
      const fn = profileById.get(menteeUid)?.full_name?.trim();
      if (fn) return fn;
    }
    const display = a.mentee_display_name?.trim();
    if (display) return display;
    const emp = normalizeEmp(a.employee_number);
    if (emp) return `Emp. ${emp}`;
    return "Unknown mentee";
  }

  const rows: MentorEmailDetailRow[] = [];
  for (const g of groups) {
    const a = g.assignmentId ? assignmentById.get(g.assignmentId) : undefined;
    const classDate = a ? hireDateToIsoString(a.hire_date) : null;
    const mentorName = resolveMentorName(a);
    const menteeName = resolveMenteeName(a);
    const status: "opened" | "pending" = g.openedAt ? "opened" : "pending";

    rows.push({
      resendEmailId: g.resendEmailId,
      classDate,
      mentorName,
      menteeName,
      email: g.email,
      sentAt: g.sentAt,
      openedAt: g.openedAt,
      status,
      assignmentId: g.assignmentId,
    });
  }

  rows.sort((x, y) => {
    const px = x.status === "pending" ? 0 : 1;
    const py = y.status === "pending" ? 0 : 1;
    if (px !== py) return px - py;
    const tx = x.sentAt ? new Date(x.sentAt).getTime() : 0;
    const ty = y.sentAt ? new Date(y.sentAt).getTime() : 0;
    return ty - tx;
  });

  return rows.filter((r) => r.openedAt === null);
}
