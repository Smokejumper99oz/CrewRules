import { addDays, addMonths, addWeeks } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

function utcYyyyMmDd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export type MilestoneScheduleEntry = { milestone_type: string; due_date: string };

/**
 * Baseline schedule from mentee date of hire. Stored `mentorship_milestones.due_date` is the
 * source of truth in the app; seeding and hire-date recalculation apply this computed baseline.
 * Manual updates to `due_date` (future mentor/admin tooling) remain possible per row.
 */
export function getMilestoneScheduleForHireDate(
  hireDateYyyyMmDd: string
): { ok: true; entries: MilestoneScheduleEntry[] } | { ok: false; error: string } {
  const hireTrim = hireDateYyyyMmDd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hireTrim)) {
    return { ok: false, error: "Invalid hire date for milestones." };
  }

  const anchor = new Date(`${hireTrim}T12:00:00.000Z`);
  if (Number.isNaN(anchor.getTime())) {
    return { ok: false, error: "Invalid hire date for milestones." };
  }

  const typeRatingDue = addWeeks(anchor, 6);
  const ioeCompleteDue = addWeeks(typeRatingDue, 2);
  const threeMonthOnLineDue = addMonths(ioeCompleteDue, 3);
  const sixMonthOnLineDue = addMonths(threeMonthOnLineDue, 3);
  const nineMonthOnLineDue = addMonths(sixMonthOnLineDue, 3);
  const probationDue = addDays(anchor, 365);

  const entries: MilestoneScheduleEntry[] = [
    { milestone_type: "initial_assignment", due_date: hireTrim },
    { milestone_type: "type_rating", due_date: utcYyyyMmDd(typeRatingDue) },
    { milestone_type: "oe_complete", due_date: utcYyyyMmDd(ioeCompleteDue) },
    { milestone_type: "three_months", due_date: utcYyyyMmDd(threeMonthOnLineDue) },
    { milestone_type: "six_months", due_date: utcYyyyMmDd(sixMonthOnLineDue) },
    { milestone_type: "nine_months", due_date: utcYyyyMmDd(nineMonthOnLineDue) },
    { milestone_type: "probation_checkride", due_date: utcYyyyMmDd(probationDue) },
  ];

  return { ok: true, entries };
}

/**
 * Updates existing `mentorship_milestones.due_date` rows for `assignmentId` from
 * `getMilestoneScheduleForHireDate` (same rules as CSV seed). Only types present in the schedule
 * are updated; `completed_date` and other columns are unchanged.
 * Skips `oe_complete` when `type_rating` is completed, and `three_months`/`six_months` when
 * `oe_complete` is completed, so hire-based refresh does not overwrite dates set from actual
 * completion cascades (same intervals as `apply_mentorship_milestone_downstream_due_cascade`).
 */
export async function syncMentorshipMilestoneDueDatesFromHireForAssignment(
  admin: SupabaseClient,
  assignmentId: string
): Promise<{ error?: string }> {
  const id = assignmentId.trim();
  if (!id) return { error: "Invalid assignment." };

  const { data: assignment, error: aErr } = await admin
    .from("mentor_assignments")
    .select("id, hire_date")
    .eq("id", id)
    .maybeSingle();

  if (aErr) return { error: aErr.message };
  if (!assignment) return { error: "Assignment not found." };

  const rawHire = assignment.hire_date as string | null;
  if (rawHire == null || String(rawHire).trim() === "") {
    return { error: "Assignment has no hire date." };
  }

  const hireStr = String(rawHire).trim().slice(0, 10);
  const schedule = getMilestoneScheduleForHireDate(hireStr);
  if (!schedule.ok) return { error: schedule.error };

  const byType = new Map(schedule.entries.map((e) => [e.milestone_type, e.due_date]));

  const { data: milestones, error: mErr } = await admin
    .from("mentorship_milestones")
    .select("id, milestone_type, due_date, completed_date")
    .eq("assignment_id", id);

  if (mErr) return { error: mErr.message };

  const milestoneRows = milestones ?? [];
  const hasCompleted = (t: string) => {
    const r = milestoneRows.find((x) => (x.milestone_type as string) === t);
    const cd = r?.completed_date;
    return cd != null && String(cd).trim() !== "";
  };

  for (const row of milestoneRows) {
    const mt = (row.milestone_type as string) ?? "";
    const newDue = byType.get(mt);
    if (newDue === undefined) continue;

    if (mt === "oe_complete" && hasCompleted("type_rating")) {
      continue;
    }
    if ((mt === "three_months" || mt === "six_months") && hasCompleted("oe_complete")) {
      continue;
    }

    const currentDue = String(row.due_date ?? "").trim().slice(0, 10);
    if (currentDue === newDue) continue;

    const { error: uErr } = await admin
      .from("mentorship_milestones")
      .update({ due_date: newDue })
      .eq("id", row.id as string);

    if (uErr) return { error: uErr.message };
  }

  return {};
}

/**
 * Idempotent: inserts only milestone types not already present for this assignment.
 * Service-role client only.
 */
export async function createMilestonesForAssignment(
  assignmentId: string,
  hireDateYyyyMmDd: string
): Promise<{ error?: string }> {
  const admin = createAdminClient();
  const schedule = getMilestoneScheduleForHireDate(hireDateYyyyMmDd);
  if (!schedule.ok) {
    return { error: schedule.error };
  }

  const { data: existing, error: exErr } = await admin
    .from("mentorship_milestones")
    .select("milestone_type")
    .eq("assignment_id", assignmentId);

  if (exErr) return { error: exErr.message };

  const have = new Set((existing ?? []).map((r: { milestone_type: string }) => r.milestone_type));
  const toInsert = schedule.entries.filter((d) => !have.has(d.milestone_type));
  if (toInsert.length === 0) return {};

  const rows = toInsert.map((d) => ({
    assignment_id: assignmentId,
    milestone_type: d.milestone_type,
    due_date: d.due_date,
  }));

  const { error: insErr } = await admin.from("mentorship_milestones").insert(rows);
  if (insErr) return { error: insErr.message };
  return {};
}
