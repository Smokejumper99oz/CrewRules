"use server";

import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Don't redirect here - form action + redirect() causes "unexpected response" in Next.js 15.
  // Middleware will redirect to login on next request when user is null.
}
