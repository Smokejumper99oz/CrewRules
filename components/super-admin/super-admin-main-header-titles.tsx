"use client";

import { usePathname } from "next/navigation";
import { Users as UsersIcon, List, Activity, GraduationCap, Award, Skull, CalendarClock } from "lucide-react";

export function SuperAdminMainHeaderTitles() {
  const pathname = usePathname();
  const isUsers = pathname?.startsWith("/super-admin/users");
  const isMentoring = pathname?.startsWith("/super-admin/mentoring");
  const isWaitlist = pathname?.startsWith("/super-admin/waitlist");
  const isFoundingMembers = pathname?.startsWith("/super-admin/founding-members");
  const isSystemHealth = pathname?.startsWith("/super-admin/system-health");
  const isAccountDeletionFinalize = pathname?.startsWith("/super-admin/account-deletion-finalize");
  const isPendingDeletions = pathname?.startsWith("/super-admin/pending-deletions");

  if (isPendingDeletions) {
    return (
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarClock className="h-5 w-5 shrink-0 text-amber-400/90" aria-hidden />
          <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight text-slate-100">
            Pending deletions
          </h1>
        </div>
        <p className="mt-1 text-sm leading-snug text-slate-400">
          Scheduled accounts and recent finalization audit log
        </p>
      </div>
    );
  }

  if (isAccountDeletionFinalize) {
    return (
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <Skull className="h-5 w-5 shrink-0 text-red-400/90" aria-hidden />
          <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight text-slate-100">
            Test / Manual Finalize Account Deletion
          </h1>
        </div>
        <p className="mt-1 text-sm leading-snug text-red-300/80">
          Internal destructive tool — Super Admin only
        </p>
      </div>
    );
  }

  if (isSystemHealth) {
    return (
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <Activity className="size-5 shrink-0 text-slate-400" aria-hidden />
          <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight text-slate-100">System Health</h1>
        </div>
        <p className="mt-1 text-sm leading-snug text-slate-400">
          Live platform status, import activity, and operational alerts
        </p>
      </div>
    );
  }

  if (isUsers) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <UsersIcon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
        <h1 className="text-xl font-semibold tracking-tight truncate text-slate-100">Users</h1>
      </div>
    );
  }

  if (isFoundingMembers) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <Award className="h-5 w-5 shrink-0 text-amber-400/90" aria-hidden />
        <h1 className="text-xl font-semibold tracking-tight truncate text-slate-100">Founding Members</h1>
      </div>
    );
  }

  if (isMentoring) {
    return (
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <GraduationCap className="h-5 w-5 shrink-0 text-cyan-400/90" aria-hidden />
          <h1 className="text-xl font-semibold tracking-tight truncate text-slate-100">Mentoring</h1>
        </div>
        <p className="mt-1 text-sm leading-snug text-slate-400">
          Assignments, roster health, and mentor contact coverage
        </p>
      </div>
    );
  }

  if (isWaitlist) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <List className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
        <h1 className="text-xl font-semibold tracking-tight truncate text-slate-100">Waitlist</h1>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight truncate text-slate-100">Super Admin Dashboard</h1>
      <div className="text-sm text-slate-400 mt-0.5">Powered by Marvella Group™</div>
    </>
  );
}
