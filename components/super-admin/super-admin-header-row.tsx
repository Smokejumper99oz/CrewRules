"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function SuperAdminHeaderRow({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isTightHeader =
    pathname?.startsWith("/super-admin/users") || pathname?.startsWith("/super-admin/waitlist");

  return (
    <div
      className={
        isTightHeader
          ? "mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 pt-4 pb-2 sm:px-6"
          : "mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 sm:px-6"
      }
    >
      {children}
    </div>
  );
}
