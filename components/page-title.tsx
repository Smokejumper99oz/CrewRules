"use client";

import { usePathname } from "next/navigation";

const PORTAL_TITLES: Record<string, string> = {
  "": "Dashboard",
  ask: "Ask AI",
  library: "Library",
  guides: "Guides",
  schedule: "My Schedule",
  "family-view": "Family View",
  "weather-brief": "Weather Brief",
  forum: "Forum",
  notes: "Notes",
  mentoring: "Mentoring",
  updates: "System Updates",
  settings: "Settings",
  profile: "Profile",
  reserve: "Reserve",
};

const ADMIN_TITLES: Record<string, string> = {
  "": "Dashboard",
  documents: "Uploads",
  library: "Library",
  people: "People & Permissions",
  waitlist: "Waitlist",
  mentoring: "F9 Mentoring",
  profile: "Your Admin Profile",
};

function roleFromPortalDisplayName(displayName: string): string {
  return displayName.replace(/\s*Portal\s*$/i, "").trim() || displayName;
}

type PageTitleProps = {
  portalDisplayName?: string;
  isAdmin?: boolean;
  /** Frontier tenant admin light shell — avoids dark-mode title styles on pale background. */
  adminSurface?: boolean;
  /** Pro / Enterprise / active trial: product name is Advanced Weather Brief. */
  advancedWeatherBrief?: boolean;
};

export function PageTitle({
  portalDisplayName = "",
  isAdmin = false,
  adminSurface = false,
  advancedWeatherBrief = false,
}: PageTitleProps) {
  const pathname = usePathname();

  const parts = (pathname ?? "").split("/").filter(Boolean);
  const inAdmin = parts.includes("admin") || isAdmin;
  const segmentIndex = inAdmin ? parts.indexOf("admin") + 1 : parts.indexOf("portal") + 1;
  const currentSegment = parts[segmentIndex] ?? "";
  const nextSegment = parts[segmentIndex + 1] ?? "";

  const pageTitle = inAdmin
    ? (ADMIN_TITLES[currentSegment] ?? "Dashboard")
    : currentSegment === "profile" && nextSegment === "about"
      ? "About"
      : currentSegment === "profile"
        ? "Settings"
        : (PORTAL_TITLES[currentSegment] ?? "Dashboard");

  const role = roleFromPortalDisplayName(portalDisplayName);
  const context = inAdmin && role ? `${role} Admin` : role || (inAdmin ? "Admin" : "");

  /** Admin index: single branded heading (replaces "Dashboard | … Admin"). */
  const isAdminHome = inAdmin && currentSegment === "";

  if (!inAdmin && currentSegment === "guides" && nextSegment === "commute-assist-alerts") {
    return (
      <h1 className="min-w-0 truncate text-xl font-semibold tracking-normal border-b border-slate-200 pb-1 dark:border-white/5">
        Commute Assist<span className="text-[#75C043]">™</span> Alerts
        {context && <span className="text-slate-500 font-normal mx-1.5 dark:text-slate-400">|</span>}
        {context && <span className="text-slate-500 font-normal dark:text-slate-400">{context}</span>}
      </h1>
    );
  }

  // Weather Brief uses branded title with role context
  if (!inAdmin && currentSegment === "weather-brief") {
    const briefProductName = advancedWeatherBrief ? "Advanced Weather Brief" : "Weather Brief";
    return (
      <h1 className="min-w-0 hyphens-auto break-words text-base font-semibold leading-snug tracking-normal border-b border-slate-200 pb-1 dark:border-white/5 sm:text-xl sm:leading-normal">
        Crew<span className="text-[#75C043]">Rules</span>
        <span className="align-super text-xs">™</span> {briefProductName}
        {context && <span className="text-slate-500 font-normal max-sm:block max-sm:mt-0.5 sm:mx-1.5 dark:text-slate-400">|</span>}
        {context && <span className="text-slate-500 font-normal dark:text-slate-400">{context}</span>}
      </h1>
    );
  }

  if (adminSurface) {
    return (
      <h1 className="min-w-0 truncate text-xl font-semibold tracking-normal border-b border-slate-200 pb-1 text-[#1a2b4b]">
        {isAdminHome ? (
          "Mentorship Program Dashboard"
        ) : (
          <>
            {pageTitle}
            {context && <span className="text-slate-400 font-normal mx-1.5">|</span>}
            {context && <span className="text-slate-600 font-normal">{context}</span>}
          </>
        )}
      </h1>
    );
  }

  return (
    <h1 className="min-w-0 truncate text-xl font-semibold tracking-normal border-b border-slate-200 pb-1 dark:border-white/5">
      {isAdminHome ? (
        "Mentorship Program Dashboard"
      ) : (
        <>
          {pageTitle}
          {context && <span className="text-slate-500 font-normal mx-1.5 dark:text-slate-400">|</span>}
          {context && <span className="text-slate-500 font-normal dark:text-slate-400">{context}</span>}
        </>
      )}
    </h1>
  );
}
