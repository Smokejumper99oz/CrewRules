import { createClient } from "@/lib/supabase/server";

/**
 * Link staged mentor_assignments rows to a live mentor profile when mentor_employee_number matches.
 * Only updates rows where mentor_user_id is null; never overwrites an existing mentor link.
 * @returns Number of rows linked.
 */
export async function linkMentorToAssignments(
  userId: string,
  employeeNumber: string | null | undefined
): Promise<number> {
  const empNum = employeeNumber?.trim();
  if (!empNum) return 0;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("mentor_assignments")
    .update({ mentor_user_id: userId })
    .is("mentor_user_id", null)
    .eq("mentor_employee_number", empNum)
    .select("id");

  if (error) return 0;
  return (data ?? []).length;
}
