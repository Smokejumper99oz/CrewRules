import type { ReactNode } from "react";
import { getProfile } from "@/lib/profile";
import { MentoringSectionChrome } from "./mentoring-section-chrome";

export default async function PilotPortalMentoringLayout({ children }: { children: ReactNode }) {
  const profile = await getProfile();
  const showMentorTabs = profile?.is_mentor === true;

  return <MentoringSectionChrome showMentorTabs={showMentorTabs}>{children}</MentoringSectionChrome>;
}
