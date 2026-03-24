"use client";

import { usePathname } from "next/navigation";
import { Users as UsersIcon, List } from "lucide-react";

export function SuperAdminMainHeaderTitles() {
  const pathname = usePathname();
  const isUsers = pathname?.startsWith("/super-admin/users");
  const isWaitlist = pathname?.startsWith("/super-admin/waitlist");

  if (isUsers) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <UsersIcon className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
        <h1 className="text-xl font-semibold tracking-tight truncate text-slate-100">Users</h1>
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
