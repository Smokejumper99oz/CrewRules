"use client";

import type { ReactNode } from "react";
import { PilotPortalMentoringSubnav } from "@/components/mentoring/pilot-portal-mentoring-subnav";

export function MentoringSectionChrome({
  showMentorTabs,
  children,
}: {
  showMentorTabs: boolean;
  children: ReactNode;
}) {
  return (
    <div className="w-full min-w-0">
      {showMentorTabs ? <PilotPortalMentoringSubnav /> : null}
      <div className={showMentorTabs ? "mt-6 min-w-0 sm:mt-7" : "min-w-0"}>{children}</div>
    </div>
  );
}
