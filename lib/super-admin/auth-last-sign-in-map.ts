import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Auth `last_sign_in_at` per user id from `auth.admin.listUsers` (paginated).
 * Returns null if listing fails — callers must not infer "not joined" without a successful map.
 */
export async function fetchAuthLastSignInAtByUserId(
  admin: SupabaseClient
): Promise<Map<string, string | null> | null> {
  const map = new Map<string, string | null>();
  let page = 1;
  const perPage = 1000;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("[SuperAdmin] auth.admin.listUsers failed:", error.message);
      return null;
    }
    const users = data.users ?? [];
    for (const u of users) {
      map.set(u.id, u.last_sign_in_at ?? null);
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return map;
}
