"use client";

import { usePathname } from "next/navigation";
import { Users as UsersIcon, List, Activity, GraduationCap } from "lucide-react";

export function SuperAdminMainHeaderTitles() {
  const pathname = usePathname();
  const isUsers = pathname?.startsWith("/super-admin/users");
  const isMentoring = pathname?.startsWith("/super-admin/mentoring");
  const isWaitlist = pathname?.startsWith("/super-admin/waitlist");
  const isSystemHealth = pathname?.startsWith("/super-admin/system-health");

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
