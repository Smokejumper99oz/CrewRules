import { createAdminClient } from "@/lib/supabase/admin";
import {
  updateFrontierPilotAdminMentorPreloadFromRoster,
  upsertFrontierPilotAdminMentorRegistry,
} from "../actions";
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

type MentorRegistryFields = {
  mentor_type: string | null;
  mentor_status: string | null;
  admin_notes: string | null;
};

function sortMentorRosterRows(a: MentorRosterRow, b: MentorRosterRow): number {
  const an = (a.full_name ?? "").trim().toLowerCase() || "\uffff";
  const bn = (b.full_name ?? "").trim().toLowerCase() || "\uffff";
  return an.localeCompare(bn);
}

async function mentorRegistryByProfileIds(
  admin: ReturnType<typeof createAdminClient>,
  profileIds: string[]
): Promise<Map<string, MentorRegistryFields>> {
  const map = new Map<string, MentorRegistryFields>();
  if (profileIds.length === 0) return map;
  for (const part of chunk(profileIds, IN_CHUNK)) {
    const { data, error } = await admin
      .from("mentor_registry")
      .select("profile_id, mentor_type, mentor_status, admin_notes")
      .in("profile_id", part);
    if (error) break;
    for (const raw of data ?? []) {
      const r = raw as {
        profile_id: string;
        mentor_type: string | null;
        mentor_status: string | null;
        admin_notes: string | null;
      };
      map.set(r.profile_id, {
        mentor_type: r.mentor_type,
        mentor_status: r.mentor_status,
        admin_notes: r.admin_notes,
      });
    }
  }
  return map;
}

async function mentorRegistryByPreloadIds(
  admin: ReturnType<typeof createAdminClient>,
  preloadIds: string[]
): Promise<Map<string, MentorRegistryFields>> {
  const map = new Map<string, MentorRegistryFields>();
  if (preloadIds.length === 0) return map;
  for (const part of chunk(preloadIds, IN_CHUNK)) {
    const { data, error } = await admin
      .from("mentor_registry")
      .select("preload_id, mentor_type, mentor_status, admin_notes")
      .in("preload_id", part);
    if (error) break;
    for (const raw of data ?? []) {
      const r = raw as {
        preload_id: string;
        mentor_type: string | null;
        mentor_status: string | null;
        admin_notes: string | null;
      };
      map.set(r.preload_id, {
        mentor_type: r.mentor_type,
        mentor_status: r.mentor_status,
        admin_notes: r.admin_notes,
      });
    }
  }
  return map;
}

export default async function FrontierPilotAdminMentoringMentorRosterPage() {
  const admin = createAdminClient();

  const { data: profiles, error: pErr } = await admin
    .from("profiles")
    .select(
      "id, full_name, employee_number, phone, mentor_phone, mentor_contact_email, email, position, base_airport, welcome_modal_version_seen"
    )
    .eq("tenant", TENANT)
    .eq("portal", PORTAL)
    .eq("is_mentor", true)
    .is("deleted_at", null);

  if (pErr) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight border-b border-white/5 pb-3">Mentor Roster</h1>
        <p className="text-sm text-red-400">Could not load mentors.</p>
      </div>
    );
  }

  type ProfileMentor = {
    id: string;
    full_name: string | null;
    employee_number: string | null;
    phone: string | null;
    mentor_phone: string | null;
    mentor_contact_email: string | null;
    email: string | null;
    position: string | null;
    base_airport: string | null;
    welcome_modal_version_seen: number | null;
  };

  const mentors = (profiles ?? []) as ProfileMentor[];
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

  const profileRegistryMap = await mentorRegistryByProfileIds(admin, mentorIds);

  const profileEmp = new Set<string>();
  for (const m of mentors) {
    const e = (m.employee_number ?? "").trim();
    if (e && m.welcome_modal_version_seen != null) {
      profileEmp.add(e);
    }
  }

  const profileRows: MentorRosterRow[] = mentors.map((m) => {
    const phoneRaw =
      (m.mentor_phone ?? "").trim() || (m.phone ?? "").trim() || null;
    const mentorContact = (m.mentor_contact_email ?? "").trim();
    const profileEmail = (m.email ?? "").trim();
    const emailRaw =
      mentorContact.length > 0
        ? mentorContact
        : profileEmail.length > 0
          ? profileEmail
          : null;
    const reg = profileRegistryMap.get(m.id);
    return {
      rowKind: "profile" as const,
      id: m.id,
      full_name: m.full_name,
      employee_number: m.employee_number,
      phone: phoneRaw,
      email: emailRaw,
      position: m.position ?? null,
      base_airport: m.base_airport ?? null,
      mentor_type: reg?.mentor_type ?? null,
      mentor_status: reg?.mentor_status ?? null,
      admin_notes: reg?.admin_notes ?? null,
      mentee_count: menteeCountByMentor.get(m.id) ?? 0,
    };
  });

  const { data: preloadRaw, error: preloadErr } = await admin
    .from("mentor_preload")
    .select(
      "id, full_name, employee_number, phone, work_email, personal_email, position, base_airport, notes, active"
    )
    .eq("tenant", TENANT)
    .is("matched_profile_id", null);

  type PreloadRow = {
    id: string;
    full_name: string | null;
    employee_number: string;
    phone: string | null;
    work_email: string | null;
    personal_email: string | null;
    position: string | null;
    base_airport: string | null;
    notes: string | null;
    active: boolean;
  };

  const filteredPreloads: PreloadRow[] =
    preloadErr || !preloadRaw
      ? []
      : (preloadRaw as PreloadRow[]).filter((p) => {
          const e = (p.employee_number ?? "").trim();
          return !e || !profileEmp.has(e);
        });

  const preloadRegistryMap = await mentorRegistryByPreloadIds(
    admin,
    filteredPreloads.map((p) => p.id)
  );

  const preloadRows: MentorRosterRow[] = filteredPreloads.map((p) => {
    const reg = preloadRegistryMap.get(p.id);
    return {
      rowKind: "preload" as const,
      id: p.id,
      full_name: p.full_name,
      employee_number: p.employee_number,
      phone: (p.phone ?? "").trim() || null,
      email: (p.work_email ?? "").trim() || null,
      personal_email: (p.personal_email ?? "").trim() || null,
      position: p.position ?? null,
      base_airport: p.base_airport ?? null,
      preload_notes: p.notes ?? null,
      preload_active: p.active,
      mentor_type: reg?.mentor_type ?? null,
      mentor_status: reg?.mentor_status ?? null,
      admin_notes: reg?.admin_notes ?? null,
      mentee_count: 0,
    };
  });

  const rows = [...profileRows, ...preloadRows].sort(sortMentorRosterRows);

  return (
    <div className="space-y-4 lg:space-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight border-b border-white/5 pb-3 lg:pb-2">Mentor Roster</h1>
        <p className="mt-2 text-sm text-slate-400 leading-snug lg:mt-1.5">
          CrewRules mentors (green CRA) and preloaded roster rows not yet matched to an account (amber CRA). Inactive
          staging rows stay on the roster with a muted CRA and an Inactive staging badge. Mentee counts apply to matched
          mentors with active assignments only. Position and base come from the pilot profile after signup; staging rows
          use preload values until link.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          No mentors yet. Mark pilots as mentors on Users, assign via mentoring imports, or preload mentors via Mentor
          Imports.
        </p>
      ) : (
        <MentorRosterTable
          rows={rows}
          saveMentorRegistry={upsertFrontierPilotAdminMentorRegistry}
          saveMentorPreloadStaging={updateFrontierPilotAdminMentorPreloadFromRoster}
        />
      )}
    </div>
  );
}
