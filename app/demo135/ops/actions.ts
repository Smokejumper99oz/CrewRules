"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function demo135OpsSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/demo135/ops/login");
}
