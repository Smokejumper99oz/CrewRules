"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { WAITLIST_STATUSES, type WaitlistStatus } from "@/lib/waitlist/constants";

export type UpdateStatusResult = { error?: string } | null;

export async function updateWaitlistStatus(
  id: string,
  status: string
): Promise<UpdateStatusResult> {
  const profile = await getProfile();
  if (profile?.role !== "super_admin") {
    return { error: "Unauthorized" };
  }

  if (!WAITLIST_STATUSES.includes(status as WaitlistStatus)) {
    return { error: "Invalid status" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("waitlist").update({ status }).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  return null;
}
