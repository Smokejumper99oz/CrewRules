"use client";

import { usePathname } from "next/navigation";

const PORTAL_TITLES: Record<string, string> = {
  "": "Dashboard",
  ask: "Ask AI",
  library: "Library",
  schedule: "My Schedule",
  forum: "Forum",
  notes: "Notes",
  mentoring: "Mentoring",
  updates: "Updates",
  profile: "Profile",
  reserve: "Reserve",
};

const ADMIN_TITLES: Record<string, string> = {
  "": "Dashboard",
  documents: "Uploads",
  library: "Library",
  people: "People & Permissions",
};

function roleFromPortalDisplayName(displayName: string): string {
  return displayName.replace(/\s*Portal\s*$/i, "").trim() || displayName;
}

type PageTitleProps = {
  portalDisplayName?: string;
  isAdmin?: boolean;
};

export function PageTitle({ portalDisplayName = "", isAdmin = false }: PageTitleProps) {
  const pathname = usePathname();

  const parts = (pathname ?? "").split("/").filter(Boolean);
  const inAdmin = parts.includes("admin") || isAdmin;
  const segmentIndex = inAdmin ? parts.indexOf("admin") + 1 : parts.indexOf("portal") + 1;
  const currentSegment = parts[segmentIndex] ?? "";

  const pageTitle = inAdmin
    ? (ADMIN_TITLES[currentSegment] ?? "Dashboard")
    : (PORTAL_TITLES[currentSegment] ?? "Dashboard");

  const role = roleFromPortalDisplayName(portalDisplayName);
  const context = inAdmin && role ? `${role} Admin` : role || (inAdmin ? "Admin" : "");

  return (
    <h1 className="text-xl font-semibold tracking-normal border-b border-white/5 pb-1">
      {pageTitle}
      {context && <span className="text-slate-400 font-normal mx-1.5">|</span>}
      {context && <span className="text-slate-400 font-normal">{context}</span>}
    </h1>
  );
}
