/**
 * Shared helpers for Supabase auth recovery/invite callback URLs (hash + query).
 * Used by generic `/auth/reset-password`; see also `app/frontier/pilots/reset-password/page.tsx`
 * (duplicated there intentionally to avoid changing the Frontier route).
 */

/** Same merge rules as @supabase/auth-js parseParametersFromURL: hash + query, query wins. */
export function parseAuthParamsFromHref(href: string): Record<string, string> {
  const result: Record<string, string> = {};
  const url = new URL(href);
  if (url.hash?.startsWith("#")) {
    try {
      new URLSearchParams(url.hash.slice(1)).forEach((value, key) => {
        result[key] = value;
      });
    } catch {
      /* hash is not query-style */
    }
  }
  url.searchParams.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export function stripRecoveryParamsFromBrowserUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let changed = false;
  if (url.hash) {
    url.hash = "";
    changed = true;
  }
  if (url.searchParams.has("code")) {
    url.searchParams.delete("code");
    changed = true;
  }
  if (changed) {
    const next = url.pathname + (url.search ? url.search : "") + (url.hash ?? "");
    window.history.replaceState(window.history.state, "", next);
  }
}
