import { createAdminClient } from "@/lib/supabase/admin";
import { getMentoringOverviewStats } from "@/lib/mentoring/admin-overview-stats";
import {
  mentorshipProgramRequestStatusLabel,
  mentorshipProgramRequestTypeLabel,
} from "@/lib/mentoring/mentorship-program-request-labels";
import { resolveFrontierPilotAdminMentorshipProgramRequest } from "./actions";

export const dynamic = "force-dynamic";

const TENANT = "frontier";
const PORTAL = "pilots";

const statCard =
  "rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 transition-all duration-200";

const sectionCard = "rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 sm:p-6";

function formatRequestCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

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
  const [stats, programRequestsRes] = await Promise.all([
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
  ]);

  const programRequests: MentorshipProgramRequestRow[] =
    programRequestsRes.error || !programRequestsRes.data
      ? []
      : (programRequestsRes.data as MentorshipProgramRequestRow[]);

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <p className="text-sm text-slate-400 leading-relaxed">
          Frontier pilot mentoring roster for this tenant. Correct hire dates per assignment; saving updates milestone due
          dates from the standard schedule. Platform-wide backfill tools stay on the Platform Owner dashboard.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
        <div
          className={`${statCard} border-emerald-500/25 bg-emerald-500/[0.05] shadow-[inset_0_1px_0_0_rgba(16,185,129,0.07)]`}
        >
          <div className="text-xs text-slate-400 mb-1">Live Mentors</div>
          <div className="text-2xl font-semibold text-slate-200 tabular-nums">{stats.mentors}</div>
        </div>
        <div
          className={`${statCard} border-amber-500/25 bg-amber-500/[0.05] shadow-[inset_0_1px_0_0_rgba(245,158,11,0.07)]`}
        >
          <div className="text-xs text-slate-400 mb-1">Staged Mentors</div>
          <div className="text-2xl font-semibold text-slate-200 tabular-nums">{stats.stagedMentors}</div>
        </div>
        <div
          className={`${statCard} border-sky-500/25 bg-sky-500/[0.06] shadow-[inset_0_1px_0_0_rgba(14,165,233,0.08)]`}
        >
          <div className="text-xs text-slate-400 mb-1">Assigned Mentees</div>
          <div className="text-2xl font-semibold text-slate-200 tabular-nums">{stats.activeMentees}</div>
        </div>
        <div
          className={`${statCard} border-emerald-500/20 bg-emerald-500/[0.04] shadow-[inset_0_1px_0_0_rgba(16,185,129,0.05)]`}
        >
          <div className="text-xs text-slate-400 mb-1">Live Mentees</div>
          <div className="text-2xl font-semibold text-slate-200 tabular-nums">{stats.liveMentees}</div>
        </div>
        <div
          className={`${statCard} border-amber-500/25 bg-amber-500/[0.05] shadow-[inset_0_1px_0_0_rgba(245,158,11,0.07)] ${
            stats.unmatchedMentees > 0 ? "ring-1 ring-amber-400/20" : ""
          }`}
        >
          <div className="text-xs text-slate-400 mb-1">Unmatched Mentees</div>
          <div
            className={`text-2xl font-semibold tabular-nums ${stats.unmatchedMentees > 0 ? "text-amber-300" : "text-slate-200"}`}
          >
            {stats.unmatchedMentees}
          </div>
        </div>
        <div
          className={`${statCard} border-rose-500/25 bg-rose-500/[0.05] shadow-[inset_0_1px_0_0_rgba(244,63,94,0.07)] ${
            stats.missingMentorContact > 0 ? "ring-1 ring-rose-400/20" : ""
          }`}
        >
          <div className="text-xs text-slate-400 mb-1">Missing Mentor Contacts</div>
          <div
            className={`text-2xl font-semibold tabular-nums ${stats.missingMentorContact > 0 ? "text-rose-300" : "text-slate-200"}`}
          >
            {stats.missingMentorContact}
          </div>
        </div>
        <div
          className={`${statCard} border-violet-500/25 bg-violet-500/[0.05] shadow-[inset_0_1px_0_0_rgba(139,92,246,0.07)] ${
            stats.openMentorshipProgramRequests > 0 ? "ring-1 ring-violet-400/25" : ""
          }`}
        >
          <div className="text-xs text-slate-400 mb-1">Open Program Requests</div>
          <div
            className={`text-2xl font-semibold tabular-nums ${stats.openMentorshipProgramRequests > 0 ? "text-violet-200" : "text-slate-200"}`}
          >
            {stats.openMentorshipProgramRequests}
          </div>
        </div>
      </div>

      <section className={sectionCard} aria-labelledby="program-requests-heading">
        <h2 id="program-requests-heading" className="text-sm font-semibold text-slate-200">
          Mentorship program requests
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Submitted from the pilot Mentoring page when no assignment is listed yet.
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
    </div>
  );
}
