"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 60 * 1000;

/** Triggers router.refresh() every 60 seconds so the Super Admin dashboard stays current. */
export function SuperAdminRefreshTrigger() {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [router]);

  return null;
}
