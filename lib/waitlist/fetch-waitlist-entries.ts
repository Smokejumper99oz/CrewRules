import { createClient } from "@/lib/supabase/server";

export type WaitlistEntryRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  airline: string | null;
  requested_portal: string | null;
  source: string | null;
  status: string | null;
  created_at: string | null;
};

export async function fetchWaitlistEntries(): Promise<{
  entries: WaitlistEntryRow[];
  error: { message: string } | null;
}> {
  const supabase = await createClient();
  const { data: entries, error } = await supabase
    .from("waitlist")
    .select("id, email, full_name, airline, requested_portal, source, status, created_at")
    .order("created_at", { ascending: false });

  return {
    entries: (entries ?? []) as WaitlistEntryRow[],
    error: error ? { message: error.message } : null,
  };
}
