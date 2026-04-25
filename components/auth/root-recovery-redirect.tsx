"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * When Supabase recovery lands on `/` with tokens in the hash (implicit flow),
 * establish the session and send the user to the generic reset page.
 */
export function RootRecoveryRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.location.hash;
    if (!raw.startsWith("#")) return;

    const params = new URLSearchParams(raw.slice(1));
    if (params.get("type") !== "recovery") return;

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) return;

    let cancelled = false;

    void (async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (cancelled) return;
        if (error) {
          window.location.replace("/frontier/pilots/login?error=recovery_session_failed");
          return;
        }
        window.location.replace("/auth/reset-password");
      } catch {
        if (!cancelled) {
          window.location.replace("/frontier/pilots/login?error=recovery_session_failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
