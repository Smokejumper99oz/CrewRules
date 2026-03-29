import { createAdminClient } from "@/lib/supabase/admin";
import { isWithinFirstYearSinceDateOfHire } from "@/lib/profile";
import { pickNextMilestoneAmongPending } from "@/lib/mentoring/milestone-program-order";
import { MenteeRosterTable, type MenteeRosterRow } from "../mentee-roster-table";

export const dynamic = "force-dynamic";

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
  assigned_at: string | null;
  active: boolean | null;
  hire_date: string | null;
  mentee_display_name: string | null;
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
  assigned_at,
  active,
  hire_date,
  mentee_display_name,
  mentor:profiles!mentor_assignments_mentor_user_id_fkey(full_name, personal_email, phone, welcome_modal_version_seen),
  mentee:profiles!mentor_assignments_mentee_user_id_fkey(full_name, employee_number, date_of_hire, personal_email, phone, welcome_modal_version_seen),
  workspace:mentorship_mentor_workspace(mentoring_status),
  milestones:mentorship_milestones(milestone_type, due_date, completed_date)
`;

export default async function FrontierPilotAdminMentoringMenteeRosterPage() {
  const admin = createAdminClient();

  const { data: mentorRows, error: mErr } = await admin
    .from("profiles")
    .select("id")
    .eq("tenant", TENANT)
    .eq("portal", PORTAL);

  const mentorIds = [...new Set((mentorRows ?? []).map((r) => (r as { id: string }).id))];

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

  const assignmentEmpSet = new Set((assignments ?? []).map((a) => normalize(a.employee_number)));

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, employee_number, date_of_hire, tenant, portal, personal_email, phone")
    .eq("tenant", TENANT)
    .eq("portal", PORTAL)
    .is("deleted_at", null);

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

  for (const a of assignments) {
    const emp = normalize(a.employee_number);
    const mentee = a.mentee;
    const name =
      (mentee?.full_name && mentee.full_name.trim()) ||
      (a.mentee_display_name && a.mentee_display_name.trim()) ||
      "—";
    const hireDate = mentee?.date_of_hire ?? a.hire_date ?? null;
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
    roster.push({
      key: a.id,
      name,
      employee_number: emp || "—",
      hire_date: hireDate,
      mentor_name: m?.full_name ?? "—",
      mentorship_status: workspaceRow?.mentoring_status ?? "Active",
      next_milestone: nextMilestoneLabel,
      mentor_account: m?.welcome_modal_version_seen == null ? "not_joined" : "active",
      mentee_account: a.mentee?.welcome_modal_version_seen == null ? "not_joined" : "active",
      status: a.mentee_user_id ? "assigned" : "pending",
      mentee_email: mentee?.personal_email?.trim() || null,
      mentee_phone: mentee?.phone?.trim() || null,
      mentor_email: m?.personal_email?.trim() || null,
      mentor_phone: m?.phone?.trim() || null,
    });
  }

  for (const p of profiles ?? []) {
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
    roster.push({
      key: `unassigned-${pr.id}`,
      name: pr.full_name?.trim() || "—",
      employee_number: emp,
      hire_date: p.date_of_hire ?? null,
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

  const counts = {
    assigned: roster.filter((r) => r.status === "assigned").length,
    pending: roster.filter((r) => r.status === "pending").length,
    unassigned: roster.filter((r) => r.status === "unassigned").length,
  };

  const statusOrder = {
    unassigned: 0,
    pending: 1,
    assigned: 2,
  };

  roster.sort((a, b) => {
    const s = statusOrder[a.status] - statusOrder[b.status];
    if (s !== 0) return s;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight border-b border-white/5 pb-3">Mentee Roster</h1>
        <p className="mt-2 text-sm text-slate-400 leading-snug">
          First-year pilots in this tenant, including assignment rows (assigned or pending link) and anyone without a
          mentoring assignment by employee number.
        </p>
      </div>

      {roster.length === 0 ? (
        <p className="text-sm text-slate-500">No roster rows yet.</p>
      ) : (
        <MenteeRosterTable roster={roster} counts={counts} />
      )}
    </div>
  );
}
