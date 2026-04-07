import { redirect } from "next/navigation";
import { getProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { sortMilestonesByProgramOrder } from "@/lib/mentoring/milestone-program-order";
import { format } from "date-fns";
import { FolderOpen, CheckCircle2, Circle } from "lucide-react";

export const dynamic = "force-dynamic";

const MILESTONE_LABELS: Record<string, string> = {
  initial_assignment: "Initial Check-in",
  type_rating:        "Type Rating",
  oe_complete:        "IOE Complete",
  three_months:       "3 Month On Line",
  six_months:         "6 Month On Line",
  nine_months:        "9 Month On Line",
  probation_checkride:"Probation Checkride",
};

const ARCHIVE_REASON_LABELS: Record<string, string> = {
  left_frontier:      "Left Frontier Airlines",
  completed_program:  "Program Completed",
};

function fmt(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr + "T12:00:00.000Z");
    if (Number.isNaN(d.getTime())) return "—";
    return format(d, "MMMM d, yyyy");
  } catch { return "—"; }
}

export default async function ProgramHistoryPage() {
  const profile = await getProfile();
  if (!profile) redirect("/frontier/pilots/login?error=not_signed_in");

  const supabase = await createClient();

  // Fetch all inactive assignments where current user is the mentee
  const { data: rawAssignments } = await supabase
    .from("mentor_assignments")
    .select(`
      id,
      hire_date,
      active,
      assignment_archive_reason,
      assigned_at,
      mentor_user_id,
      mentor_employee_number,
      mentee_display_name,
      mentor:profiles!mentor_assignments_mentor_user_id_fkey(full_name, position)
    `)
    .eq("mentee_user_id", profile.id)
    .eq("active", false)
    .order("assigned_at", { ascending: false });

  type AssignmentRow = {
    id: string;
    hire_date: string | null;
    active: boolean;
    assignment_archive_reason: string | null;
    assigned_at: string | null;
    mentor_user_id: string | null;
    mentor_employee_number: string | null;
    mentee_display_name: string | null;
    // Supabase returns FK joins as an array; we take [0] below
    mentor: { full_name: string | null; position: string | null }[] | null;
  };
  const assignments = (rawAssignments ?? []) as AssignmentRow[];

  // Fetch milestones for all archived assignments
  const assignmentIds = assignments.map((a) => a.id);
  const { data: rawMilestones } = assignmentIds.length > 0
    ? await supabase
        .from("mentorship_milestones")
        .select("assignment_id, milestone_type, due_date, completed_date")
        .in("assignment_id", assignmentIds)
    : { data: [] };

  const milestonesByAssignment = new Map<string, typeof rawMilestones>();
  for (const m of rawMilestones ?? []) {
    const row = m as { assignment_id: string; milestone_type: string; due_date: string; completed_date: string | null };
    const aid = row.assignment_id;
    if (!milestonesByAssignment.has(aid)) milestonesByAssignment.set(aid, []);
    milestonesByAssignment.get(aid)!.push(m);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-slate-400" aria-hidden />
          Program History
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Your completed or closed mentorship assignments, including milestones and mentor information for reference.
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-slate-900/40 px-6 py-10 text-center">
          <FolderOpen className="mx-auto h-8 w-8 text-slate-600 mb-3" aria-hidden />
          <p className="text-sm text-slate-500">No archived assignments yet.</p>
          <p className="text-xs text-slate-600 mt-1">Once your mentorship program is complete, it will appear here.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {assignments.map((a) => {
            const mentorName = a.mentor?.[0]?.full_name?.trim() || null;
            const mentorPosition = a.mentor?.[0]?.position?.trim() || null;
            const archiveLabel = a.assignment_archive_reason
              ? ARCHIVE_REASON_LABELS[a.assignment_archive_reason] ?? a.assignment_archive_reason
              : null;

            const rawMs = milestonesByAssignment.get(a.id) ?? [];
            const milestones = sortMilestonesByProgramOrder(
              rawMs.map((m) => {
                const row = m as { assignment_id: string; milestone_type: string; due_date: string; completed_date: string | null };
                return {
                  assignment_id: row.assignment_id,
                  milestone_type: row.milestone_type,
                  due_date: row.due_date,
                  completed_date: row.completed_date,
                  completion_note: null,
                  completed_at: null,
                };
              })
            );

            const completedCount = milestones.filter((m) => m.completed_date).length;

            return (
              <div
                key={a.id}
                className="rounded-2xl border border-white/5 bg-gradient-to-b from-slate-900/60 to-slate-950/80 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] overflow-hidden"
              >
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-white/5">
                  <div>
                    {mentorName ? (
                      <>
                        <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-0.5">Mentor</div>
                        <div className="text-base font-semibold text-slate-200">{mentorName}</div>
                        {mentorPosition && (
                          <div className="text-xs text-slate-500 mt-0.5 uppercase tracking-wide">{mentorPosition}</div>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-slate-500 italic">Mentor not linked</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {archiveLabel && (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        a.assignment_archive_reason === "completed_program"
                          ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20"
                          : "bg-slate-700/50 text-slate-400 ring-1 ring-white/10"
                      }`}>
                        {archiveLabel}
                      </span>
                    )}
                    <span className="text-xs text-slate-600">
                      {completedCount} of {milestones.length} milestones completed
                    </span>
                  </div>
                </div>

                {/* Hire date */}
                {a.hire_date && (
                  <div className="px-5 py-3 border-b border-white/5">
                    <span className="text-xs text-slate-500">Date of Hire: </span>
                    <span className="text-xs text-slate-300 font-medium">{fmt(a.hire_date)}</span>
                  </div>
                )}

                {/* Milestones */}
                {milestones.length > 0 && (
                  <div className="px-5 py-4">
                    <div className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">Milestones</div>
                    <ul className="space-y-2">
                      {milestones.map((m) => {
                        const label = MILESTONE_LABELS[m.milestone_type] ?? m.milestone_type;
                        const done = !!m.completed_date;
                        return (
                          <li key={m.milestone_type} className="flex items-center gap-2.5 text-sm">
                            {done
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden />
                              : <Circle className="h-4 w-4 text-slate-600 shrink-0" aria-hidden />
                            }
                            <span className={done ? "text-slate-300" : "text-slate-500"}>{label}</span>
                            {done && m.completed_date && (
                              <span className="ml-auto text-xs text-slate-600 tabular-nums">{fmt(m.completed_date)}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
