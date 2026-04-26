"use server";

import { createClient } from "@/lib/supabase/server";

/** Clears server session cookies. Do not `redirect()` here — form actions + redirect break in Next.js 15; client navigates after. */
export async function demo135OpsSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
