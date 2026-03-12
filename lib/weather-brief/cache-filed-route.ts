import { createClient } from "@/lib/supabase/server";

export async function cacheFiledRoute(
  eventId: string,
  route: string
): Promise<void> {
  const supabase = await createClient();

  await supabase
    .from("schedule_events")
    .update({ filed_route: route })
    .eq("id", eventId);
}
