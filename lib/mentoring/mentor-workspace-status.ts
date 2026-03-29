/** Allowed mentoring workspace status values (assignment-level, not account status). */
export const MENTOR_WORKSPACE_STATUS_OPTIONS = [
  "Active",
  "Needs Check-In",
  "On Track",
  "Military Leave",
  "Paused",
  "Needs Support",
] as const;

export type MentorWorkspaceStatus = (typeof MENTOR_WORKSPACE_STATUS_OPTIONS)[number];

export function isMentorWorkspaceStatus(s: string): s is MentorWorkspaceStatus {
  return (MENTOR_WORKSPACE_STATUS_OPTIONS as readonly string[]).includes(s);
}
