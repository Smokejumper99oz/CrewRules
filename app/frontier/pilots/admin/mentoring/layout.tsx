import type { ReactNode } from "react";
import { FrontierPilotAdminMentoringSubnav } from "@/components/admin/frontier-pilot-admin-mentoring-subnav";

export default function FrontierPilotAdminMentoringLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full min-w-0">
      <FrontierPilotAdminMentoringSubnav />
      <div className="mt-6 min-w-0 sm:mt-7">{children}</div>
    </div>
  );
}
