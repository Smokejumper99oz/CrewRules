import { MenteeRosterTable } from "../mentee-roster-table";
import { loadFrontierPilotMenteeRosterPageData } from "@/lib/mentoring/frontier-mentee-roster-load";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MenteeRosterMentorOption } from "./mentee-roster-mentor-options";

export const dynamic = "force-dynamic";

/** Re-export for callers that import types from the Mentee Roster page module. */
export type { MenteeRosterMentorOption } from "./mentee-roster-mentor-options";

const TENANT = "frontier";
const PORTAL = "pilots";

function normalizeMentorEmp(value: string | null | undefined): string | null {
  const t = value != null ? String(value).trim() : "";
  return t.length > 0 ? t : null;
}

function mentorOptionLabel(fullName: string | null | undefined, employeeNumber: string | null): string {
  const name = fullName != null ? String(fullName).trim() : "";
  const emp = employeeNumber;
  if (emp) {
    return `${name || "—"} · ${emp}`;
  }
  return name || "—";
}

/** Same name sort as `sortMentorRosterRows` on Mentor Roster (`mentor-roster/page.tsx`). */
function sortMentorPickerScratchRows(
  a: { full_name: string | null },
  b: { full_name: string | null }
): number {
  const an = (a.full_name ?? "").trim().toLowerCase() || "\uffff";
  const bn = (b.full_name ?? "").trim().toLowerCase() || "\uffff";
  return an.localeCompare(bn);
}

type ProfileMentorSource = {
  id: string;
  full_name: string | null;
  employee_number: string | null;
  welcome_modal_version_seen: number | null;
};

type ProfileMentorScratch = {
  rowKind: "profile";
  id: string;
  full_name: string | null;
  employee_number: string | null;
};

type PreloadMentorScratch = {
  rowKind: "preload";
  id: string;
  full_name: string | null;
  employee_number: string;
};

/**
 * Loads live + staged mentors using the same queries and preload exclusion as
 * `app/frontier/pilots/admin/mentoring/mentor-roster/page.tsx` (without mentor_registry / mentee counts).
 */
async function loadMenteeRosterMentorPickerOptions(): Promise<MenteeRosterMentorOption[]> {
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
    return [];
  }

  const mentors = (profiles ?? []) as ProfileMentorSource[];

  const profileEmp = new Set<string>();
  for (const m of mentors) {
    const e = (m.employee_number ?? "").trim();
    if (e && m.welcome_modal_version_seen != null) {
      profileEmp.add(e);
    }
  }

  const profileScratches: ProfileMentorScratch[] = mentors.map((m) => ({
    rowKind: "profile",
    id: m.id,
    full_name: m.full_name,
    employee_number: m.employee_number,
  }));

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

  const preloadScratches: PreloadMentorScratch[] = filteredPreloads.map((p) => ({
    rowKind: "preload",
    id: p.id,
    full_name: p.full_name,
    employee_number: p.employee_number,
  }));

  const scratches: Array<ProfileMentorScratch | PreloadMentorScratch> = [
    ...profileScratches,
    ...preloadScratches,
  ];

  scratches.sort(sortMentorPickerScratchRows);

  const options: MenteeRosterMentorOption[] = [];
  for (const row of scratches) {
    if (row.rowKind === "profile") {
      const emp = normalizeMentorEmp(row.employee_number);
      options.push({
        optionKey: `profile:${row.id}`,
        rowKind: "profile",
        label: mentorOptionLabel(row.full_name, emp),
        mentorUserId: row.id,
        mentorEmployeeNumber: emp,
      });
    } else {
      const emp = normalizeMentorEmp(row.employee_number);
      options.push({
        optionKey: `preload:${row.id}`,
        rowKind: "preload",
        label: mentorOptionLabel(row.full_name, emp),
        mentorUserId: null,
        mentorEmployeeNumber: emp,
      });
    }
  }

  return options;
}

function followUpQueryMeansOnly(raw: string | string[] | undefined): boolean {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v == null) return false;
  const t = String(v).trim();
  return t === "1" || t.toLowerCase() === "true";
}

type MenteeRosterPageProps = {
  searchParams: Promise<{ follow_up?: string | string[] }>;
};

export default async function FrontierPilotAdminMentoringMenteeRosterPage({ searchParams }: MenteeRosterPageProps) {
  const sp = await searchParams;
  const initialFollowUpOnly = followUpQueryMeansOnly(sp.follow_up);

  const collectDohAudit = process.env.MENTEE_ROSTER_DOH_AUDIT === "1";
  const [{ roster, counts }, mentorOptions] = await Promise.all([
    loadFrontierPilotMenteeRosterPageData({
      collectDohAudit,
      emitDohAuditToConsole: collectDohAudit,
    }),
    loadMenteeRosterMentorPickerOptions(),
  ]);

  return (
    <div className="space-y-4 lg:space-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight border-b border-white/5 pb-3 lg:pb-2">Mentee Roster</h1>
        <p className="mt-2 text-sm text-slate-400 leading-snug lg:mt-1.5">
          Frontier Airlines first-year pilots and mentoring assignment rows. Left CRA shows mentee CrewRules activation.
          Right CRA shows mentor CrewRules activation. Staged mentors may appear without a live account.
        </p>
        <p className="mt-1.5 text-xs text-slate-500">
          Live = mentor and mentee are both active in CrewRules · Not Live = mentor assigned but one or both have not
          activated CrewRules yet · Unassigned = no mentor assigned · Left CRA shows mentee activation · Right CRA shows
          mentor activation
        </p>
      </div>

      {roster.length === 0 ? (
        <p className="text-sm text-slate-500">No roster rows yet.</p>
      ) : (
        <MenteeRosterTable
          roster={roster}
          counts={counts}
          mentorOptions={mentorOptions}
          initialFollowUpOnly={initialFollowUpOnly}
        />
      )}
    </div>
  );
}
