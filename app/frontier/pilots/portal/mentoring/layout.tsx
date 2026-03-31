import type { ReactNode } from "react";
import { getProfile } from "@/lib/profile";
import { getMentorAssignments } from "./actions";
import { MentoringSectionChrome } from "./mentoring-section-chrome";

export default async function PilotPortalMentoringLayout({ children }: { children: ReactNode }) {
  const profile = await getProfile();
  const showMentorTabs = profile?.is_mentor === true;

  let menteeNavAssignmentId: string | null = null;
  if (!showMentorTabs) {
    const { assignments } = await getMentorAssignments();
    const menteeRow = assignments.find((a) => !a.isMentorView);
    menteeNavAssignmentId = menteeRow?.id ?? null;
  }

  return (
    <MentoringSectionChrome showMentorTabs={showMentorTabs} menteeNavAssignmentId={menteeNavAssignmentId}>
      {children}
    </MentoringSectionChrome>
  );
}
