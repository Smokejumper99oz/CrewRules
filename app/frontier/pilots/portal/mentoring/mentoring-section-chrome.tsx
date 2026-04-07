"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { BookUser, Handshake, ListChecks, FolderOpen } from "lucide-react";
import { PilotPortalMentoringSubnav } from "@/components/mentoring/pilot-portal-mentoring-subnav";

const MENTORING_BASE = "/frontier/pilots/portal/mentoring";

/** Matches `portal-settings-shell` scroll row: inline tabs + bottom border. */
const menteeSettingsStyleRowClass = [
  "sidebar-scrollbar-hide flex w-full max-w-full min-w-0 flex-nowrap items-end gap-0 overflow-x-auto overscroll-x-contain border-b border-slate-200 [touch-action:pan-x] dark:border-white/10",
  "scroll-smooth scroll-ps-3 scroll-pe-8 sm:scroll-ps-4 sm:scroll-pe-10 lg:scroll-ps-2 lg:scroll-pe-8",
  "ps-[max(0.75rem,env(safe-area-inset-left,0px))] pe-[max(2rem,calc(1rem+env(safe-area-inset-right,0px)))] sm:ps-4 sm:pe-10 lg:ps-2 lg:pe-8",
  "max-lg:snap-x max-lg:snap-mandatory",
].join(" ");

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

/** Single-segment path under `/mentoring/[id]` excluding static routes → assignment id, else null. */
function mentoringPathnameAssignmentId(pathname: string): string | null {
  const norm = normalizePathname(pathname);
  if (norm === MENTORING_BASE) return null;
  const prefix = `${MENTORING_BASE}/`;
  if (!norm.startsWith(prefix)) return null;
  const seg = norm.slice(prefix.length);
  if (!seg || seg.includes("/")) return null;
  const staticRoutes = new Set(["library", "guide", "profile", "archived", "contacts"]);
  if (staticRoutes.has(seg)) return null;
  return seg;
}

type MenteeTopKey = "my_milestones" | "my_mentor" | "program_history" | "important_contacts";

const MENTEE_TOP_ITEMS: readonly { key: MenteeTopKey; label: string; icon: LucideIcon }[] = [
  { key: "my_milestones",      label: "My Milestones",      icon: ListChecks  },
  { key: "my_mentor",          label: "My Mentor",           icon: Handshake   },
  { key: "program_history",    label: "Program History",     icon: FolderOpen  },
  { key: "important_contacts", label: "Important Contacts",  icon: BookUser    },
] as const;

export function MentoringSectionChrome({
  showMentorTabs,
  menteeNavAssignmentId,
  children,
}: {
  showMentorTabs: boolean;
  /** First mentee assignment id from `getMentorAssignments` when user is not a mentor tab viewer. */
  menteeNavAssignmentId: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const norm = normalizePathname(pathname);
  const detailIdFromPath = mentoringPathnameAssignmentId(pathname);

  return (
    <div className="w-full min-w-0">
      {showMentorTabs ? <PilotPortalMentoringSubnav /> : null}
      {!showMentorTabs ? (
        <nav aria-label="Mentoring shortcuts" className="mb-5 min-w-0 w-full sm:mb-6">
          <div className={menteeSettingsStyleRowClass}>
            {MENTEE_TOP_ITEMS.map(({ key, label, icon: Icon }) => {
              const detailHref =
                menteeNavAssignmentId != null ? `${MENTORING_BASE}/${menteeNavAssignmentId}` : null;

              let href: string | null = null;
              let disabled = false;

              switch (key) {
                case "my_milestones":
                  if (detailHref) href = detailHref;
                  else disabled = true;
                  break;
                case "my_mentor":
                  href = MENTORING_BASE;
                  break;
                case "program_history":
                  href = `${MENTORING_BASE}/archived`;
                  break;
                case "important_contacts":
                  href = `${MENTORING_BASE}/contacts`;
                  break;
              }

              const isMyMentorHome = norm === MENTORING_BASE;
              const onKnownDetail =
                detailIdFromPath != null &&
                menteeNavAssignmentId != null &&
                detailIdFromPath === menteeNavAssignmentId;

              let isActive = false;
              if (key === "my_milestones")      isActive = onKnownDetail;
              else if (key === "my_mentor")     isActive = isMyMentorHome;
              else if (key === "program_history")    isActive = norm === `${MENTORING_BASE}/archived`;
              else if (key === "important_contacts") isActive = norm === `${MENTORING_BASE}/contacts`;

              const sharedItemClass = [
                "group flex shrink-0 items-center gap-1.5 border-0 border-b-2 border-b-transparent text-sm transition touch-manipulation",
                "-mb-px px-3 py-2.5 max-lg:min-h-[48px] max-lg:snap-start max-lg:snap-always max-lg:py-3 lg:min-h-0 lg:px-3.5 lg:py-2",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#75C043]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:outline-none dark:focus-visible:ring-2 dark:focus-visible:ring-emerald-400/50 dark:focus-visible:ring-offset-slate-950",
              ];

              if (disabled) {
                sharedItemClass.push(
                  "pointer-events-none cursor-not-allowed select-none opacity-50 shadow-none",
                  "text-slate-500 dark:text-slate-400",
                );
              } else if (isActive) {
                sharedItemClass.push(
                  "cursor-pointer font-medium text-slate-900 dark:text-white",
                  "shadow-[inset_0_-2px_0_0_#75C043] dark:shadow-[inset_0_-2px_0_0_#34d399]",
                );
              } else {
                sharedItemClass.push(
                  "cursor-pointer shadow-none text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
                );
              }

              const iconClass = [
                "h-3.5 w-3.5 shrink-0 transition",
                disabled
                  ? "text-slate-400 dark:text-slate-500"
                  : isActive
                    ? "text-[#5a9a35] dark:text-emerald-300"
                    : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300",
              ].join(" ");

              const inner = (
                <>
                  <Icon className={iconClass} aria-hidden />
                  <span className="whitespace-nowrap">{label}</span>
                </>
              );

              return disabled ? (
                <span key={key} className={sharedItemClass.join(" ")} aria-disabled="true">
                  {inner}
                </span>
              ) : (
                <Link key={key} href={href!} className={sharedItemClass.join(" ")}>
                  {inner}
                </Link>
              );
            })}
            <span className="w-6 shrink-0 select-none sm:w-8" aria-hidden />
          </div>
        </nav>
      ) : null}
      <div className={showMentorTabs ? "mt-6 min-w-0 sm:mt-7" : "min-w-0"}>{children}</div>
    </div>
  );
}
