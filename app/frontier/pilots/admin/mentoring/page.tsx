import { createAdminClient } from "@/lib/supabase/admin";
import { getMentoringOverviewStats } from "@/lib/mentoring/admin-overview-stats";
import {
  mentorshipProgramRequestStatusLabel,
  mentorshipProgramRequestTypeLabel,
} from "@/lib/mentoring/mentorship-program-request-labels";
import { resolveFrontierPilotAdminMentorshipProgramRequest } from "./actions";
import { ContactsEditor } from "./contacts-editor";

export const dynamic = "force-dynamic";

const TENANT = "frontier";
const PORTAL = "pilots";

const sectionCard = "rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 sm:p-6";

function formatRequestCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

type ContactCard = {
  id: string;
  title: string;
  subtitle: string;
  icon_key: string;
  sort_order: number;
  entries: { label: string; value: string; href?: string }[];
};

type MentorshipProgramRequestRow = {
  id: string;
  tenant: string;
  portal: string;
  user_id: string;
  request_type: string;
  status: string;
  message: string | null;
  created_at: string;
  updated_at: string;
  profiles: {
    full_name: string | null;
    email: string | null;
    employee_number: string | null;
  } | null;
};

export default async function FrontierPilotAdminMentoringPage() {
  const admin = createAdminClient();
  const [stats, programRequestsRes, contactsRes] = await Promise.all([
    getMentoringOverviewStats(admin, { kind: "tenant", tenant: TENANT, portal: PORTAL }),
    admin
      .from("mentorship_program_requests")
      .select(
        `
        *,
        profiles:profiles!mentorship_program_requests_user_id_fkey (
          full_name,
          email,
          employee_number
        )
      `
      )
      .eq("tenant", TENANT)
      .order("created_at", { ascending: false }),
    admin
      .from("mentoring_contacts")
      .select("id, title, subtitle, icon_key, sort_order, entries")
      .eq("tenant", TENANT)
      .eq("portal", PORTAL)
      .order("sort_order", { ascending: true }),
  ]);

  const programRequests: MentorshipProgramRequestRow[] =
    programRequestsRes.error || !programRequestsRes.data
      ? []
      : (programRequestsRes.data as MentorshipProgramRequestRow[]);

  const initialContacts: ContactCard[] = contactsRes.error || !contactsRes.data
    ? []
    : (contactsRes.data as ContactCard[]);

  return (
    <div className="space-y-8">
      <div className="max-w-3xl space-y-1">
        <p className="text-sm text-slate-300 leading-relaxed">
          Manage the Frontier Airlines pilot mentoring program. View assignments, rosters, and program requests for all Frontier pilots enrolled in the ALPA mentoring program.
        </p>
        <p className="text-sm text-slate-500 leading-relaxed">
          Hire dates can be corrected directly on each assignment — saving automatically recalculates milestone due dates. Bulk imports are available under the Mentee Imports and Mentor Imports tabs above.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {/* Live Mentors */}
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.05] px-3 py-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-slate-300">Live Mentors</div>
            <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">Active CrewRules™ mentor accounts</div>
          </div>
          <span className="text-lg font-semibold text-slate-200 tabular-nums shrink-0">{stats.mentors}</span>
        </div>
        {/* Staged Mentors */}
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.05] px-3 py-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-slate-300">Staged Mentors</div>
            <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">In system, not yet live</div>
          </div>
          <span className="text-lg font-semibold text-slate-200 tabular-nums shrink-0">{stats.stagedMentors}</span>
        </div>
        {/* Assigned Mentees */}
        <div className="rounded-lg border border-sky-500/25 bg-sky-500/[0.06] px-3 py-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-slate-300">Assigned Mentees</div>
            <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">Paired with a mentor</div>
          </div>
          <span className="text-lg font-semibold text-slate-200 tabular-nums shrink-0">{stats.activeMentees}</span>
        </div>
        {/* Live Mentees */}
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-slate-300">Live Mentees</div>
            <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">Active CrewRules™ mentee accounts</div>
          </div>
          <span className="text-lg font-semibold text-slate-200 tabular-nums shrink-0">{stats.liveMentees}</span>
        </div>
        {/* Unlinked Mentees */}
        <div className={`rounded-lg border border-amber-500/25 bg-amber-500/[0.05] px-3 py-3 flex items-start justify-between gap-3${stats.unmatchedMentees > 0 ? " ring-1 ring-amber-400/20" : ""}`}>
          <div>
            <div className="text-xs font-medium text-slate-300">Unlinked Mentees</div>
            <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">Assignment exists, no CrewRules™ mentee account linked yet</div>
          </div>
          <span className={`text-lg font-semibold tabular-nums shrink-0 ${stats.unmatchedMentees > 0 ? "text-amber-300" : "text-slate-200"}`}>
            {stats.unmatchedMentees}
          </span>
        </div>
        {/* Mentor Contact Incomplete */}
        <div className={`rounded-lg border border-rose-500/25 bg-rose-500/[0.05] px-3 py-3 flex items-start justify-between gap-3${stats.missingMentorContact > 0 ? " ring-1 ring-rose-400/20" : ""}`}>
          <div>
            <div className="text-xs font-medium text-slate-300">Contact Incomplete</div>
            <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">Mentor missing phone or email on their profile</div>
          </div>
          <span className={`text-lg font-semibold tabular-nums shrink-0 ${stats.missingMentorContact > 0 ? "text-rose-300" : "text-slate-200"}`}>
            {stats.missingMentorContact}
          </span>
        </div>
        {/* Open Program Requests */}
        <div className={`rounded-lg border border-violet-500/25 bg-violet-500/[0.05] px-3 py-3 flex items-start justify-between gap-3${stats.openMentorshipProgramRequests > 0 ? " ring-1 ring-violet-400/25" : ""}`}>
          <div>
            <div className="text-xs font-medium text-slate-300">Open Requests</div>
            <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">Pilots requesting to join the program</div>
          </div>
          <span className={`text-lg font-semibold tabular-nums shrink-0 ${stats.openMentorshipProgramRequests > 0 ? "text-violet-200" : "text-slate-200"}`}>
            {stats.openMentorshipProgramRequests}
          </span>
        </div>
      </div>

      <section className={sectionCard} aria-labelledby="program-requests-heading">
        <h2 id="program-requests-heading" className="text-base font-semibold text-slate-200">
          ALPA Mentorship Program Requests
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Submitted by Frontier pilots via the Mentoring page when no active assignment is on file yet.
        </p>
        {programRequests.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">None yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-white/5 bg-white/5">
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Created</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Pilot</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {programRequests.map((req) => {
                  const p = req.profiles;
                  const name = (p?.full_name ?? "").trim() || "—";
                  const email = (p?.email ?? "").trim() || "—";
                  const emp = (p?.employee_number ?? "").trim();
                  return (
                    <tr key={req.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-slate-300 tabular-nums">
                        {formatRequestCreatedAt(req.created_at)}
                      </td>
                      <td className="px-4 py-3 max-w-[240px]">
                        <div className="text-slate-200 truncate" title={name !== "—" ? name : undefined}>
                          {name}
                        </div>
                        <div
                          className="text-slate-500 text-xs mt-0.5 truncate"
                          title={email !== "—" ? email : undefined}
                        >
                          {email}
                        </div>
                        <div className="text-slate-500 text-xs mt-0.5 font-mono tabular-nums">
                          {emp ? `Emp # ${emp}` : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {mentorshipProgramRequestTypeLabel(req.request_type)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${
                              req.status === "resolved"
                                ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
                                : "border-amber-500/40 bg-amber-500/20 text-amber-200"
                            }`}
                          >
                            {mentorshipProgramRequestStatusLabel(req.status)}
                          </span>
                          {req.status === "open" ? (
                            <form action={resolveFrontierPilotAdminMentorshipProgramRequest} className="inline">
                              <input type="hidden" name="requestId" value={req.id} />
                              <button
                                type="submit"
                                className="inline-flex rounded-md border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25"
                              >
                                Close
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ContactsEditor initialCards={initialContacts} />
    </div>
  );
}
