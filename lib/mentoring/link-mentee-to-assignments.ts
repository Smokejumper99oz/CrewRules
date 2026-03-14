import { createClient } from "@/lib/supabase/server";

/**
 * Link unclaimed mentor_assignments rows to a user when employee_number matches.
 * Only updates rows where mentee_user_id is null; never overwrites existing links.
 * @returns Number of rows linked.
 */
export async function linkMenteeToAssignments(
  userId: string,
  employeeNumber: string | null | undefined
): Promise<number> {
  const empNum = employeeNumber?.trim();
  if (!empNum) return 0;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("mentor_assignments")
    .update({ mentee_user_id: userId })
    .eq("employee_number", empNum)
    .is("mentee_user_id", null)
    .select("id");

  if (error) return 0;
  return (data ?? []).length;
}
