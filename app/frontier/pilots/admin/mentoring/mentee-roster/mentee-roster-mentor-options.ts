/** Picker option for Mentee Roster reassignment UI (data only; shared with client table). */
export type MenteeRosterMentorOption = {
  optionKey: string;
  rowKind: "profile" | "preload";
  label: string;
  mentorUserId: string | null;
  mentorEmployeeNumber: string | null;
};
