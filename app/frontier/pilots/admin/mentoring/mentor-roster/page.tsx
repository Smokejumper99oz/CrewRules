import { createAdminClient } from "@/lib/supabase/admin";
import { MentorRosterTable, type MentorRosterRow } from "../mentor-roster-table";

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

export default async function FrontierPilotAdminMentoringMentorRosterPage() {
  const admin = createAdminClient();

  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select(
      "id, full_name, employee_number, phone, mentor_phone, mentor_contact_email, welcome_modal_version_seen"
    )
    .eq("tenant", TENANT)
    .eq("portal", PORTAL)
    .eq("is_mentor", true)
    .is("deleted_at", null)
    .order("full_name", { ascending: true, nullsFirst: false });

  if (pErr) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight border-b border-white/5 pb-3">Mentor Roster</h1>
        <p className="text-sm text-red-400">Could not load mentors.</p>
      </div>
    );
  }

  const mentors = (profiles ?? []) as Omit<MentorRosterRow, "mentee_count">[];
  const mentorIds = mentors.map((m) => m.id);

  const menteeCountByMentor = new Map<string, number>();
  for (const id of mentorIds) menteeCountByMentor.set(id, 0);

  if (mentorIds.length > 0) {
    for (const part of chunk(mentorIds, IN_CHUNK)) {
      const { data: rows, error: aErr } = await admin
        .from("mentor_assignments")
        .select("mentor_user_id")
        .eq("active", true)
        .not("mentee_user_id", "is", null)
        .in("mentor_user_id", part);

      if (aErr) break;

      for (const r of rows ?? []) {
        const mid = (r as { mentor_user_id: string }).mentor_user_id;
        if (!mid) continue;
        menteeCountByMentor.set(mid, (menteeCountByMentor.get(mid) ?? 0) + 1);
      }
    }
  }

  const rows: MentorRosterRow[] = mentors.map((m) => ({
    ...m,
    mentee_count: menteeCountByMentor.get(m.id) ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight border-b border-white/5 pb-3">Mentor Roster</h1>
        <p className="mt-2 text-sm text-slate-400 leading-snug">
          Pilots flagged as mentors in this tenant, with active assignment mentee counts. Preload-only mentors (not yet on
          CrewRules) stay in Mentor Imports until matched.
        </p>
      </div>

      {mentors.length === 0 ? (
        <p className="text-sm text-slate-500">No mentors yet. Mark pilots as mentors on Users or assign via mentoring
          imports.</p>
      ) : (
        <MentorRosterTable rows={rows} />
      )}
    </div>
  );
}
