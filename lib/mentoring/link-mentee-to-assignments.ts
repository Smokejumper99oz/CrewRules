import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureMentorshipMilestonesForMenteeUser } from "@/lib/mentoring/create-milestones-for-assignment";

async function linkMenteeToAssignmentsLegacyExact(
  userId: string,
  empNum: string
): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("mentor_assignments")
    .update({ mentee_user_id: userId })
    .eq("employee_number", empNum)
    .is("mentee_user_id", null)
    .select("id");

  if (error) return 0;
  return (data ?? []).length;
}

function rpcCount(data: unknown): number | null {
  if (typeof data === "number" && Number.isFinite(data)) return data;
  if (typeof data === "string" && data.trim() !== "") {
    const n = Number(data);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Link unclaimed mentor_assignments rows to the signed-in user when mentee `employee_number`
 * matches their profile (btrim + numeric equality for digit-only strings via RPC).
 * Falls back to exact `.eq` if the RPC is unavailable (pre-migration DB).
 *
 * Only updates rows where mentee_user_id is null; never overwrites existing links.
 * @returns Number of rows linked.
 */
export async function linkMenteeToAssignments(
  userId: string,
  employeeNumber: string | null | undefined
): Promise<number> {
  const empNum = employeeNumber?.trim();
  if (!empNum) return 0;

  // User-scoped client: required so auth.uid() resolves inside the SECURITY DEFINER RPC.
  const supabase = await createClient();

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "link_mentee_assignments_for_authenticated_user"
  );

  let linked = 0;
  const fromRpc = rpcCount(rpcData);
  if (!rpcError && fromRpc !== null) {
    linked = fromRpc;
  } else {
    if (rpcError) {
      console.warn(
        "[linkMenteeToAssignments] RPC link_mentee_assignments_for_authenticated_user failed; using exact match fallback:",
        rpcError.message
      );
    }
    linked = await linkMenteeToAssignmentsLegacyExact(userId, empNum);
  }

  // Central guarantee: milestone rows + hire-based due dates for all assignments this user is linked to as mentee.
  await ensureMentorshipMilestonesForMenteeUser(userId);

  return linked;
}
